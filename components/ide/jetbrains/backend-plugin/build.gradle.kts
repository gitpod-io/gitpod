// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

import io.gitlab.arturbosch.detekt.Detekt
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

fun properties(key: String) = project.findProperty(key).toString()

plugins {
    // Java support
    id("java")
    // Kotlin support - check the latest version at https://plugins.gradle.org/plugin/org.jetbrains.kotlin.jvm
    id("org.jetbrains.kotlin.jvm") version "2.0.0"
    // gradle-intellij-plugin - read more: https://github.com/JetBrains/gradle-intellij-plugin
    id("org.jetbrains.intellij.platform") version "2.0.0-beta8"
//    id("org.jetbrains.intellij.platform.migration") version "2.0.0-beta7"
    // detekt linter - read more: https://detekt.github.io/detekt/gradle.html
    id("io.gitlab.arturbosch.detekt") version "1.23.6"
    // ktlint linter - read more: https://github.com/JLLeitschuh/ktlint-gradle
    id("org.jlleitschuh.gradle.ktlint") version "12.1.1"
    // Gradle Properties Plugin - read more: https://github.com/stevesaliman/gradle-properties-plugin
    id("net.saliman.properties") version "1.5.2"
}

group = properties("pluginGroup")
val environmentName = properties("environmentName")
var pluginVersion = "${properties("pluginVersion")}-${properties("gitpodVersion")}"

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

    // grpc
    // https://mvnrepository.com/artifact/com.google.api.grpc/proto-google-common-protos
    implementation("com.google.api.grpc:proto-google-common-protos:2.41.0")
    implementation("io.grpc:grpc-core:1.65.0")
    implementation("io.grpc:grpc-protobuf:1.65.0")
    // https://mvnrepository.com/artifact/io.grpc/grpc-stub
    implementation("io.grpc:grpc-stub:1.65.0")
    implementation("io.grpc:grpc-netty-shaded:1.65.0")
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        create(properties("platformType"), properties("platformVersion"))

        // Plugin Dependencies. Uses `platformBundledPlugins` property from the gradle.properties file for bundled IntelliJ Platform plugins.
        bundledPlugins(properties("platformBundledPlugins").split(',').map{ it.trim() })
    }
}

// Configure gradle-intellij-plugin plugin.
// Read more: https://github.com/JetBrains/gradle-intellij-plugin
intellijPlatform {
    pluginConfiguration {
        name = properties("pluginName")
        version = pluginVersion
        ideaVersion {
            sinceBuild = properties("pluginSinceBuild")
            untilBuild = properties("pluginUntilBuild")
        }
    }
    instrumentCode = false

}

// Configure detekt plugin.
// Read more: https://detekt.github.io/detekt/kotlindsl.html
detekt {
    autoCorrect = true
    buildUponDefaultConfig = true
    ignoreFailures = true

//    reports {
//        html.enabled = false
//        xml.enabled = false
//        txt.enabled = false
//    }
}

ktlint {
    ignoreFailures = true
    filter {
        exclude("build.gradle-*.kts")
    }
}

kotlin {
    jvmToolchain(21)
}

tasks.withType<Detekt> {
    jvmTarget = "21"
    onlyIf { project.findProperty("skipDetekt") != "true" }
}

tasks {
    withType<JavaCompile> {
        sourceCompatibility = "21"
        targetCompatibility = "21"
    }
    withType<KotlinCompile> {
        kotlinOptions.jvmTarget = "21"
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
}

tasks.register("runPluginVerifier") {
    intellijPlatform.verifyPlugin.ides.ide(IntelliJPlatformType.IntellijIdeaUltimate, properties("pluginVerifierIdeVersions"))
}
