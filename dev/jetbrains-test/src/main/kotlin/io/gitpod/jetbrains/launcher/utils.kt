package io.gitpod.jetbrains.launcher

import java.nio.file.*
import java.nio.file.attribute.BasicFileAttributes
import java.util.stream.Collectors

fun extractTar(tarFile: Path, to: Path): List<Path> {
    return getCreatedFilesAfter(to) {
        check(
            ProcessBuilder()
                .command("which", "tar")
                .start()
                .waitFor() == 0
        ) { "tar binary is not found" }
        check(
            ProcessBuilder()
                .command(
                    "tar", "xzf",
                    tarFile.toAbsolutePath().toString(),
                    "-C", to.toAbsolutePath().toString()
                )
                .start()
                .waitFor() == 0
        ) { "failed to extract $tarFile" }
    }
}

fun extractZip(zip: Path, to: Path): List<Path> {
    return getCreatedFilesAfter(to) {
        FileSystems.newFileSystem(zip, null).use { fs ->
            val root = fs.getPath("/")
            Files.walkFileTree(root, object : SimpleFileVisitor<Path>() {
                override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes?): FileVisitResult {
                    if (root != dir) {
                        val targetDir = to.resolve(root.relativize(dir).toString())
                        Files.copy(dir, targetDir)
                    }
                    return FileVisitResult.CONTINUE
                }

                override fun visitFile(file: Path, attrs: BasicFileAttributes?): FileVisitResult {
                    val targetFile = to.resolve(root.relativize(file).toString())
                    Files.copy(file, targetFile)
                    return FileVisitResult.CONTINUE
                }
            })
        }
    }
}

fun extractDmgApp(dmg: Path, to: Path): Path {
    check(Files.exists(dmg)) { "dmg is not exists" }
    check(Files.exists(to)) { "target directory is not exists" }
    check(ProcessBuilder().command("which", "hdiutil").start().waitFor() == 0)
    check(
        ProcessBuilder()
            .command("hdiutil", "verify", dmg.toAbsolutePath().toString())
            .start()
            .waitFor() == 0
    ) { "${dmg.toAbsolutePath()} is not valid disk image" }

    val mountPoint: Path = Paths.get(to.toAbsolutePath().toString(), "mnt")
    if (!Files.exists(mountPoint)) Files.createDirectory(mountPoint)
    check(
        ProcessBuilder()
            .command(
                "hdiutil",
                "attach", dmg.toAbsolutePath().toString(),
                "-mountpoint", mountPoint.toString(),
                "-noautoopen",
                "-nobrowse"
            )
            .inheritIO()
            .start()
            .waitFor() == 0
    ) { "failed to mount $dmg to $mountPoint" }

    val mounted: Path =
        Files.list(mountPoint).filter { it.fileName.toString().endsWith(".app") }.findFirst().orElseThrow {
            IllegalStateException("ide app is not found")
        }
    val app: Path = Paths.get(to.toAbsolutePath().toString(), mounted.fileName.toString())

    check(
        ProcessBuilder().command(
            "cp",
            "-R",
            mounted.toAbsolutePath().toString(),
            app.toAbsolutePath().toString()
        ).inheritIO().start().waitFor() == 0
    ) { "failed to copy ide app from mounted .dmg" }

    check(
        ProcessBuilder()
            .command(
                "hdiutil",
                "detach", mountPoint.toString(),
                "-force"
            )
            .inheritIO()
            .start()
            .waitFor() == 0
    ) { "failed to unmount $mountPoint" }

    Files.delete(mountPoint)

    return app
}

private fun getCreatedFilesAfter(dir: Path, action: () -> Unit): List<Path> {
    val dirContentBefore = Files.list(dir).collect(Collectors.toList())
    action()
    return Files.list(dir).filter { !dirContentBefore.contains(it) }.collect(Collectors.toList())
}
