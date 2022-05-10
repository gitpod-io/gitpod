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
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"net/http"
)

func Start(logger *logrus.Entry, cfg Config) error {
	registry := prometheus.NewRegistry()

	srv, err := baseserver.New("public_api_server",
		baseserver.WithLogger(logger),
		baseserver.WithHTTPPort(cfg.HTTPPort),
		baseserver.WithGRPCPort(cfg.GRPCPort),
		baseserver.WithMetricsRegistry(registry),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize public api server: %w", err)
	}

	if registerErr := register(srv, cfg, registry); registerErr != nil {
		return fmt.Errorf("failed to register services: %w", registerErr)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve public api server: %w", err)
	}

	return nil
}

func register(srv *baseserver.Server, cfg Config, registry *prometheus.Registry) error {
	proxy.RegisterMetrics(registry)

	logger := log.New()
	m := middleware.NewLoggingMiddleware(logger)
	srv.HTTPMux().Handle("/", m(http.HandlerFunc(HelloWorldHandler)))

	connPool := &proxy.NoConnectionPool{ServerAPI: cfg.GitpodAPI}

	v1.RegisterWorkspacesServiceServer(srv.GRPC(), apiv1.NewWorkspaceService(connPool))
	v1.RegisterPrebuildsServiceServer(srv.GRPC(), v1.UnimplementedPrebuildsServiceServer{})

	return nil
}

func HelloWorldHandler(w http.ResponseWriter, _ *http.Request) {
	w.Write([]byte(`hello world`))
}
