// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"fmt"
	"time"

	"github.com/robfig/cron"
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
		Job:      job,
		ID:       id,
		Schedule: parsed,
	}, nil
}
