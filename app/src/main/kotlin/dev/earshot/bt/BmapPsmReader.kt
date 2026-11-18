package dev.earshot.bt

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.Context
import dev.earshot.protocol.toHex
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeout
import java.io.IOException
import java.util.UUID

/** Pure representation of a discovered GATT characteristic for fallback discovery & unit tests. */
internal data class DiscoveredGattCharacteristic(
    val uuid: UUID,
    val properties: Int,
)

/** Pure representation of a discovered GATT service for fallback discovery & unit tests. */
internal data class DiscoveredGattService(
    val uuid: UUID,
    val characteristics: List<DiscoveredGattCharacteristic>,
)

/**
 * Finds the L2CAP channel (PSM) or BLE GATT service/characteristic pair that carries BMAP over
 * Bluetooth LE.
 *
 * 2nd Gen Ultra Earbuds can fail classic RFCOMM sockets due to dual-mode/LE Audio link arbitration.
 * This helper discovers all GATT services and characteristics, logs every raw UUID to [BtDebugLog],
 * and provides:
 * 1) [read]: reads Bose's LE L2CAP PSM characteristic ([PSM_CHARACTERISTIC]) to open [RfcommTransport.connectLeCoc].
 * 2) [discoverGattFallback]: selects a Bose vendor GATT service with a writable + notifying/indicating
 *    characteristic pair so [GattLink.open] can speak BMAP directly over BLE GATT without RFCOMM timeouts.
 */
internal object BmapPsmReader {
    val SERVICE: UUID = UUID.fromString("0000febe-0000-1000-8000-00805f9b34fb")
    val PSM_CHARACTERISTIC: UUID = UUID.fromString("089ca084-6721-4419-9003-5e14d5ab587d")

    /** Standard Bluetooth SIG GATT services that must never be picked as a vendor BMAP pipe. */
    private val STANDARD_SIG_SERVICES: Set<UUID> = setOf(
        UUID.fromString("00001800-0000-1000-8000-00805f9b34fb"), // Generic Access
        UUID.fromString("00001801-0000-1000-8000-00805f9b34fb"), // Generic Attribute
        UUID.fromString("0000180a-0000-1000-8000-00805f9b34fb"), // Device Information
        UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb"), // Battery Service
    )

    /** Connect, discover and read; a slow LE link takes a few seconds for all three. */
    const val TIMEOUT_MS = 10_000L

    class Result(val psm: Int, val gatt: BluetoothGatt)

    /**
     * The PSM in a characteristic value. The byte order is not documented: a single byte is the
     * PSM; with two, whichever order lands in the dynamic LE range wins (little-endian first, as
     * GATT values usually are). Null when nothing plausible is there.
     */
    fun parsePsm(value: ByteArray?): Int? {
        if (value == null || value.isEmpty()) return null
        val b0 = value[0].toInt() and 0xFF
        if (value.size == 1) return b0.takeIf { it in LE_DYNAMIC_PSM }
        val b1 = value[1].toInt() and 0xFF
        val little = b0 or (b1 shl 8)
        val big = (b0 shl 8) or b1
        return when {
            little in LE_DYNAMIC_PSM -> little
            big in LE_DYNAMIC_PSM -> big
            else -> null
        }
    }

    /** LE credit-based channels use dynamic PSMs 0x80..0xFF (Core spec, Vol 3 Part A 4.22). */
    private val LE_DYNAMIC_PSM = 0x80..0xFF

