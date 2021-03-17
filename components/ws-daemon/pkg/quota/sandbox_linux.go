// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// +build linux

package quota

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"sync"

	"github.com/opentracing/opentracing-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

// SandboxProvider can create/mount and dispose sandboxes
type SandboxProvider struct {
	mu sync.Mutex
}

// Create creates a new filesystem
func (sp *SandboxProvider) Create(ctx context.Context, path string, size Size) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "SandboxProvider.Create")
	defer tracing.FinishSpan(span, &err)

	if _, err := os.Stat(path); err == nil {
		return xerrors.Errorf("sandbox exists already")
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	err = f.Close()
	if err != nil {
		return err
	}
	err = os.Truncate(path, int64(size))
	if err != nil {
		return err
	}

	out, err := exec.Command("mkfs.ext4", path).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot make filesystem: %v: %s", err, string(out))
	}
	span.LogKV("path", path)

	return nil
}

// Mount mounts a preapred filesystem in dst
func (sp *SandboxProvider) Mount(ctx context.Context, path, dst string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "SandboxProvider.Mount")
	defer tracing.FinishSpan(span, &err)

	// acquire the lock to synchronize loopback device creation and use
	sp.mu.Lock()
	defer sp.mu.Unlock()

	// get next loopback device
	out, err := exec.Command("losetup", "-f").CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot mount sandbox: %v: %s", err, string(out))
	}
	lodev := strings.TrimSpace(string(out))
	// lodev might not exist yet, only the first 8 (i.e. up to /dev/loop7) exist by default
	if _, err := os.Stat(lodev); os.IsNotExist(err) {
		cmds := [][]string{
			{"mknod", lodev, "b", "7", strings.TrimPrefix(lodev, "/dev/loop")},
			{"chown", "--reference=/dev/loop0", lodev},
			{"chmod", "--reference=/dev/loop0", lodev},
		}

		log.WithField("lodev", lodev).Debug("created new loopback device")
		for _, cmd := range cmds {
			out, err := exec.Command(cmd[0], cmd[1:]...).CombinedOutput()
			if err != nil {
				return xerrors.Errorf("cannot mount sandbox: %v: %s", err, string(out))
			}
		}
	}

	// mount using lodev
	out, err = exec.Command("mount", "-o", "rw,relatime,discard", path, dst).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot mount sandbox: %v: %s", err, string(out))
	}

	span.LogKV("path", path, "dst", dst, "dev", lodev)
	log.WithFields(logrus.Fields{"path": path, "dst": dst, "dev": lodev}).Debug("mounted sandbox")
	return nil
}

// Dispose will unmount the sandbox (if it's mounted)
// and remove the backing file.
func (sp *SandboxProvider) Dispose(ctx context.Context, mountPath string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "SandboxProvider.Dispose")
	defer tracing.FinishSpan(span, &err)

	mp, err := findMountPointFromProc(mountPath)
	if err != nil {
		return xerrors.Errorf("cannot dispose sandbox: %w", err)
	}
	if mp == nil {
		return xerrors.Errorf("cannot dispose sandbox: did not find mountpoint")
	}

	backingFile, err := findLoopdevBacking(mp.Device)
	if err != nil {
		return xerrors.Errorf("cannot dispose sandbox: %w", err)
	}

	out, err := exec.Command("umount", mp.Path).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot unmount sandbox: %w: %s", err, string(out))
	}

	err = os.Remove(backingFile)
	if err != nil {
		return xerrors.Errorf("cannot remove sandbox: %w", err)
	}

	span.LogKV("mountPath", mountPath, "dev", mp.Device, "backingFile", backingFile)
	log.WithFields(logrus.Fields{"mountPath": mountPath, "dev": mp.Device, "backingFile": backingFile}).Debug("unmounted and disposed sandbox")
	return nil
}
