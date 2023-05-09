// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/go-redsync/redsync/v4"
	"github.com/robfig/cron"
)

func NewResetUsageJobSpec(schedule time.Duration, clientsConstructor ClientsConstructor, sync *redsync.Redsync, mutexExpiry time.Duration) (JobSpec, error) {
	job := &ResetUsageJobSpec{
		clientsConstructor: clientsConstructor,
		sync:               sync,
		mutexDuration:      mutexExpiry,
	}

	parsed, err := cron.Parse(fmt.Sprintf("@every %s", schedule.String()))
	if err != nil {
		return JobSpec{}, fmt.Errorf("failed to parse period into schedule: %w", err)
	}

	return JobSpec{
		Job:                 job,
		ID:                  "reset_usage",
		Schedule:            parsed,
		InitialLockDuration: schedule,
	}, nil

}

type ResetUsageJobSpec struct {
	clientsConstructor ClientsConstructor

	sync *redsync.Redsync

	// mutexDuration configures for how a mutex on the ledger should hold initially
	// it will be automatically extend for this duration if the job does not complete
	// within the initial alloted time period
	mutexDuration time.Duration
}

func (j *ResetUsageJobSpec) Run() (err error) {
	ctx := context.Background()

	log.Info("Running reset usage job.")
	usageClient, _, err := j.clientsConstructor()
	if err != nil {
		return fmt.Errorf("Failed to construct reset usage job clients: %w", err)
	}

	_, err = usageClient.ResetUsage(ctx, &v1.ResetUsageRequest{})
	if err != nil {
		return fmt.Errorf("failed to reset usage: %w", err)
	}

	return nil
}
