// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

import io.gitlab.arturbosch.detekt.Detekt
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

fun properties(key: String) = project.findProperty(key).toString()

plugins {
    // Java support
    id("java")
    // Kotlin support - check the latest version at https://plugins.gradle.org/plugin/org.jetbrains.kotlin.jvm
    id("org.jetbrains.kotlin.jvm") version "1.7.20"
    // gradle-intellij-plugin - read more: https://github.com/JetBrains/gradle-intellij-plugin
    id("org.jetbrains.intellij") version "1.9.0"
    // detekt linter - read more: https://detekt.github.io/detekt/gradle.html
    id("io.gitlab.arturbosch.detekt") version "1.21.0"
    // ktlint linter - read more: https://github.com/JLLeitschuh/ktlint-gradle
    id("org.jlleitschuh.gradle.ktlint") version "11.0.0"
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
        sourceSets["main"].kotlin.exclude("io/gitpod/jetbrains/remote/${excludedPackage}/**")
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
    implementation(project(":supervisor-api")) {
        artifact {
            type = "jar"
        }
    }
    implementation(project(":gitpod-protocol")) {
        artifact {
            type = "jar"
        }
    }
    implementation("io.prometheus:simpleclient_pushgateway:0.15.0")
    compileOnly("javax.websocket:javax.websocket-api:1.1")
    detektPlugins("io.gitlab.arturbosch.detekt:detekt-formatting:1.18.1")
    testImplementation(kotlin("test"))
}

// Configure gradle-intellij-plugin plugin.
// Read more: https://github.com/JetBrains/gradle-intellij-plugin
intellij {
    pluginName.set(properties("pluginName"))
    version.set(properties("platformVersion"))
    type.set(properties("platformType"))
    instrumentCode.set(false)
    downloadSources.set(properties("platformDownloadSources").toBoolean())
    updateSinceUntilBuild.set(true)

    // Plugin Dependencies. Uses `platformPlugins` property from the gradle.properties file.
    plugins.set(properties("platformPlugins").split(',').map(String::trim).filter(String::isNotEmpty))
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
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    withType<Detekt> {
        jvmTarget = "17"
    }

    buildSearchableOptions {
        enabled = false
    }

    test {
        // Currently, we need to indicate where are the test classes.
        // Read more: https://youtrack.jetbrains.com/issue/IDEA-278926/All-inheritors-of-UsefulTestCase-are-invisible-for-Gradle#focus=Comments-27-5561012.0-0
        isScanForTestClasses = false
        include("**/*Test.class")
    }

    runPluginVerifier {
        ideVersions.set(properties("pluginVerifierIdeVersions").split(',').map(String::trim).filter(String::isNotEmpty))
    }

    patchPluginXml {
        version.set(pluginVersion)
    }
}
