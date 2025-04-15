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
	"time"

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
		const (
			initialBackoff = 100 * time.Millisecond
			maxBackoff     = 15 * time.Second
		)
		var currentBackoff time.Duration

		defer func() {
			if err != nil {
				log.WithError(err).Error("Stopping file watch")
			} else {
				log.Info("Stopping file watch")
			}

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

				currentHash, hashErr := hashConfig(path)
				if hashErr != nil {
					log.WithError(hashErr).WithField("event", event.Name).Warn("Cannot check if config has changed, backing off")

					if currentBackoff == 0 {
						currentBackoff = initialBackoff
					} else {
						currentBackoff *= 2
						if currentBackoff > maxBackoff {
							currentBackoff = maxBackoff
						}
					}

					select {
					case <-time.After(currentBackoff):
					case <-ctx.Done():
						log.Info("Context cancelled during backoff sleep, stopping file watcher")
						return
					}
					continue
				}

				currentBackoff = 0

				if currentHash == fw.hash {
					log.WithField("path", path).Debug("Config file changed but content hash is the same")
					continue
				}

				log.WithField("path", path).Info("reloading file after change")
				fw.hash = currentHash
				fw.onChange()
			case watchErr := <-watcher.Errors:
				log.WithError(watchErr).Error("Unexpected error watching event")
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
