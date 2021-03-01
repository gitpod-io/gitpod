// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"os"
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
		},
	}

	log.Init("nsinsider", "", true, true)
	err := app.Run(os.Args)
	if err != nil {
		log.WithField("instanceId", os.Getenv("GITPOD_INSTANCE_ID")).Fatal(err)
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
