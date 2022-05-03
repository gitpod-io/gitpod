// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api-server/middleware"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/apiv1"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/sirupsen/logrus"
	"net/http"
)

func Start(logger *logrus.Entry, cfg Config) error {
	srv, err := baseserver.New("public_api_server",
		baseserver.WithLogger(logger),
		baseserver.WithHTTPPort(cfg.HTTPPort),
		baseserver.WithGRPCPort(cfg.GRPCPort),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize public api server: %w", err)
	}

	if registerErr := register(srv); registerErr != nil {
		return fmt.Errorf("failed to register services: %w", registerErr)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve public api server: %w", err)
	}

	return nil
}

func register(srv *baseserver.Server) error {
	logger := log.New()
	m := middleware.NewLoggingMiddleware(logger)
	srv.HTTPMux().Handle("/", m(http.HandlerFunc(HelloWorldHandler)))

	v1.RegisterWorkspacesServiceServer(srv.GRPC(), apiv1.NewWorkspaceService())
	v1.RegisterPrebuildsServiceServer(srv.GRPC(), v1.UnimplementedPrebuildsServiceServer{})

	return nil
}

func HelloWorldHandler(w http.ResponseWriter, _ *http.Request) {
	w.Write([]byte(`hello world`))
}
