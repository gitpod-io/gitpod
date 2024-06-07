// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

plugins {
    // Apply the java-library plugin for API and implementation separation.
    `java-library`
    id("org.jetbrains.kotlin.jvm") version "1.9.0"
}

repositories {
    // Use Maven Central for resolving dependencies.
    mavenCentral()
}

dependencies {
    // This dependency is exported to consumers, that is to say found on their compile classpath.
    api("org.apache.commons:commons-math3:3.6.1")

    // This dependency is used internally, and not exposed to consumers on their own compile classpath.
    implementation("com.google.guava:guava:32.1.1-jre")

    // connect rpc dependencies
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.connectrpc:connect-kotlin-okhttp:0.6.0")
    // Java specific dependencies.
    implementation("com.connectrpc:connect-kotlin-google-java-ext:0.6.0")
    implementation("com.google.protobuf:protobuf-java:4.26.0")
    implementation(kotlin("stdlib-jdk8"))

}

// Apply a specific Java toolchain to ease working on different environments.
java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(11))
    }
}
