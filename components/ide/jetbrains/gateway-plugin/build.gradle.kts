// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

import io.gitlab.arturbosch.detekt.Detekt
import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

fun properties(key: String) = project.findProperty(key).toString()

plugins {
    // Java support
    id("java")
    // Kotlin support - check the latest version at https://plugins.gradle.org/plugin/org.jetbrains.kotlin.jvm
    id("org.jetbrains.kotlin.jvm") version "1.7.20"
    // gradle-intellij-plugin - read more: https://github.com/JetBrains/gradle-intellij-plugin
    id("org.jetbrains.intellij") version "1.9.0"
    // gradle-changelog-plugin - read more: https://github.com/JetBrains/gradle-changelog-plugin
    id("org.jetbrains.changelog") version "1.1.2"
    // detekt linter - read more: https://detekt.github.io/detekt/gradle.html
    id("io.gitlab.arturbosch.detekt") version "1.17.1"
    // ktlint linter - read more: https://github.com/JLLeitschuh/ktlint-gradle
    id("org.jlleitschuh.gradle.ktlint") version "10.0.0"
    // Gradle Properties Plugin - read more: https://github.com/stevesaliman/gradle-properties-plugin
    id("net.saliman.properties") version "1.5.2"
}

group = properties("pluginGroup")
val environmentName = properties("environmentName")
var pluginVersion = properties("pluginVersion")

if (environmentName.isNotBlank()) {
    pluginVersion += "-$environmentName"
}

project(":") {
    kotlin {
        val excludedPackage = if (environmentName == "latest") "stable" else "latest"
        sourceSets["main"].kotlin.exclude("io/gitpod/jetbrains/gateway/${excludedPackage}/**")
    }

    sourceSets {
        main {
            resources.srcDirs("src/main/resources-${environmentName}")
        }
    }
}

// Configure project's dependencies
repositories {
    mavenCentral()
}
dependencies {
    implementation(project(":gitpod-protocol")) {
        artifact {
            type = "jar"
        }
    }
    compileOnly("javax.websocket:javax.websocket-api:1.1")
    compileOnly("org.eclipse.jetty.websocket:websocket-api:9.4.44.v20210927")
    testImplementation(kotlin("test"))
    detektPlugins("io.gitlab.arturbosch.detekt:detekt-formatting:1.18.1")
}

// Configure gradle-intellij-plugin plugin.
// Read more: https://github.com/JetBrains/gradle-intellij-plugin
intellij {
    pluginName.set(properties("pluginName"))
    version.set(properties("platformVersion"))
    type.set(properties("platformType"))
    downloadSources.set(properties("platformDownloadSources").toBoolean())
    updateSinceUntilBuild.set(true)
    instrumentCode.set(false)

    // Plugin Dependencies. Uses `platformPlugins` property from the gradle.properties file.
    plugins.set(properties("platformPlugins").split(',').map(String::trim).filter(String::isNotEmpty))
}

// Configure gradle-changelog-plugin plugin.
// Read more: https://github.com/JetBrains/gradle-changelog-plugin
changelog {
    version = pluginVersion
    groups = emptyList()
}

// Configure detekt plugin.
// Read more: https://detekt.github.io/detekt/kotlindsl.html
detekt {
    autoCorrect = true
    buildUponDefaultConfig = true

    reports {
        html.enabled = false
        xml.enabled = false
        txt.enabled = false
    }
}

tasks {
    // JetBrains Gateway 2022.3+ requires Source Compatibility set to 17.
    // Set the compatibility versions to 1.8
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
        kotlinOptions.freeCompilerArgs = listOf("-Xjvm-default=enable")
    }

    withType<Detekt> {
        jvmTarget = "17"
    }

    buildSearchableOptions {
        enabled = false
    }

    test {
        useJUnitPlatform()
    }

    patchPluginXml {
        version.set(pluginVersion)
        sinceBuild.set(properties("pluginSinceBuild"))
        untilBuild.set(properties("pluginUntilBuild"))

        // Extract the <!-- Plugin description --> section from README.md and provide for the plugin's manifest
        pluginDescription.set(
            File(projectDir, "README.md").readText().lines().run {
                val start = "<!-- Plugin description -->"
                val end = "<!-- Plugin description end -->"

                if (!containsAll(listOf(start, end))) {
                    throw GradleException("Plugin description section not found in README.md:\n$start ... $end")
                }
                subList(indexOf(start) + 1, indexOf(end))
            }.joinToString("\n").run { markdownToHTML(this) }
        )

        // Get the latest available change notes from the changelog file
        changeNotes.set(provider { changelog.getLatest().toHTML() })
    }

    runPluginVerifier {
        ideVersions.set(properties("pluginVerifierIdeVersions").split(',').map(String::trim).filter(String::isNotEmpty))
    }

    publishPlugin {
        token.set(System.getenv("JB_MARKETPLACE_PUBLISH_TOKEN"))
        // pluginVersion is based on the SemVer (https://semver.org) and supports pre-release labels, like 2.1.7-alpha.3
        // Specify pre-release label to publish the plugin in a custom Release Channel automatically. Read more:
        // https://plugins.jetbrains.com/docs/intellij/deployment.html#specifying-a-release-channel
        var pluginChannel: String? = System.getenv("JB_GATEWAY_GITPOD_PLUGIN_CHANNEL")
        if (pluginChannel.isNullOrBlank()) {
            pluginChannel = if (pluginVersion.contains("-main.")) {
                "Stable"
            } else {
                "Dev"
            }
        }
        channels.set(listOf(pluginChannel))
    }

    register("buildFromLeeway") {
        if ("true" == System.getenv("DO_PUBLISH")) {
            dependsOn("publishPlugin")
        } else {
            dependsOn("buildPlugin")
        }
    }
}
