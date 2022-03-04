package io.gitpod.jetbrains.launcher

enum class Os {
    WINDOWS, LINUX, MAC;

    companion object {
        fun hostOS(): Os {
            val osName = System.getProperty("os.name").lowercase()
            return when {
                osName.contains("win") -> WINDOWS
                osName.contains("mac") -> MAC
                osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> LINUX
                else -> throw Exception("Unknown operation system with name: \"$osName\"")
            }
        }
    }
}
