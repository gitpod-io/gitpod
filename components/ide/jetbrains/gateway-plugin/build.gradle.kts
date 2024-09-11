// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import io.gitlab.arturbosch.detekt.Detekt
import org.jetbrains.changelog.Changelog
import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

fun properties(key: String) = project.findProperty(key).toString()

plugins {
    // Java support
    id("java")
    // Kotlin support - check the latest version at https://plugins.gradle.org/plugin/org.jetbrains.kotlin.jvm
    id("org.jetbrains.kotlin.jvm") version "2.0.0"
    // gradle-intellij-plugin - read more: https://github.com/JetBrains/gradle-intellij-plugin
    id("org.jetbrains.intellij.platform") version "2.0.1"
//    id("org.jetbrains.intellij.platform.migration") version "2.0.1"
    // gradle-changelog-plugin - read more: https://github.com/JetBrains/gradle-changelog-plugin
    id("org.jetbrains.changelog") version "1.1.2"
    // detekt linter - read more: https://detekt.github.io/detekt/gradle.html
    id("io.gitlab.arturbosch.detekt") version "1.23.6"
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

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
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
    // https://mvnrepository.com/artifact/org.eclipse.jetty.websocket/javax-websocket-client-impl
    implementation("org.eclipse.jetty.websocket:javax-websocket-client-impl:9.4.44.v20210927")
}

dependencies {
    intellijPlatform {
        // https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-dependencies-extension.html#target-platforms
        // https://www.jetbrains.com/updates/updates.xml
        create(IntelliJPlatformType.Gateway, properties("platformVersion"))
        bundledPlugins(properties("platformBundledPlugins").split(',').map{ it.trim() })
    }
}

// Configure gradle-intellij-plugin plugin.
intellijPlatform {
    pluginConfiguration {
        id = properties("pluginId")
        name = properties("latestPluginName")
        version = pluginVersion

        description = providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
            val start = "<!-- Plugin description -->"
            val end = "<!-- Plugin description end -->"

            with(it.lines()) {
                if (!containsAll(listOf(start, end))) {
                    throw GradleException("Plugin description section not found in README.md:\n$start ... $end")
                }
                subList(indexOf(start) + 1, indexOf(end)).joinToString("\n").let(::markdownToHTML)
            }
        }

        changeNotes = changelog.getLatest().toHTML()

        ideaVersion {
            sinceBuild = properties("pluginSinceBuild")
            untilBuild = properties("pluginUntilBuild")
        }
    }

    pluginVerification {
        ides {
            properties("pluginVerifierIdeVersions").split(',').map(String::trim).forEach { version ->
                ide(IntelliJPlatformType.Gateway, version)
            }
        }
    }

    publishing {
        token = providers.environmentVariable("JB_MARKETPLACE_PUBLISH_TOKEN").getOrElse("")
        var pluginChannels = providers.environmentVariable("JB_GATEWAY_GITPOD_PLUGIN_CHANNEL").getOrElse("")
        if (pluginChannels.isBlank()) {
            pluginChannels = if (pluginVersion.contains("-main-gha.")) {
                "Stable"
            } else {
                "Dev"
            }
        }
        channels = listOf(pluginChannels)
    }
    instrumentCode = false
}

changelog {
    version = pluginVersion
    groups = emptyList()
}

// Configure detekt plugin.
// Read more: https://detekt.github.io/detekt/kotlindsl.html
detekt {
    autoCorrect = true
    buildUponDefaultConfig = true
}

tasks.withType<Detekt> {
    jvmTarget = "21"
}

tasks.withType<KotlinCompile> {
    kotlinOptions.jvmTarget = "21"
}

tasks.withType<JavaCompile> {
    sourceCompatibility = "21"
    targetCompatibility = "21"
}

tasks {

    buildSearchableOptions {
        enabled = false
    }

    test {
        useJUnitPlatform()
    }

    register("buildFromLeeway") {
        if ("true" == System.getenv("DO_PUBLISH")) {
            print("publishing $pluginVersion...")
            dependsOn("publishPlugin")
        } else {
            print("building $pluginVersion...")
            dependsOn("buildPlugin")
        }
    }
}
