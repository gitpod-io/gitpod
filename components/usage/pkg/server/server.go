// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/scheduler"

	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/apiv1"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"gorm.io/gorm"

	"github.com/go-redsync/redsync/v4"
	"github.com/go-redsync/redsync/v4/redis/goredis/v9"
	redis "github.com/redis/go-redis/v9"
)

type Config struct {
	// LedgerSchedule determines how frequently to run the Usage/Billing controller.
	// When LedgerSchedule is empty, the background controller is disabled.
	LedgerSchedule string `json:"controllerSchedule,omitempty"`

	// ResetUsageSchedule determines how frequently to run the Usage Reset job.
	// When empty, the job is disabled.
	ResetUsageSchedule string `json:"resetUsageSchedule,omitempty"`

	CreditsPerMinuteByWorkspaceClass map[string]float64 `json:"creditsPerMinuteByWorkspaceClass,omitempty"`

	StripeCredentialsFile string `json:"stripeCredentialsFile,omitempty"`

	Server *baseserver.Configuration `json:"server,omitempty"`

	DefaultSpendingLimit db.DefaultSpendingLimit `json:"defaultSpendingLimit"`

	// StripePrices configure which Stripe Price IDs should be used
	StripePrices stripe.StripePrices `json:"stripePrices"`

	// Redis configures the connection to Redis
	Redis RedisConfiguration `json:"redis"`

	// Where to find the gRPC/Connect APIs on the server component
	ServerAddress string `json:"serverAddress"`
}

type RedisConfiguration struct {
	// Address configures the redis connection of this component
	Address string `json:"address"`
}

func Start(cfg Config, version string) error {
	log.WithField("config", cfg).Info("Starting usage component.")

	conn, err := db.Connect(db.ConnectionParamsFromEnv())
	if err != nil {
		return fmt.Errorf("failed to establish database connection: %w", err)
	}

	serverOpts := []baseserver.Option{
		baseserver.WithVersion(version),
	}
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

	redisClient := redis.NewClient(&redis.Options{
		Addr: cfg.Redis.Address,
	})

	pool := goredis.NewPool(redisClient)
	redsyncPool := redsync.New(pool)

	var schedulerJobSpecs []scheduler.JobSpec
	if cfg.LedgerSchedule != "" {
		// we do not run the controller if there is no schedule defined.
		schedule, err := time.ParseDuration(cfg.LedgerSchedule)
		if err != nil {
			return fmt.Errorf("failed to parse schedule duration: %w", err)
		}

		jobSpec, err := scheduler.NewLedgerTriggerJobSpec(schedule,
			scheduler.NewLedgerTrigger(v1.NewUsageServiceClient(selfConnection), v1.NewBillingServiceClient(selfConnection), redsyncPool, 30*time.Second),
		)
		if err != nil {
			return fmt.Errorf("failed to setup ledger trigger job: %w", err)
		}

		schedulerJobSpecs = append(schedulerJobSpecs, jobSpec)

	} else {
		log.Info("No controller schedule specified, controller will be disabled.")
	}

	if cfg.ResetUsageSchedule != "" {
		schedule, err := time.ParseDuration(cfg.ResetUsageSchedule)
		if err != nil {
			return fmt.Errorf("failed to parse reset usage schedule as duration: %w", err)
		}

		spec, err := scheduler.NewResetUsageJobSpec(schedule, v1.NewUsageServiceClient(selfConnection), redsyncPool, 30*time.Second)
		if err != nil {
			return fmt.Errorf("failed to setup reset usage job: %w", err)
		}

		schedulerJobSpecs = append(schedulerJobSpecs, spec)
	}

	sched := scheduler.New(schedulerJobSpecs...)
	sched.Start()
	defer sched.Stop()

	err = registerGRPCServices(srv, conn, stripeClient, pricer, cfg)
	if err != nil {
		return fmt.Errorf("failed to register gRPC services: %w", err)
	}

	err = scheduler.RegisterMetrics(srv.MetricsRegistry())
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

func registerGRPCServices(srv *baseserver.Server, conn *gorm.DB, stripeClient *stripe.Client, pricer *apiv1.WorkspacePricer, cfg Config) error {
	ccManager := db.NewCostCenterManager(conn, cfg.DefaultSpendingLimit)
	v1.RegisterUsageServiceServer(srv.GRPC(), apiv1.NewUsageService(conn, pricer, ccManager))

	teamsService := v1connect.NewTeamsServiceClient(http.DefaultClient, fmt.Sprintf("http://%s", cfg.ServerAddress))
	userService := v1connect.NewUserServiceClient(http.DefaultClient, fmt.Sprintf("http://%s", cfg.ServerAddress))

	if stripeClient == nil {
		v1.RegisterBillingServiceServer(srv.GRPC(), &apiv1.BillingServiceNoop{})
	} else {
		v1.RegisterBillingServiceServer(srv.GRPC(), apiv1.NewBillingService(stripeClient, conn, ccManager, cfg.StripePrices, teamsService, userService))
	}
	return nil
}
