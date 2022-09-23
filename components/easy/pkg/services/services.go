// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package services

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/components/easy/pkg/config"
	v1_usage "github.com/gitpod-io/gitpod/components/easy/pkg/services/v1-usage"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
)

func Register(srv *baseserver.Server, cfg config.Config) error {

	registerUsageService(srv, cfg.Usage)

	return nil
}

func registerUsageService(srv *baseserver.Server, usage config.Usage) {
	v1.RegisterUsageServiceServer(srv.GRPC(), &v1_usage.UsageService{})
}
