package io.gitpod.toolbox.components

import io.gitpod.toolbox.gateway.GitpodGatewayExtension

@Suppress("FunctionName")
fun GitpodIcon(): ByteArray {
    return GitpodGatewayExtension::class.java.getResourceAsStream("/icon.svg")?.readAllBytes() ?: byteArrayOf()
}

