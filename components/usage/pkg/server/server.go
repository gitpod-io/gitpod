// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"github.com/gitpod-io/gitpod/content-service/api"
	"net"
	"os"
	"time"

	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"

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
	// ControllerSchedule determines how frequently to run the Usage/Billing controller.
	// When ControllerSchedule is empty, the background controller is disabled.
	ControllerSchedule string `json:"controllerSchedule,omitempty"`

	CreditsPerMinuteByWorkspaceClass map[string]float64 `json:"creditsPerMinuteByWorkspaceClass,omitempty"`

	StripeCredentialsFile string `json:"stripeCredentialsFile,omitempty"`

	ContentServiceAddress string `json:"contentServiceAddress,omitempty"`

	// billInstancesAfter sets the date after which instances should be considered for billing -
	// instances started before `billInstancesAfter` will not be considered by the billing controller.
	BillInstancesAfter *time.Time `json:"billInstancesAfter,omitempty"`

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

	grpcClientMetrics := grpc_prometheus.NewClientMetrics()
	err = srv.MetricsRegistry().Register(grpcClientMetrics)
	if err != nil {
		return fmt.Errorf("failed to register grpc client metrics: %w", err)
	}
	selfConnection, err := grpc.Dial(srv.GRPCAddress(),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpcDialerWithInitialDelay(1*time.Second),
		grpc.WithUnaryInterceptor(grpcClientMetrics.UnaryClientInterceptor()),
		grpc.WithStreamInterceptor(grpcClientMetrics.StreamClientInterceptor()),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(100*1024*1024),
			grpc.MaxCallSendMsgSize(100*1024*1024),
		))
	if err != nil {
		return fmt.Errorf("failed to create self-connection to grpc server: %w", err)
	}

	pricer, err := apiv1.NewWorkspacePricer(cfg.CreditsPerMinuteByWorkspaceClass)
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

	if cfg.ControllerSchedule != "" {
		// we do not run the controller if there is no schedule defined.
		schedule, err := time.ParseDuration(cfg.ControllerSchedule)
		if err != nil {
			return fmt.Errorf("failed to parse schedule duration: %w", err)
		}

		usageClient := v1.NewUsageServiceClient(selfConnection)
		ctrl, err := controller.New(schedule, controller.NewUsageAndBillingReconciler(
			usageClient,
			v1.NewBillingServiceClient(selfConnection),
		))
		if err != nil {
			return fmt.Errorf("failed to initialize usage controller: %w", err)
		}

		err = ctrl.Start()
		if err != nil {
			return fmt.Errorf("failed to start usage controller: %w", err)
		}
		defer ctrl.Stop()

		ledgerCtrl, err := controller.New(schedule, controller.NewLedgerReconciler(usageClient))
		if err != nil {
			return fmt.Errorf("failed to initialize ledger controller: %w", err)
		}

		err = ledgerCtrl.Start()
		if err != nil {
			return fmt.Errorf("failed tostart ledger controller: %w", err)
		}
		defer ledgerCtrl.Stop()
	} else {
		log.Info("No controller schedule specified, controller will be disabled.")
	}

	err = contentservice.RegisterMetrics(srv.MetricsRegistry())
	if err != nil {
		return fmt.Errorf("failed to register content service metrics: %w", err)
	}
	var contentService contentservice.Interface = &contentservice.NoOpClient{}
	if cfg.ContentServiceAddress != "" {
		contentServiceConn, err := grpc.Dial(cfg.ContentServiceAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			return fmt.Errorf("failed to dial contentservice: %w", err)
		}
		contentService = contentservice.New(api.NewUsageReportServiceClient(contentServiceConn))
	}

	reportGenerator := apiv1.NewReportGenerator(conn, pricer)

	err = registerGRPCServices(srv, conn, stripeClient, reportGenerator, contentService, *cfg.BillInstancesAfter)
	if err != nil {
		return fmt.Errorf("failed to register gRPC services: %w", err)
	}

	err = controller.RegisterMetrics(srv.MetricsRegistry())
	if err != nil {
		return fmt.Errorf("failed to register controller metrics: %w", err)
	}

	err = stripe.RegisterMetrics(srv.MetricsRegistry())
	if err != nil {
		return fmt.Errorf("failed to register stripe metrics: %w", err)
	}

	err = srv.ListenAndServe()
	if err != nil {
		return fmt.Errorf("failed to listen and serve: %w", err)
	}

	return nil
}

func registerGRPCServices(srv *baseserver.Server, conn *gorm.DB, stripeClient *stripe.Client, reportGenerator *apiv1.ReportGenerator, contentSvc contentservice.Interface, billInstancesAfter time.Time) error {
	v1.RegisterUsageServiceServer(srv.GRPC(), apiv1.NewUsageService(conn, reportGenerator, contentSvc))
	if stripeClient == nil {
		v1.RegisterBillingServiceServer(srv.GRPC(), &apiv1.BillingServiceNoop{})
	} else {
		v1.RegisterBillingServiceServer(srv.GRPC(), apiv1.NewBillingService(stripeClient, billInstancesAfter, conn, contentSvc))
	}
	return nil
}
