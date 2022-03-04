package io.gitpod.jetbrains.launcher

import com.automation.remarks.junit5.Video
import com.intellij.remoterobot.RemoteRobot
import com.intellij.remoterobot.fixtures.CommonContainerFixture
import com.intellij.remoterobot.fixtures.ComponentFixture
import com.intellij.remoterobot.search.locators.byXpath
import com.intellij.remoterobot.stepsProcessing.StepLogger
import com.intellij.remoterobot.stepsProcessing.StepWorker
import com.intellij.remoterobot.utils.Locators
import com.intellij.remoterobot.utils.hasSingleComponent
import com.intellij.remoterobot.utils.waitFor
import com.intellij.remoterobot.stepsProcessing.log
import okhttp3.OkHttpClient
import org.junit.jupiter.api.*
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.extension.ExtensionContext
import org.junit.jupiter.api.extension.TestWatcher
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.TimeUnit
import javax.imageio.ImageIO
import javax.swing.Box
import javax.swing.JDialog
import java.util.*
import java.util.prefs.Preferences

@Timeout(value = 25, unit = TimeUnit.MINUTES)
class GatewayLauncherTest {
    companion object {
        private var gatewayProcess: Process? = null
        private var tmpDir: Path = Files.createTempDirectory("launcher")
        private lateinit var remoteRobot: RemoteRobot

        @AfterAll
        @JvmStatic
        fun cleanUp() {
            gatewayProcess?.destroy()
            tmpDir.toFile().deleteRecursively()
        }
    }

    private fun setPreferences(key: String, value: String) {
        var prefs = Preferences.userRoot()
        val dotIndex = key.lastIndexOf('.')
        if (dotIndex > 0) {
            val tokenizer = StringTokenizer(key.substring(0, dotIndex), ".", false)
            while (tokenizer.hasMoreElements()) {
                val str = tokenizer.nextToken()
                prefs = prefs.node(str?.lowercase())
            }
        }
        val lastDotIndex = key.lastIndexOf('.')
        val nodeKey = (if (lastDotIndex >= 0) key.substring(lastDotIndex + 1) else key).lowercase()
        prefs.put(nodeKey, value)
    }

    @Test
    @Video
    fun test() {
        // bypass privacy_policy
        setPreferences("jetbrains.privacy_policy.accepted_version", "999.999")
        setPreferences("jetbrains.privacy_policy.cwmguesteua_accepted_version", "999.999")
        setPreferences("jetbrains.privacy_policy.ij_euaeap_accepted_version", "999.999")

        val gatewayLink = System.getProperty("gateway_link")
        val gatewayPluginPath = System.getProperty("gateway_plugin_path")
        if (gatewayPluginPath == null || gatewayPluginPath == "") {
            fail("please provider gateway plugin path")
        }
        if (gatewayLink == null || gatewayLink == "") {
            fail("please provider gateway link")
        }
        StepWorker.registerProcessor(StepLogger())

        val client = OkHttpClient()
        remoteRobot = RemoteRobot("http://localhost:8082", client)
        val ideDownloader = IdeDownloader(client)
        gatewayProcess = IdeLauncher.launchIde(
            ideDownloader.downloadAndExtractLatestEap(Ide.GATEWAY, tmpDir),
            mapOf("robot-server.port" to 8082),
            emptyList(),
            listOf(
                ideDownloader.downloadRobotPlugin(tmpDir),
                Path.of(gatewayPluginPath)
            ),
            tmpDir,
            listOf(gatewayLink)
        )
        waitFor(Duration.ofSeconds(90), Duration.ofSeconds(5)) {
            remoteRobot.isAvailable()
        }

        log.atInfo().log("remoteRobot available")
        Thread.sleep(1000 * 120)
    }
}

fun RemoteRobot.isAvailable(): Boolean = runCatching {
    callJs<Boolean>("true")
}.getOrDefault(false)