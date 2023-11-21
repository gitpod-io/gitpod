// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/components/ws-cluster-manager/api/v1/v1connect"
	"github.com/gitpod-io/gitpod/components/ws-cluster-manager/pkg/estate"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

func main() {
	err := run()
	if err != nil {
		log.WithError(err).Fatal("cannot start")
	}
}

func run() error {
	srv, err := baseserver.New("public_api_server",
		baseserver.WithLogger(log.WithField("component", "ws-cluster-manager")),
		baseserver.WithConfig(&baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: ":8080",
				},
				HTTP: &baseserver.ServerConfiguration{
					Address: ":8081",
				},
			},
		}),
		baseserver.WithVersion("0.1"),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize public api server: %w", err)
	}

	service := estate.NewClusterService()

	api.RegisterWorkspaceManagerServer(srv.GRPC(), service.WorkspaceManagerServer())
	srv.HTTPMux().Handle(v1connect.NewClusterServiceHandler(service.ClusterServiceHandler()))
	return srv.ListenAndServe()
}
