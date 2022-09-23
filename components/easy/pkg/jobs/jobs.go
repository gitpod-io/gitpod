// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package jobs

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/components/easy/pkg/config"
)

func Register(cfg config.Config) (Scheduler, error) {
	// initialize cron jobs etc..
	return Scheduler{}, nil
}

type Scheduler struct {
}

func (s *Scheduler) Start() error {
	// starts running background jobs
	go func() {
		log.Info("Starting scheduled jobs...")
	}()

	return nil
}
