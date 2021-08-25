// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unsafe"

	cli "github.com/urfave/cli/v2"
	"golang.org/x/sys/unix"

	"github.com/gitpod-io/gitpod/common-go/log"
	_ "github.com/gitpod-io/gitpod/ws-daemon/nsinsider/pkg/nsenter"
)

func main() {
	app := &cli.App{
		Commands: []*cli.Command{
			{
				Name:  "move-mount",
				Usage: "calls move_mount with fd 3 to target",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "pipe-fd",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return syscallMoveMount(c.Int("pipe-fd"), "", unix.AT_FDCWD, c.String("target"), flagMoveMountFEmptyPath)
				},
			},
			{
				Name:  "open-tree",
				Usage: "opens a and writes the resulting mountfd to the Unix pipe on fd 3",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "pipe-fd",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					fd, err := syscallOpenTree(unix.AT_FDCWD, c.String("target"), flagOpenTreeClone|flagAtRecursive)
					if err != nil {
						return err
					}

					err = unix.Sendmsg(c.Int("pipe-fd"), nil, unix.UnixRights(int(fd)), nil, 0)
					if err != nil {
						return err
					}

					return nil
				},
			},
			{
				Name:  "make-shared",
				Usage: "makes a mount point shared",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount("none", c.String("target"), "", unix.MS_SHARED, "")
				},
			},
			{
				Name:  "mount-fusefs-mark",
				Usage: "mounts a fusefs mark",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "source",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "merged",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "upper",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "work",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "uidmapping",
						Required: false,
					},
					&cli.StringFlag{
						Name:     "gidmapping",
						Required: false,
					},
				},
				Action: func(c *cli.Context) error {
					target := filepath.Clean(c.String("merged"))
					upper := filepath.Clean(c.String("upper"))
					work := filepath.Clean(c.String("work"))
					source := filepath.Clean(c.String("source"))

					args := []string{
						fmt.Sprintf("lowerdir=%s,upperdir=%v,workdir=%v", source, upper, work),
					}

					if len(c.String("uidmapping")) > 0 {
						args = append(args, fmt.Sprintf("uidmapping=%v", c.String("uidmapping")))
					}

					if len(c.String("gidmapping")) > 0 {
						args = append(args, fmt.Sprintf("gidmapping=%v", c.String("gidmapping")))
					}

					cmd := exec.Command(
						fmt.Sprintf("%v/.supervisor/fuse-overlayfs", source),
						"-o",
						strings.Join(args, ","),
						"none",
						target,
					)
					cmd.Dir = source

					out, err := cmd.CombinedOutput()
					if err != nil {
						return xerrors.Errorf("fuse-overlayfs (%v) failed: %q\n%v",
							cmd.Args,
							string(out),
							err,
						)
					}

					return nil
				},
			},
			{
				Name:  "mount-shiftfs-mark",
				Usage: "mounts a shiftfs mark",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "source",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount(c.String("source"), c.String("target"), "shiftfs", 0, "mark")
				},
			},
			{
				Name:  "mount-proc",
				Usage: "mounts proc",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount("proc", c.String("target"), "proc", 0, "")
				},
			},
			{
				Name:  "mount-sysfs",
				Usage: "mounts sysfs",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Mount("sysfs", c.String("target"), "sysfs", 0, "")
				},
			},
			{
				Name:  "unmount",
				Usage: "unmounts a mountpoint",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "target",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return unix.Unmount(c.String("target"), 0)
				},
			},
			{
				Name:  "mknod-fuse",
				Usage: "creates /dev/fuse",
				Flags: []cli.Flag{
					&cli.IntFlag{
						Name:     "uid",
						Required: true,
					},
					&cli.IntFlag{
						Name:     "gid",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					err := unix.Mknod("/dev/fuse", 0666|unix.S_IFCHR, int(unix.Mkdev(10, 229)))
					if err != nil {
						return err
					}

					err = os.Chmod("/dev/fuse", os.FileMode(0666))
					if err != nil {
						return err
					}
					err = os.Chown("/dev/fuse", c.Int("uid"), c.Int("gid"))
					if err != nil {
						return err
					}

					return nil
				},
			},
			{
				Name:  "mknod-devnettun",
				Usage: "creates /dev/net/tun",
				Action: func(c *cli.Context) error {
					_ = os.MkdirAll("/dev/net", 0755)

					err := unix.Mknod("/dev/net/tun", 0666|unix.S_IFCHR, int(unix.Mkdev(10, 200)))
					if err != nil {
						return err
					}

					err = os.Chmod("/dev/net/tun", os.FileMode(0666))
					if err != nil {
						return err
					}

					err = os.Chown("/dev/net/tun", c.Int("uid"), c.Int("gid"))
					if err != nil {
						return err
					}

					return nil
				},
			},
		},
	}

	log.Init("nsinsider", "", true, true)
	err := app.Run(os.Args)
	if err != nil {
		log.WithField("instanceId", os.Getenv("GITPOD_INSTANCE_ID")).WithField("args", os.Args).Fatal(err)
	}
}

func syscallMoveMount(fromDirFD int, fromPath string, toDirFD int, toPath string, flags uintptr) error {
	fromPathP, err := unix.BytePtrFromString(fromPath)
	if err != nil {
		return err
	}
	toPathP, err := unix.BytePtrFromString(toPath)
	if err != nil {
		return err
	}

	_, _, errno := unix.Syscall6(unix.SYS_MOVE_MOUNT, uintptr(fromDirFD), uintptr(unsafe.Pointer(fromPathP)), uintptr(toDirFD), uintptr(unsafe.Pointer(toPathP)), flags, 0)
	if errno != 0 {
		return errno
	}

	return nil
}

const (
	// FlagMoveMountFEmptyPath: empty from path permitted: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/mount.h#L70
	flagMoveMountFEmptyPath = 0x00000004
)

func syscallOpenTree(dfd int, path string, flags uintptr) (fd uintptr, err error) {
	p1, err := unix.BytePtrFromString(path)
	if err != nil {
		return 0, err
	}
	fd, _, errno := unix.Syscall(unix.SYS_OPEN_TREE, uintptr(dfd), uintptr(unsafe.Pointer(p1)), flags)
	if errno != 0 {
		return 0, errno
	}

	return fd, nil
}

const (
	// FlagOpenTreeClone: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/mount.h#L62
	flagOpenTreeClone = 1
	// FlagAtRecursive: Apply to the entire subtree: https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/fcntl.h#L112
	flagAtRecursive = 0x8000
)
