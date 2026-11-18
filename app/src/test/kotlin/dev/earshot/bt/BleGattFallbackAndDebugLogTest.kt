package dev.earshot.bt

import org.junit.After
import org.junit.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BleGattFallbackAndDebugLogTest {

    @After
    fun cleanLog() {
        BtDebugLog.clear()
    }

    @Test
    fun `LeGatt preference round-trips and appears in candidate order when GATT fallback is enabled`() {
        assertEquals(BmapCandidate.LeGatt, BmapCandidate.fromPref(BmapCandidate.PREF_LE_GATT))
        val order = BmapCandidates.order(
            learned = null,
            guessedChannel = 2,
            hasClassic = true,
            hasLe = true,
            preferLe = false,
            hasLeGattFallback = true,
        )
        val cocIdx = order.indexOf(BmapCandidate.LeCoc)
        val gattIdx = order.indexOf(BmapCandidate.LeGatt)
        assertTrue(cocIdx >= 0 && gattIdx > cocIdx, "LeGatt should follow LeCoc: $order")
    }

    @Test
    fun `learned LeGatt leads LE candidates when GATT fallback is enabled`() {
        val order = BmapCandidates.order(
            learned = BmapCandidate.LeGatt,
            guessedChannel = 2,
            hasClassic = true,
            hasLe = true,
            preferLe = true,
            hasLeGattFallback = true,
        )
        assertEquals(BmapCandidate.LeGatt, order.first(), "learned LeGatt should lead when preferLe=true: $order")
    }

    @Test
    fun `chooseGattSpec prefers Bose 0xFEBE service and skips standard SIG and firmware OTA services`() {
        val batterySvc = DiscoveredGattService(
            UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb"),
            listOf(
                DiscoveredGattCharacteristic(UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb"), GattTransport.PROPERTY_NOTIFY or GattTransport.PROPERTY_WRITE),
            ),
        )
        val otaSvc = DiscoveredGattService(
            UUID.fromString("0000fe66-0000-1000-8000-00805f9b34fb"),
            listOf(
                DiscoveredGattCharacteristic(UUID.fromString("66660001-0000-1000-8000-00805f9b34fb"), GattTransport.PROPERTY_WRITE),
                DiscoveredGattCharacteristic(UUID.fromString("66660002-0000-1000-8000-00805f9b34fb"), GattTransport.PROPERTY_NOTIFY),
            ),
        )
        val boseTx = UUID.fromString("c65b8f2a-1111-2222-3333-444455556666")
        val boseRx = UUID.fromString("c65b8f2b-1111-2222-3333-444455556666")
        val febeSvc = DiscoveredGattService(
            BmapPsmReader.SERVICE,
            listOf(
                DiscoveredGattCharacteristic(BmapPsmReader.PSM_CHARACTERISTIC, 0x02),
                DiscoveredGattCharacteristic(boseTx, GattTransport.PROPERTY_WRITE_NO_RESPONSE),
                DiscoveredGattCharacteristic(boseRx, GattTransport.PROPERTY_NOTIFY),
            ),
        )
        val chosen = assertNotNull(BmapPsmReader.chooseGattSpec(listOf(batterySvc, otaSvc, febeSvc)))
        assertEquals(BmapPsmReader.SERVICE, chosen.service)
        assertEquals(boseTx, chosen.write)
        assertEquals(listOf(boseRx), chosen.notify)
        assertEquals(false, chosen.writeWithResponse)
    }

    @Test
    fun `chooseGattSpec falls back to custom vendor write+notify service when 0xFEBE lacks TX or RX`() {
        val vendorSvc = UUID.fromString("d4400001-b5a3-f393-e0a9-e50e24dcca9e")
        val tx = UUID.fromString("d4400002-b5a3-f393-e0a9-e50e24dcca9e")
        val rx = UUID.fromString("d4400003-b5a3-f393-e0a9-e50e24dcca9e")
        val chosen = assertNotNull(
            BmapPsmReader.chooseGattSpec(
                listOf(
                    DiscoveredGattService(
                        BmapPsmReader.SERVICE,
                        listOf(DiscoveredGattCharacteristic(BmapPsmReader.PSM_CHARACTERISTIC, 0x02)),
                    ),
                    DiscoveredGattService(
                        vendorSvc,
                        listOf(
                            DiscoveredGattCharacteristic(tx, GattTransport.PROPERTY_WRITE),
                            DiscoveredGattCharacteristic(rx, GattTransport.PROPERTY_INDICATE),
                        ),
                    ),
                ),
            ),
        )
        assertEquals(vendorSvc, chosen.service)
        assertEquals(tx, chosen.write)
        assertEquals(listOf(rx), chosen.notify)
        assertEquals(true, chosen.writeWithResponse)
    }

    @Test
    fun `chooseGattSpec returns null when only SIG or firmware OTA services exist`() {
        val gapSvc = DiscoveredGattService(
            UUID.fromString("00001800-0000-1000-8000-00805f9b34fb"),
            listOf(DiscoveredGattCharacteristic(UUID.fromString("00002a00-0000-1000-8000-00805f9b34fb"), GattTransport.PROPERTY_WRITE or GattTransport.PROPERTY_NOTIFY)),
        )
        assertNull(BmapPsmReader.chooseGattSpec(listOf(gapSvc)))
    }

    @Test
    fun `BtDebugLog captures UUIDs, TX and RX hex payloads and clears cleanly`() {
        BtDebugLog.clear()
        BtDebugLog.log(BtDebugLog.Kind.UUID, "SVC 2 chars", BmapPsmReader.SERVICE.toString())
        BtDebugLog.tx("BMAP", byteArrayOf(0x00, 0x05, 0x01, 0x00))
        BtDebugLog.rx("BMAP", byteArrayOf(0x00, 0x05, 0x03, 0x02, 0x0a, 0x64))

        val entries = BtDebugLog.entries.value
        assertEquals(3, entries.size)
        assertEquals(BtDebugLog.Kind.UUID, entries[0].kind)
        assertTrue(entries[0].detail!!.contains("0000febe"))
        assertEquals("00050100", entries[1].detail)
        assertEquals("000503020a64", entries[2].detail)

        val formatted = BtDebugLog.formatAll(entries)
        assertTrue(formatted.contains("[TX]") && formatted.contains("00050100"))
        assertTrue(formatted.contains("[RX]") && formatted.contains("000503020a64"))

        BtDebugLog.clear()
        assertTrue(BtDebugLog.entries.value.isEmpty())
    }
}
