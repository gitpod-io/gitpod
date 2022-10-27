// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package scheduler

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func NewResetUsageJobSpec(schedule time.Duration) (JobSpec, error) {
	spec := &ResetUsageJobSpec{}
	return NewPeriodicJobSpec(schedule, "reset_usage", WithoutConcurrentRun(spec))
}

type ResetUsageJobSpec struct {
}

func (j *ResetUsageJobSpec) Run() (err error) {
	log.Info("Running reset usage job.")

	return nil
}
