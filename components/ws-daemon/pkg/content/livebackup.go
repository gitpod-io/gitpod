// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

const (
	// maxBackupCount is the max number of live backups we're allowed to keep
	maxBackupCount = 2

	// gcInterval is the period between live backup GC runs.
	gcInterval = 10 * time.Minute

	// regularBackupInterval is the time between regular hardlink backups ... we're creating a backup at the end of a container's
	// lifetime, so the regular intervals are really more of a safety net.
	regularBackupInterval = 2 * time.Minute
)

// LiveWorkspaceBackup observes changes in a workspace's filesystem and triggers backups accordingly
type LiveWorkspaceBackup struct {
	OWI         logrus.Fields
	Location    string
	Destination string

	stop         chan struct{}
	closeOnce    sync.Once
	lastFSBackup *time.Time
}

// Start starts listening for FS changes and triggers backups accordingly
func (l *LiveWorkspaceBackup) Start() (err error) {
	if l == nil {
		return nil
	}

	gcTicker := time.NewTicker(gcInterval)
	defer gcTicker.Stop()
	rbTicker := time.NewTicker(regularBackupInterval)
	defer rbTicker.Stop()

	go func() {
		for {
			select {
			case <-gcTicker.C:
				err = l.garbageCollect()
				if err != nil {
					log.WithFields(l.OWI).WithError(err).Error("live backup garbage collector error")
				}
			case <-rbTicker.C:
				_, err := l.Backup()
				if err != nil {
					log.WithFields(l.OWI).WithError(err).Error("cannot produce regular live backup")
				}
			case <-l.stop:
				log.WithFields(l.OWI).WithField("loc", l.Location).Debug("stopping live workspace backup")
				return
			}
		}
	}()

	return nil
}

// Backup creates a live hardlink backup of a workspace
func (l *LiveWorkspaceBackup) Backup() (dest string, err error) {
	if l == nil {
		return "", nil
	}

	err = os.MkdirAll(l.Destination, 0644)
	if err != nil && !os.IsExist(err) {
		return
	}
	// reset err just in case it was ErrFileExist
	err = nil

	dest = filepath.Join(l.Destination, fmt.Sprintf("%d", time.Now().UnixNano()))
	out, err := exec.Command("cp", "-al", l.Location, dest).CombinedOutput()
	if err != nil {
		return "", xerrors.Errorf("%w: %s", err, string(out))
	}

	// there are a couple of directories we do not want as part of the backup - remove them
	gpdir := filepath.Join(dest, "workspace", ".gitpod")
	if fs, err := ioutil.ReadDir(gpdir); err == nil {
		for _, f := range fs {
			fn := f.Name()
			if strings.HasPrefix(fn, "prebuild-log-") {
				continue
			}

			os.RemoveAll(filepath.Join(gpdir, fn))
		}
	}
	os.RemoveAll(filepath.Join(dest, "tmp"))

	return
}

// garbageCollect reduces the number of live backups to a fixed maximum
func (l *LiveWorkspaceBackup) garbageCollect() (err error) {
	if l == nil {
		return nil
	}

	srcs, err := ioutil.ReadDir(l.Destination)
	if os.IsNotExist(err) {
		// we don't have any backups hence have nothing to do
		return nil
	}
	if err != nil {
		return
	}

	// sort by modtime asc (oldest first)
	sort.Slice(srcs, func(i, j int) bool { return srcs[i].ModTime().Before(srcs[j].ModTime()) })
	for i := 0; i < len(srcs)-maxBackupCount; i++ {
		loc := filepath.Join(l.Destination, srcs[i].Name())
		err := os.RemoveAll(loc)
		if err != nil {
			log.WithFields(l.OWI).WithError(err).WithField("loc", loc).Error("cannot garbage collect backup")
		}
	}
	return nil
}

// Remove removes all formerly created live backups
func (l *LiveWorkspaceBackup) Remove() error {
	if l == nil {
		return nil
	}

	return os.RemoveAll(l.Destination)
}

// Stop stops the FS triggered backups
func (l *LiveWorkspaceBackup) Stop() {
	if l == nil {
		return
	}

	l.closeOnce.Do(func() { close(l.stop) })
}

// Latest returns the latest backup created. If there's no backup available
// we'll return os.ErrNotExist.
func (l *LiveWorkspaceBackup) Latest() (path string, err error) {
	if l == nil {
		return "", os.ErrNotExist
	}

	srcs, err := ioutil.ReadDir(l.Destination)
	if err != nil {
		return
	}
	// sort by modtime desc (newest first)
	sort.Slice(srcs, func(i, j int) bool { return srcs[j].ModTime().Before(srcs[i].ModTime()) })

	var bkp string
	for _, s := range srcs {
		loc := filepath.Join(l.Destination, s.Name())
		if !s.IsDir() {
			log.WithFields(l.OWI).WithField("loc", loc).Warn("latest backup is not a directory - that should not be")
			continue
		}
		bkp = loc
		break
	}
	if bkp == "" {
		return "", os.ErrNotExist
	}

	return bkp, nil
}
