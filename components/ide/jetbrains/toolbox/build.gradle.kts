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
    // Java specific dependencies.
    implementation("com.connectrpc:connect-kotlin-google-java-ext:0.6.0")
    implementation("com.google.protobuf:protobuf-java:4.26.0")

    implementation(libs.gateway.api)
    implementation(libs.slf4j)
    implementation(libs.bundles.serialization)
    implementation(libs.coroutines.core)
    implementation(libs.okhttp)
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

val pluginId = "io.gitpod.toolbox.gateway"
val pluginVersion = "0.0.1"

val assemblePlugin by tasks.registering(Jar::class) {
    archiveBaseName.set(pluginId)
    from(sourceSets.main.get().output)
}

val copyPlugin by tasks.creating(Sync::class.java) {
    dependsOn(assemblePlugin)

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

    from(assemblePlugin.get().outputs.files)

    from("src/main/resources") {
        include("extension.json")
        include("dependencies.json")
        include("icon.svg")
    }

    into(targetDir)
}

val pluginZip by tasks.creating(Zip::class) {
    dependsOn(assemblePlugin)

    from(assemblePlugin.get().outputs.files)
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
        val instance = PluginRepositoryFactory.create("https://plugins.jetbrains.com", project.property("pluginMarketplaceToken").toString())

        // first upload
        // instance.uploader.uploadNewPlugin(pluginZip.outputs.files.singleFile, listOf("toolbox", "gateway"), LicenseUrl.APACHE_2_0, ProductFamily.TOOLBOX)

        // subsequent updates
        instance.uploader.upload("dev.kropp.toolbox.sample", pluginZip.outputs.files.singleFile)
    }
}
