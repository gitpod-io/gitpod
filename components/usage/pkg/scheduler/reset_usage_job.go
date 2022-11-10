// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
)

func NewResetUsageJobSpec(schedule time.Duration, usageClient v1.UsageServiceClient) (JobSpec, error) {
	spec := &ResetUsageJobSpec{
		usageClient: usageClient,
	}
	return NewPeriodicJobSpec(schedule, "reset_usage", WithoutConcurrentRun(spec))
}

type ResetUsageJobSpec struct {
	usageClient v1.UsageServiceClient
}

func (j *ResetUsageJobSpec) Run() (err error) {
	log.Info("Running reset usage job.")
	ctx := context.Background()

	_, err = j.usageClient.ResetUsage(ctx, &v1.ResetUsageRequest{})
	if err != nil {
		return fmt.Errorf("failed to reset usage: %w", err)
	}

	return nil
}
