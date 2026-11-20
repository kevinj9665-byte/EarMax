package dev.earshot.arch

import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Shizuku ships in the unified GitHub build (`src/main`, no play/foss flavor split):
 *  - non-adapter code (everything outside the `codec/shizuku`, `Shizuku*` and `PrivilegedCodecRoute`
 *    adapter boundary) never directly names `rikka.shizuku`, `moe.shizuku`, or `dev.earshot.codec.shizuku`;
 *  - the UI strings that mention Shizuku exist in `src/main/res/values`.
 */
class ShizukuBoundaryTest {

    // Gradle runs unit tests with the module directory as the working directory.
    private val main = File("src/main")

    private val shizukuAdapterPaths = setOf(
        "kotlin/dev/earshot/call/ShizukuPrivilegedShell.kt",
        "kotlin/dev/earshot/codec/PrivilegedCodecRoute.kt",
        "kotlin/dev/earshot/codec/ShizukuPrivilege.kt",
        "kotlin/dev/earshot/codec/ShizukuShell.kt",
        "aidl/dev/earshot/codec/shizuku/ICodecService.aidl",
    )

    private fun isShizukuAdapter(file: File): Boolean {
        val rel = file.relativeTo(main).invariantSeparatorsPath
        return rel in shizukuAdapterPaths || rel.startsWith("kotlin/dev/earshot/codec/shizuku/")
    }

    /** The library's packages and the adapter classes that isolate Shizuku behind PrivilegedCodecAccess / PrivilegedShell. */
    private val shizukuCode = Regex(
        """\brikka\.shizuku\b|\bmoe\.shizuku\b|\bdev\.earshot\.codec\.shizuku\b""" +
            """|\b(?:ShizukuShell|ShizukuPrivilege|ShizukuCodecAccess|CodecServiceClient|CodecUserService|ICodecService|A2dpAidlCalls|A2dpBinderLocator)\b""",
    )

    private fun isComment(line: String): Boolean = line.trim().let { it.startsWith("*") || it.startsWith("//") || it.startsWith("/*") }

    private fun codeFiles(dir: File): List<File> =
        dir.walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java", "aidl") }.toList()

    private fun offenders(dir: File): List<String> = codeFiles(dir)
        .filterNot(::isShizukuAdapter)
        .flatMap { file ->
            file.readLines().withIndex()
                .filter { (_, line) -> !isComment(line) && shizukuCode.containsMatchIn(line) }
                .map { (i, line) -> "${file.invariantSeparatorsPath}:${i + 1}: ${line.trim()}" }
        }

    /** name → text of every `<string>` in the `values` files under [res]. */
    private fun strings(res: File): Map<String, String> {
        val values = File(res, "values")
        if (!values.isDirectory) return emptyMap()
        return values.listFiles { f -> f.extension == "xml" }.orEmpty().flatMap { file ->
            val root = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file).documentElement
            val nodes = root.getElementsByTagName("string")
            (0 until nodes.length).map { (nodes.item(it) as Element).let { e -> e.getAttribute("name") to e.textContent } }
        }.toMap()
    }

    @Test fun `the scan sees the sources`() {
        assertTrue(File(main, "kotlin/dev/earshot/codec/CodecRepositoryImpl.kt").isFile, "run from the app module directory (${File(".").absolutePath})")
        assertTrue(File(main, "kotlin/dev/earshot/codec/PrivilegedCodecRoute.kt").isFile)
        assertTrue(File(main, "kotlin/dev/earshot/call/ShizukuPrivilegedShell.kt").isFile)
    }

    @Test fun `the rule finds Shizuku code and passes the seam`() {
        for (line in listOf(
            "import rikka.shizuku.Shizuku",
            "import dev.earshot.codec.shizuku.CodecServiceClient",
            "ShizukuPrivilege.current(context)",
            "private val shell = ShizukuShell()",
        )) assertTrue(shizukuCode.containsMatchIn(line), line)
        for (line in listOf(
            "dev.earshot.call.ShizukuPrivilegedShell(appContext)",
            "private val privileged: PrivilegedCodecAccess = PrivilegedCodecRoute.create(context)",
        )) assertTrue(!shizukuCode.containsMatchIn(line), line)
    }

    @Test fun `non-adapter code never names Shizuku's library or classes`() {
        val found = offenders(main)
        assertTrue(found.isEmpty(), "keep Shizuku behind PrivilegedCodecAccess / PrivilegedShell:\n" + found.joinToString("\n"))
    }

    @Test fun `Shizuku strings remain present in main resources`() {
        val shared = strings(File(main, "res")).filterValues { it.contains("Shizuku", ignoreCase = true) }
        assertTrue(shared.isNotEmpty(), "expected Shizuku strings in src/main/res/values")
    }
}
