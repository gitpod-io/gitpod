// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-redsync/redsync/v4"
	"github.com/robfig/cron"
)

func New(mutex *redsync.Redsync, jobs ...JobSpec) *Scheduler {
	return &Scheduler{
		specs:       jobs,
		runningJobs: sync.WaitGroup{},
		cron:        cron.NewWithLocation(time.UTC),
		mutex:       mutex,
	}
}

type Scheduler struct {
	specs       []JobSpec
	runningJobs sync.WaitGroup
	mutex       *redsync.Redsync

	cron *cron.Cron
}

type JobSpec struct {
	Job                 Job
	ID                  string
	Schedule            cron.Schedule
	InitialLockDuration time.Duration
}

func (c *Scheduler) Start() {
	log.Infof("Starting usage scheduler. Setting up %d jobs.", len(c.specs))

	for _, job := range c.specs {
		// need to re-assign job to avoid pointing to a different job spec once the `cron.FuncJob` executes.
		j := job
		c.cron.Schedule(job.Schedule, cron.FuncJob(func() {
			ctx := context.Background()
			c.runningJobs.Add(1)
			defer c.runningJobs.Done()

			now := time.Now().UTC()
			logger := log.WithField("job_id", j.ID)

			err := WithRefreshingMutex(ctx, c.mutex, j.ID, j.InitialLockDuration, func(ctx context.Context) error {
				logger.Infof("Starting scheduled job %s", j.ID)
				reportJobStarted(j.ID)
				jobErr := j.Job.Run()
				reportJobCompleted(j.ID, time.Since(now), jobErr)

				if jobErr != nil {
					// We don't propagate the job erros outside of run mutex context deliberately
					// to contain each job errors
					logger.WithError(jobErr).Errorf("Scheduled job %s failed.", job.ID)
					return nil
				}

				logger.Infof("Scheduled job %s completed succesfully.", j.ID)
				return jobErr
			})
			if err != nil {
				if errors.Is(err, redsync.ErrTaken{}) {
					logger.WithError(err).Info("Failed to acquire lock, another instance holds the lock already.")
					return
				}

				logger.WithError(err).Error("Failed to execute job inside a mutex.")
				return
			}

			logger.Debug("Succesfully obtained mutex and executed job.")
		}))
	}

	c.cron.Start()
}

// Stop terminates the Scheduler and awaits for all running jobs to complete.
func (c *Scheduler) Stop() {
	log.Info("Stopping scheduler.")
	c.cron.Stop()

	log.Info("Awaiting existing jobs to complete.")
	// Wait for existing jobs to finish
	c.runningJobs.Wait()

	log.Infof("All running jobs completed.")
}
