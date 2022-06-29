// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/robfig/cron"
	"sync"
	"time"
)

func New(schedule time.Duration, reconciler Reconciler) (*Controller, error) {
	return &Controller{
		schedule:   schedule,
		reconciler: reconciler,
		scheduler:  cron.NewWithLocation(time.UTC),
	}, nil
}

type Controller struct {
	schedule   time.Duration
	reconciler Reconciler

	scheduler *cron.Cron

	jobs        chan struct{}
	runningJobs sync.WaitGroup
}

func (c *Controller) Start() error {
	log.Info("Starting usage controller.")
	// Using channel of size 1 ensures we don't queue up overly many runs when there is already 1 queued up.
	c.jobs = make(chan struct{}, 1)

	go func() {
		// Here, we guarantee we're only ever executing 1 job at a time - in other words we always wait for the previous job to finish.
		for range c.jobs {
			c.runningJobs.Add(1)
			defer c.runningJobs.Done()

			err := c.reconciler.Reconcile()
			if err != nil {
				log.WithError(err).Errorf("Reconciliation run failed.")
			} else {
				log.Info("Completed usage reconciliation run without errors.")
			}
		}
	}()

	err := c.scheduler.AddFunc(fmt.Sprintf("@every %s", c.schedule.String()), cron.FuncJob(func() {
		log.Info("Starting usage reconciliation.")

		select {
		case c.jobs <- struct{}{}:
			log.Info("Triggered next reconciliation.")
		default:
			log.Info("Previous reconciliation loop is still running, skipping.")
		}
	}))
	if err != nil {
		return fmt.Errorf("failed to add function to scheduler: %w", err)
	}

	c.scheduler.Start()

	return nil
}

// Stop terminates the Controller and awaits for all running jobs to complete.
func (c *Controller) Stop() {
	log.Info("Stopping usage controller.")
	// Stop any new jobs from running
	c.scheduler.Stop()

	close(c.jobs)

	log.Info("Awaiting existing reconciliation runs to complete..")
	// Wait for existing jobs to finish
	c.runningJobs.Wait()

}
