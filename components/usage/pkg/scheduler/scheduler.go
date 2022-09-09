// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
		c.cron.Schedule(job.Schedule, cron.FuncJob(func() {
			c.runningJobs.Add(1)
			defer c.runningJobs.Done()

			now := time.Now().UTC()
			logger := log.WithField("job_id", job.ID)

			logger.Infof("Starting scheduled job %s", job.ID)
			reportJobStarted(job.ID)

			err := job.Job.Run()
			defer func() {
				reportJobCompleted(job.ID, time.Since(now), err)
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
	log.Info("Stopping usage controller.")

	log.Info("Awaiting existing reconciliation runs to complete..")
	// Wait for existing jobs to finish
	c.runningJobs.Wait()

	log.Infof("All running jobs completed.")
}
