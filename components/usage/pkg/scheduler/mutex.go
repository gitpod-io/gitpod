// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-redsync/redsync/v4"
)

func WithRefreshingMutex(sync *redsync.Redsync, name string, expiry time.Duration, fn func() error) error {
	ctx := context.Background()

	logger := log.Log.WithField("mutexName", name).WithField("mutexExpiry", expiry)

	// Refresh the mutex 10 seconds before it expires, or every 1 second at minimum
	refreshThreshold := expiry - 10*time.Second
	if refreshThreshold < 0 {
		refreshThreshold = 1 * time.Second
	}

	done := make(chan struct{})

	mutex := sync.NewMutex(name, redsync.WithExpiry(expiry), redsync.WithTries(1))

	logger.Debug("Acquiring mutex")
	if err := mutex.LockContext(ctx); err != nil {
		logger.WithError(err).Debugf("Failed to acquire mutex.")
		return err
	}
	logger.Debugf("Acquired mutex. Mutex valid until: %s and will be refreshed every %v if job runs for longer.", mutex.Until().UTC(), refreshThreshold.String())

	defer func() {
		// we always signal that our run is complete, to ensure our mutex refresh go-routine exits
		close(done)
	}()

	go func() {
		logger.Debug("Running routine to refresh mutex lock if job runs longer than expiry.")
		t := time.NewTicker(refreshThreshold)

		for {
			select {
			// either we're done, and we exit
			case <-done:
				logger.Debug("Job has completed, stopping mutex refresh routine.")
				t.Stop()
				return

			// or we're not yet done and need to extend the mutex
			case <-t.C:
				log.Debug("Extending mutex because job is still running.")
				_, err := mutex.ExtendContext(ctx)
				if err != nil {
					log.Log.WithError(err).Errorf("Failed to extend %s mutex.", name)
				}

				log.Debugf("Succesfully extended mutex. Mutex valid until: %v", mutex.Until().UTC())
			}
		}
	}()

	logger.Debug("Running job inside mutex.")
	fnErr := fn()

	// release the lock, it will be acquired on subsequent run, possibly by another instance of this job.
	logger.Debug("Completed job inside mutex. Releasing mutex lock.")
	if _, err := mutex.UnlockContext(ctx); err != nil {
		logger.WithError(err).Error("Failed to release mutex.")
	}

	logger.Debug("Mutex succesfully released.")
	return fnErr
}
