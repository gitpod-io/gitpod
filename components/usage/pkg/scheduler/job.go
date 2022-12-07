// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/robfig/cron"
	"time"
)

type Job interface {
	Run() error
}

type JobFunc func() error

func (f JobFunc) Run() error {
	return f()
}

func NewPeriodicJobSpec(period time.Duration, id string, job Job) (JobSpec, error) {
	parsed, err := cron.Parse(fmt.Sprintf("@every %s", period.String()))
	if err != nil {
		return JobSpec{}, fmt.Errorf("failed to parse period into schedule: %w", err)
	}

	return JobSpec{
		Job:      WithoutConcurrentRun(job),
		ID:       id,
		Schedule: parsed,
	}, nil
}

// WithoutConcurrentRun wraps a Job and ensures the job does not concurrently
func WithoutConcurrentRun(j Job) Job {
	return &preventConcurrentInvocation{
		job:     j,
		running: make(chan struct{}, 1),
	}
}

type preventConcurrentInvocation struct {
	job     Job
	running chan struct{}
}

func (r *preventConcurrentInvocation) Run() error {
	select {
	// attempt a write to signal we want to run
	case r.running <- struct{}{}:
		// we managed to write, there's no other job executing. Cases are not fall through so we continue executing our main logic.
		defer func() {
			// signal job completed
			<-r.running
		}()

		err := r.job.Run()
		return err
	default:
		// we could not write, so another instance is already running. Skip current run.
		log.Infof("Job already running, skipping invocation.")
		return nil
	}
}
