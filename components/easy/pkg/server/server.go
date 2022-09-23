// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/components/easy/pkg/config"
	"github.com/gitpod-io/gitpod/components/easy/pkg/jobs"
	"github.com/gitpod-io/gitpod/components/easy/pkg/services"
)

func ListenAndServe(cfg config.Config, version string) error {
	base, err := baseserver.New("easy",
		baseserver.WithConfig(cfg.Server),
		baseserver.WithVersion(version),
	)
	if err != nil {
		return fmt.Errorf("failed to setup baseserver: %w", err)
	}

	err = services.Register(base, cfg)
	if err != nil {
		return fmt.Errorf("failed to register services: %w", err)
	}

	scheduler, err := jobs.Register(cfg)
	if err != nil {
		return fmt.Errorf("failed to setup jobs: %w", err)
	}

	err = scheduler.Start()
	if err != nil {
		return fmt.Errorf("failed to start job scheduler: %w", err)
	}

	err = base.ListenAndServe()
	if err != nil {
		return fmt.Errorf("failed to listen and serve: %w", err)
	}

	return nil
}
