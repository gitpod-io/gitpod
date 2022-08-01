// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"net"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/apiv1"
	"github.com/gitpod-io/gitpod/usage/pkg/contentservice"
	"github.com/gitpod-io/gitpod/usage/pkg/controller"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"gorm.io/gorm"
)

type Config struct {
	// ControllerSchedule determines how frequently to run the Usage/Billing controller
	ControllerSchedule string `json:"controllerSchedule,omitempty"`

	CreditsPerMinuteByWorkspaceClass map[string]float64 `json:"creditsPerMinuteByWorkspaceClass,omitempty"`

	StripeCredentialsFile string `json:"stripeCredentialsFile,omitempty"`

	ContentServiceAddress string `json:"contentServiceAddress,omitempty"`

	Server *baseserver.Configuration `json:"server,omitempty"`
}

func Start(cfg Config) error {
	log.WithField("config", cfg).Info("Starting usage component.")

	conn, err := db.Connect(db.ConnectionParams{
		User:     os.Getenv("DB_USERNAME"),
		Password: os.Getenv("DB_PASSWORD"),
		Host:     net.JoinHostPort(os.Getenv("DB_HOST"), os.Getenv("DB_PORT")),
		Database: "gitpod",
	})
	if err != nil {
		return fmt.Errorf("failed to establish database connection: %w", err)
	}

	var serverOpts []baseserver.Option
	if cfg.Server != nil {
		serverOpts = append(serverOpts, baseserver.WithConfig(cfg.Server))
	}
	srv, err := baseserver.New("usage", serverOpts...)
	if err != nil {
		return fmt.Errorf("failed to initialize usage server: %w", err)
	}

	dialerOpt := grpcDialerWithInitialDelay(1 * time.Second)
	selfConnection, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()), dialerOpt)
	if err != nil {
		return fmt.Errorf("failed to create self-connection to grpc server: %w", err)
	}

	pricer, err := controller.NewWorkspacePricer(cfg.CreditsPerMinuteByWorkspaceClass)
	if err != nil {
		return fmt.Errorf("failed to create workspace pricer: %w", err)
	}

	var stripeClient *stripe.Client
	if cfg.StripeCredentialsFile != "" {
		config, err := stripe.ReadConfigFromFile(cfg.StripeCredentialsFile)
		if err != nil {
			return fmt.Errorf("failed to load stripe credentials: %w", err)
		}

		c, err := stripe.New(config)
		if err != nil {
			return fmt.Errorf("failed to initialize stripe client: %w", err)
		}

		stripeClient = c
	}

	schedule, err := time.ParseDuration(cfg.ControllerSchedule)
	if err != nil {
		return fmt.Errorf("failed to parse schedule duration: %w", err)
	}

	var contentService contentservice.Interface = &contentservice.NoOpClient{}
	if cfg.ContentServiceAddress != "" {
		contentService = contentservice.New(cfg.ContentServiceAddress)
	}

	ctrl, err := controller.New(schedule, controller.NewUsageReconciler(conn, pricer, v1.NewBillingServiceClient(selfConnection), contentService))
	if err != nil {
		return fmt.Errorf("failed to initialize usage controller: %w", err)
	}

	err = ctrl.Start()
	if err != nil {
		return fmt.Errorf("failed to start usage controller: %w", err)
	}
	defer ctrl.Stop()

	err = registerGRPCServices(srv, conn, stripeClient)
	if err != nil {
		return fmt.Errorf("failed to register gRPC services: %w", err)
	}

	h := stripe.NewWebhookHandler()
	registerHttpHandlers(srv, h)

	err = controller.RegisterMetrics(srv.MetricsRegistry())
	if err != nil {
		return fmt.Errorf("failed to register controller metrics: %w", err)
	}

	err = srv.ListenAndServe()
	if err != nil {
		return fmt.Errorf("failed to listen and serve: %w", err)
	}

	return nil
}

func registerGRPCServices(srv *baseserver.Server, conn *gorm.DB, stripeClient *stripe.Client) error {
	v1.RegisterUsageServiceServer(srv.GRPC(), apiv1.NewUsageService(conn))
	if stripeClient == nil {
		v1.RegisterBillingServiceServer(srv.GRPC(), &apiv1.BillingServiceNoop{})
	} else {
		v1.RegisterBillingServiceServer(srv.GRPC(), apiv1.NewBillingService(stripeClient))
	}
	return nil
}

func registerHttpHandlers(srv *baseserver.Server, h *stripe.WebhookHandler) {
	srv.HTTPMux().HandleFunc("/webhook", h.Handle)
}
