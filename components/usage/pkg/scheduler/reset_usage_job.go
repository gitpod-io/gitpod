// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/go-redsync/redsync/v4"
)

func NewResetUsageJobSpec(schedule time.Duration, usageClient v1.UsageServiceClient, sync *redsync.Redsync, mutexExpiry time.Duration) (JobSpec, error) {
	spec := &ResetUsageJobSpec{
		usageClient:   usageClient,
		sync:          sync,
		mutexDuration: mutexExpiry,
	}
	return NewPeriodicJobSpec(schedule, "reset_usage", spec)
}

type ResetUsageJobSpec struct {
	usageClient v1.UsageServiceClient

	sync *redsync.Redsync

	// mutexDuration configures for how a mutex on the ledger should hold initially
	// it will be automatically extend for this duration if the job does not complete
	// within the initial alloted time period
	mutexDuration time.Duration
}

func (j *ResetUsageJobSpec) Run() (err error) {
	ctx := context.Background()

	runErr := WithRefreshingMutex(j.sync, "reset-usage", j.mutexDuration, func() error {
		log.Info("Running reset usage job.")

		_, err = j.usageClient.ResetUsage(ctx, &v1.ResetUsageRequest{})
		if err != nil {
			return fmt.Errorf("failed to reset usage: %w", err)
		}

		return nil
	})

	if errors.Is(runErr, redsync.ErrFailed) {
		log.Info("Ledger job did not acquire mutex, another job must be running already.")
		return nil
	}

	return runErr
}
