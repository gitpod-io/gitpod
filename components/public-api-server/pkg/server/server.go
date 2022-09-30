// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api/v1/v1connect"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/public-api/config"
	"github.com/gorilla/handlers"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/webhooks"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

type WorkspaceService struct {
	v1connect.UnimplementedWorkspacesServiceHandler
}

func Start(logger *logrus.Entry, version string, cfg *config.Configuration) error {
	logger.WithField("config", cfg).Info("Starting public-api.")

	gitpodAPI, err := url.Parse(cfg.GitpodServiceURL)
	if err != nil {
		return fmt.Errorf("failed to parse Gitpod API URL: %w", err)
	}

	registry := prometheus.NewRegistry()

	srv, err := baseserver.New("public_api_server",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
		baseserver.WithMetricsRegistry(registry),
		baseserver.WithVersion(version),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize public api server: %w", err)
	}

	var billingService billingservice.Interface = &billingservice.NoOpClient{}
	if cfg.BillingServiceAddress != "" {
		billingService, err = billingservice.New(cfg.BillingServiceAddress)
		if err != nil {
			return fmt.Errorf("failed to initialize billing service client: %w", err)
		}
	}

	var stripeWebhookHandler http.Handler = webhooks.NewNoopWebhookHandler()
	if cfg.StripeWebhookSigningSecretPath != "" {
		stripeWebhookSecret, err := readStripeWebhookSecret(cfg.StripeWebhookSigningSecretPath)
		if err != nil {
			return fmt.Errorf("failed to read stripe secret: %w", err)
		}
		stripeWebhookHandler = webhooks.NewStripeWebhookHandler(billingService, stripeWebhookSecret)
	} else {
		log.Info("No stripe webhook secret is configured, endpoints will return NotImplemented")
	}

	srv.HTTPMux().Handle("/stripe/invoices/webhook", handlers.ContentTypeHandler(stripeWebhookHandler, "application/json"))

	if registerErr := register(srv, gitpodAPI, registry); registerErr != nil {
		return fmt.Errorf("failed to register services: %w", registerErr)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve public api server: %w", err)
	}

	return nil
}

func register(srv *baseserver.Server, serverAPIURL *url.URL, registry *prometheus.Registry) error {
	proxy.RegisterMetrics(registry)

	//connPool := &proxy.NoConnectionPool{ServerAPI: serverAPIURL}

	wsSvc := &WorkspaceService{}
	path, handler := v1connect.NewWorkspacesServiceHandler(wsSvc)
	//v1.RegisterWorkspacesServiceServer(srv.GRPC(), apiv1.NewWorkspaceService(connPool))
	//v1.RegisterPrebuildsServiceServer(srv.GRPC(), v1.UnimplementedPrebuildsServiceServer{})

	srv.HTTPMux().Handle(path, handler)
	srv.HTTPMux().HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Infof("Handling request %s %s", r.URL.Path, r.Method)
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "*")
			w.WriteHeader(http.StatusOK)
			return
		}
	})

	//http.ListenAndServe(
	//	"localhost:8080",
	//	// Use h2c so we can serve HTTP/2 without TLS.
	//	h2c.NewHandler(mux, &http2.Server{}),
	//)
	return nil
}

func readStripeWebhookSecret(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read stripe webhook secret: %w", err)
	}

	return strings.TrimSpace(string(b)), nil
}
