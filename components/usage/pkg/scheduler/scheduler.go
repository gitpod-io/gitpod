// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/robfig/cron"
	"sync"
	"time"
)

func New(jobs ...JobSpec) *Scheduler {
	return &Scheduler{
		specs:       jobs,
		runningJobs: sync.WaitGroup{},
		cron:        cron.NewWithLocation(time.UTC),
	}
}

type Scheduler struct {
	specs       []JobSpec
	runningJobs sync.WaitGroup

	cron *cron.Cron
}

type JobSpec struct {
	Job      Job
	ID       string
	Schedule cron.Schedule
}

func (c *Scheduler) Start() {
	log.Infof("Starting usage scheduler. Setting up %d jobs.", len(c.specs))

	for _, job := range c.specs {
		// need to re-assign job to avoid pointing to a different job spec once the `cron.FuncJob` executes.
		j := job
		c.cron.Schedule(job.Schedule, cron.FuncJob(func() {
			c.runningJobs.Add(1)
			defer c.runningJobs.Done()

			now := time.Now().UTC()
			logger := log.WithField("job_id", j.ID)

			logger.Infof("Starting scheduled job %s", j.ID)
			reportJobStarted(j.ID)

			err := j.Job.Run()
			defer func() {
				reportJobCompleted(j.ID, time.Since(now), err)
			}()
			if err != nil {
				logger.WithError(err).Errorf("Scheduled job %s failed.", job.ID)
				return
			}
			logger.Infof("Scheduled job %s completed succesfully.", job.ID)
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
