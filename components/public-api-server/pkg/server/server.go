// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gorilla/handlers"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/apiv1"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/webhooks"
	"github.com/sirupsen/logrus"
)

func Start(logger *logrus.Entry, version string, cfg *config.Configuration) error {
	logger.WithField("config", cfg).Info("Starting public-api.")

	gitpodAPI, err := url.Parse(cfg.GitpodServiceURL)
	if err != nil {
		return fmt.Errorf("failed to parse Gitpod API URL: %w", err)
	}

	connPool, err := proxy.NewConnectionPool(gitpodAPI, 3000)
	if err != nil {
		return fmt.Errorf("failed to setup connection pool: %w", err)
	}

	srv, err := baseserver.New("public_api_server",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
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

	if registerErr := register(srv, connPool); registerErr != nil {
		return fmt.Errorf("failed to register services: %w", registerErr)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve public api server: %w", err)
	}

	return nil
}

func register(srv *baseserver.Server, connPool proxy.ServerConnectionPool) error {
	proxy.RegisterMetrics(srv.MetricsRegistry())

	connectMetrics := NewConnectMetrics()
	err := connectMetrics.Register(srv.MetricsRegistry())
	if err != nil {
		return err
	}

	handlerOptions := []connect.HandlerOption{
		connect.WithInterceptors(
			NewMetricsInterceptor(connectMetrics),
			NewLogInterceptor(log.Log),
			auth.NewServerInterceptor(),
		),
	}

	workspacesRoute, workspacesServiceHandler := v1connect.NewWorkspacesServiceHandler(apiv1.NewWorkspaceService(connPool), handlerOptions...)
	srv.HTTPMux().Handle(workspacesRoute, workspacesServiceHandler)

	teamsRoute, teamsServiceHandler := v1connect.NewTeamsServiceHandler(apiv1.NewTeamsService(connPool), handlerOptions...)
	srv.HTTPMux().Handle(teamsRoute, teamsServiceHandler)

	return nil
}

func readStripeWebhookSecret(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read stripe webhook secret: %w", err)
	}

	return strings.TrimSpace(string(b)), nil
}