    /**
     * Choose the best vendor GATT byte pipe from discovered services: Bose's [SERVICE] (0xFEBE)
     * takes precedence, otherwise any non-standard, non-firmware-update service offering both a
     * writable characteristic and at least one notifying/indicating characteristic.
     */
    fun chooseGattSpec(services: List<DiscoveredGattService>): GattLinkSpec? {
        val candidates = services
            .filterNot { it.uuid in STANDARD_SIG_SERVICES || GattLinkSpec.isFirmwareService(it.uuid) }
            .sortedByDescending { if (it.uuid == SERVICE) 1 else 0 }

        for (service in candidates) {
            val writeChar = service.characteristics.firstOrNull { c ->
                c.uuid != PSM_CHARACTERISTIC &&
                    (c.properties and (GattTransport.PROPERTY_WRITE or GattTransport.PROPERTY_WRITE_NO_RESPONSE)) != 0
            } ?: continue
            val notifyChars = service.characteristics.filter { c ->
                c.uuid != PSM_CHARACTERISTIC &&
                    (c.properties and (GattTransport.PROPERTY_NOTIFY or GattTransport.PROPERTY_INDICATE)) != 0
            }
            if (notifyChars.isEmpty()) continue
            val writeWithResp = (writeChar.properties and GattTransport.PROPERTY_WRITE) != 0
            return GattLinkSpec(
                name = if (service.uuid == SERVICE) "Bose BMAP GATT" else "Vendor BLE GATT",
                service = service.uuid,
                write = writeChar.uuid,
                notify = notifyChars.map { it.uuid },
                writeWithResponse = writeWithResp,
            )
        }
        return null
    }

    @SuppressLint("MissingPermission")
    suspend fun read(context: Context, device: BluetoothDevice): Result {
        val connected = CompletableDeferred<Unit>()
        val discovered = CompletableDeferred<Unit>()
        val value = CompletableDeferred<ByteArray?>()
        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                when {
                    newState == BluetoothProfile.STATE_CONNECTED -> {
                        BtDebugLog.log(BtDebugLog.Kind.GATT, "GATT connected to ${device.address}", "status=$status")
                        connected.complete(Unit)
                    }
                    newState == BluetoothProfile.STATE_DISCONNECTED -> {
                        val e = IOException("GATT disconnected (status $status)")
                        connected.completeExceptionally(e)
                        discovered.completeExceptionally(e)
                        value.completeExceptionally(e)
                    }
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    logDiscoveredServices(device.address, gatt)
                    discovered.complete(Unit)
                } else {
                    discovered.completeExceptionally(IOException("GATT service discovery failed (status $status)"))
                }
            }

