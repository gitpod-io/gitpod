// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package watch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"

	"github.com/gitpod-io/gitpod/common-go/log"
)

type fileWatcher struct {
	onChange func()

	watcher *fsnotify.Watcher

	hash string
}

func File(ctx context.Context, path string, onChange func()) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("unexpected error creating file watcher: %w", err)
	}

	fw := &fileWatcher{
		watcher:  watcher,
		onChange: onChange,
	}

	// initial hash of the file
	hash, err := hashConfig(path)
	if err != nil {
		return fmt.Errorf("cannot get hash of file %v: %w", path, err)
	}

	// visible files in a volume are symlinks to files in the writer's data directory.
	// The files are stored in a hidden timestamped directory which is symlinked to by the data directory.
	// The timestamped directory and data directory symlink are created in the writer's target dir.
	// https://pkg.go.dev/k8s.io/kubernetes/pkg/volume/util#AtomicWriter
	watchDir, _ := filepath.Split(path)
	err = watcher.Add(watchDir)
	if err != nil {
		watcher.Close()
		return fmt.Errorf("unexpected error watching file %v: %w", path, err)
	}

	log.Infof("starting watch of file %v", path)

	fw.hash = hash

	go func() {
		defer func() {
			log.WithError(err).Info("Stopping file watch")

			err = watcher.Close()
			if err != nil {
				log.WithError(err).Error("Unexpected error closing file watcher")
			}
		}()

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}

				if !eventOpIs(event, fsnotify.Create) && !eventOpIs(event, fsnotify.Remove) {
					continue
				}

				currentHash, err := hashConfig(path)
				if err != nil {
					log.WithError(err).Warn("Cannot check if config has changed")
					return
				}

				// no change
				if currentHash == fw.hash {
					continue
				}

				log.WithField("path", path).Info("reloading file after change")

				fw.hash = currentHash
				fw.onChange()
			case err := <-watcher.Errors:
				log.WithError(err).Error("Unexpected error watching event")
			case <-ctx.Done():
				return
			}
		}
	}()

	return nil
}

func hashConfig(path string) (hash string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()

	_, err = io.Copy(h, f)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

func eventOpIs(event fsnotify.Event, op fsnotify.Op) bool {
	return event.Op&op == op
}
