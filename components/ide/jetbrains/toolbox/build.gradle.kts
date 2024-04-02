import com.github.jk1.license.filter.ExcludeTransitiveDependenciesFilter
import com.github.jk1.license.render.JsonReportRenderer
import org.jetbrains.intellij.pluginRepository.PluginRepositoryFactory
import org.jetbrains.kotlin.com.intellij.openapi.util.SystemInfoRt
import java.nio.file.Path
import kotlin.io.path.div

plugins {
    alias(libs.plugins.kotlin)
    alias(libs.plugins.serialization)
    `java-library`
    alias(libs.plugins.dependency.license.report)
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

buildscript {
    dependencies {
        classpath(libs.marketplace.client)
    }
}

repositories {
    mavenCentral()
    maven("https://packages.jetbrains.team/maven/p/tbx/gateway")
}

dependencies {
    implementation(project(":supervisor-api"))
    implementation(project(":gitpod-publicapi"))

    // connect rpc dependencies
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.connectrpc:connect-kotlin-okhttp:0.6.0")
    implementation("com.connectrpc:connect-kotlin:0.6.0")
    // Java specific dependencies.
    implementation("com.connectrpc:connect-kotlin-google-java-ext:0.6.0")
    implementation("com.google.protobuf:protobuf-java:4.26.0")
    // WebSocket
    compileOnly("javax.websocket:javax.websocket-api:1.1")
    compileOnly("org.eclipse.jetty.websocket:websocket-api:9.4.54.v20240208")
    implementation("org.eclipse.jetty.websocket:javax-websocket-client-impl:9.4.54.v20240208")
    // RD-Core
    implementation("com.jetbrains.rd:rd-core:2024.1.1")

    implementation(libs.gateway.api)
    implementation(libs.slf4j)
    implementation(libs.bundles.serialization)
    implementation(libs.coroutines.core)
    implementation(libs.okhttp)
}


val pluginId = "io.gitpod.toolbox.gateway"
val pluginVersion = "0.0.1"

tasks.shadowJar {
    archiveBaseName.set(pluginId)
    archiveVersion.set(pluginVersion)

    val excludedGroups = listOf(
        "com.jetbrains.toolbox.gateway",
        "com.jetbrains",
        "org.jetbrains",
        "com.squareup.okhttp3",
        "org.slf4j",
        "org.jetbrains.intellij",
        "com.squareup.okio",
        "kotlin."
    )

    val includeGroups = listOf(
        "com.jetbrains.rd"
    )

    dependencies {
        exclude {
            excludedGroups.any { group ->
                if (includeGroups.any { includeGroup -> it.name.startsWith(includeGroup) }) {
                    return@any false
                }
                it.name.startsWith(group)
            }
        }
    }
}

licenseReport {
    renderers = arrayOf(JsonReportRenderer("dependencies.json"))
    filters = arrayOf(ExcludeTransitiveDependenciesFilter())
    // jq script to convert to our format:
    // `jq '[.dependencies[] | {name: .moduleName, version: .moduleVersion, url: .moduleUrl, license: .moduleLicense, licenseUrl: .moduleLicenseUrl}]' < build/reports/dependency-license/dependencies.json > src/main/resources/dependencies.json`
}

tasks.compileKotlin {
    kotlinOptions.freeCompilerArgs += listOf(
        "-opt-in=kotlinx.serialization.ExperimentalSerializationApi",
    )
}

val restartToolbox by tasks.creating {
    group = "01.Gitpod"
    description = "Restarts the JetBrains Toolbox app."

    doLast {
        when {
            SystemInfoRt.isMac -> {
                exec {
                    commandLine("sh", "-c", "pkill -f 'JetBrains Toolbox' || true")
                }
                Thread.sleep(3000)
                exec {
                    commandLine("sh", "-c", "echo debugClean > ~/Library/Logs/JetBrains/Toolbox/toolbox.log")
                }
                exec {
                    commandLine("open", "/Applications/JetBrains Toolbox.app")
                }
            }
            else -> {
                println("restart Toolbox to make plugin works.")
            }
        }
    }
}

val copyPlugin by tasks.creating(Sync::class.java) {
    group = "01.Gitpod"

    dependsOn(tasks.named("shadowJar"))
    from(tasks.named("shadowJar").get().outputs.files)

    val userHome = System.getProperty("user.home").let { Path.of(it) }
    val toolboxCachesDir = when {
        SystemInfoRt.isWindows -> System.getenv("LOCALAPPDATA")?.let { Path.of(it) } ?: (userHome / "AppData" / "Local")
        // currently this is the location that TBA uses on Linux
        SystemInfoRt.isLinux -> System.getenv("XDG_DATA_HOME")?.let { Path.of(it) } ?: (userHome / ".local" / "share")
        SystemInfoRt.isMac -> userHome / "Library" / "Caches"
        else -> error("Unknown os")
    } / "JetBrains" / "Toolbox"

    val pluginsDir = when {
        SystemInfoRt.isWindows -> toolboxCachesDir / "cache"
        SystemInfoRt.isLinux || SystemInfoRt.isMac -> toolboxCachesDir
        else -> error("Unknown os")
    } / "plugins"

    val targetDir = pluginsDir / pluginId

    from("src/main/resources") {
        include("extension.json")
        include("dependencies.json")
        include("icon.svg")
    }

    into(targetDir)

    finalizedBy(restartToolbox)
}

val pluginZip by tasks.creating(Zip::class) {
    dependsOn(tasks.named("shadowJar"))
    from(tasks.named("shadowJar").get().outputs.files)

    from("src/main/resources") {
        include("extension.json")
        include("dependencies.json")
    }
    from("src/main/resources") {
        include("icon.svg")
        rename("icon.svg", "pluginIcon.svg")
    }
    archiveBaseName.set("$pluginId-$pluginVersion")
}

val uploadPlugin by tasks.creating {
    dependsOn(pluginZip)

    doLast {
        val instance = PluginRepositoryFactory.create(
            "https://plugins.jetbrains.com",
            project.property("pluginMarketplaceToken").toString()
        )

        // first upload
        // instance.uploader.uploadNewPlugin(pluginZip.outputs.files.singleFile, listOf("toolbox", "gateway"), LicenseUrl.APACHE_2_0, ProductFamily.TOOLBOX)

        // subsequent updates
        instance.uploader.upload(pluginId, pluginZip.outputs.files.singleFile)
    }
}