            // API 33+ delivers the value here.
            override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, data: ByteArray, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) value.complete(data)
                else value.completeExceptionally(IOException("PSM read failed (status $status)"))
            }

            // Before API 33 the value sits in the characteristic.
            @Deprecated("Deprecated in API 33")
            @Suppress("DEPRECATION")
            override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) value.complete(characteristic.value)
                else value.completeExceptionally(IOException("PSM read failed (status $status)"))
            }
        }

        BtDebugLog.log(BtDebugLog.Kind.UUID, "GATT lookup PSM on ${device.address}", "$SERVICE / $PSM_CHARACTERISTIC")
        val gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            ?: throw IOException("GATT client could not be created")
        try {
            return withTimeout(TIMEOUT_MS) {
                connected.await()
                if (!gatt.discoverServices()) throw IOException("GATT service discovery did not start")
                discovered.await()
                val characteristic = gatt.getService(SERVICE)?.getCharacteristic(PSM_CHARACTERISTIC)
                    ?: gatt.services.orEmpty().firstNotNullOfOrNull { it.getCharacteristic(PSM_CHARACTERISTIC) }
                    ?: throw IOException("the headphones publish no BMAP LE channel (no PSM characteristic)")
                if (!gatt.readCharacteristic(characteristic)) throw IOException("PSM read did not start")
                val raw = value.await()
                raw?.let { BtDebugLog.rx("GATT PSM ${device.address}", it) }
                val psm = parsePsm(raw) ?: throw IOException("PSM characteristic holds no usable channel (${raw?.toHex()})")
                BtLog.i("BMAP LE channel of ${device.address}: PSM 0x%02x".format(psm))
                BtDebugLog.log(BtDebugLog.Kind.GATT, "Resolved BMAP LE L2CAP PSM", "0x%02x ($psm)".format(psm))
                Result(psm, gatt)
            }
        } catch (t: Throwable) {
            runCatching { gatt.close() }
            if (t is CancellationException && t !is kotlinx.coroutines.TimeoutCancellationException) throw t
            if (t is kotlinx.coroutines.TimeoutCancellationException) throw IOException("BMAP LE channel lookup timed out after ${TIMEOUT_MS}ms")
            throw t
        }
    }

    /**
     * Discover all BLE GATT services and characteristics on [device] and resolve a fallback
     * [GattLinkSpec] when RFCOMM / L2CAP CoC cannot connect.
     */
    @SuppressLint("MissingPermission")
    suspend fun discoverGattFallback(context: Context, device: BluetoothDevice): GattLinkSpec {
        val connected = CompletableDeferred<Unit>()
        val discovered = CompletableDeferred<Unit>()
        val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                when {
                    newState == BluetoothProfile.STATE_CONNECTED -> connected.complete(Unit)
                    newState == BluetoothProfile.STATE_DISCONNECTED -> {
                        val e = IOException("GATT fallback discovery disconnected (status $status)")
                        connected.completeExceptionally(e)
                        discovered.completeExceptionally(e)
                    }
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    logDiscoveredServices(device.address, gatt)
                    discovered.complete(Unit)
                } else {
                    discovered.completeExceptionally(IOException("GATT discovery failed (status $status)"))
                }
            }
        }

        BtDebugLog.log(BtDebugLog.Kind.GATT, "Starting BLE GATT fallback discovery on ${device.address}")
        val gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            ?: throw IOException("GATT client could not be created")
        try {
            return withTimeout(TIMEOUT_MS) {
                connected.await()
                if (!gatt.discoverServices()) throw IOException("GATT service discovery did not start")
                discovered.await()
                val snapshots = gatt.services.orEmpty().map { svc ->
                    DiscoveredGattService(
                        uuid = svc.uuid,
                        characteristics = svc.characteristics.orEmpty().map { c ->
                            DiscoveredGattCharacteristic(c.uuid, c.properties)
                        },
                    )
                }
                val spec = chooseGattSpec(snapshots)
                    ?: throw IOException("no writable+notifying vendor GATT service found on ${device.address}")
                BtDebugLog.log(
                    BtDebugLog.Kind.GATT,
                    "Selected BLE GATT fallback ${spec.name}",
                    "svc=${spec.service} tx=${spec.write} rx=${spec.notify.joinToString()}",
                )
                spec
            }
        } catch (t: Throwable) {
            if (t is CancellationException && t !is kotlinx.coroutines.TimeoutCancellationException) throw t
            if (t is kotlinx.coroutines.TimeoutCancellationException) throw IOException("BLE GATT discovery timed out after ${TIMEOUT_MS}ms")
            throw t
        } finally {
            runCatching { gatt.disconnect() }
            runCatching { gatt.close() }
        }
    }

    private fun logDiscoveredServices(address: String, gatt: BluetoothGatt) {
        val services = gatt.services.orEmpty()
        BtDebugLog.log(BtDebugLog.Kind.GATT, "Discovered ${services.size} GATT service(s) on $address")
        for (svc in services) {
            val charCount = svc.characteristics.orEmpty().size
            BtDebugLog.log(BtDebugLog.Kind.UUID, "SVC $charCount chars", svc.uuid.toString())
            for (c in svc.characteristics.orEmpty()) {
                BtDebugLog.log(BtDebugLog.Kind.UUID, "  CHR [${describeProps(c.properties)}]", c.uuid.toString())
            }
        }
    }

    private fun describeProps(props: Int): String = buildList {
        if ((props and BluetoothGattCharacteristic.PROPERTY_READ) != 0) add("R")
        if ((props and BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) add("W")
        if ((props and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) add("WNR")
        if ((props and BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0) add("N")
        if ((props and BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) add("I")
    }.joinToString(",").ifEmpty { "0x%x".format(props) }
}
