// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"gorm.io/gorm"

	grpc "google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	iam "github.com/gitpod-io/gitpod/components/iam-api/go/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gorilla/handlers"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/apiv1"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/webhooks"
	"github.com/sirupsen/logrus"
)

func Start(logger *logrus.Entry, version string, cfg *config.Configuration) error {
	logger.WithField("config", cfg).Info("Starting public-api.")

	if cfg.OIDCServiceAddress == "" {
		return fmt.Errorf("`oidcServiceAddress` is missing in config")
	}

	gitpodAPI, err := url.Parse(cfg.GitpodServiceURL)
	if err != nil {
		return fmt.Errorf("failed to parse Gitpod API URL: %w", err)
	}

	connPool, err := proxy.NewConnectionPool(gitpodAPI, 500)
	if err != nil {
		return fmt.Errorf("failed to setup connection pool: %w", err)
	}

	dbConn, err := db.Connect(db.ConnectionParamsFromEnv())
	if err != nil {
		return fmt.Errorf("failed to establish database connection: %w", err)
	}

	cipherSet, err := db.NewCipherSetFromKeysInFile(filepath.Join(cfg.DatabaseConfigPath, "encryptionKeys"))
	if err != nil {
		return fmt.Errorf("failed to read cipherset from file: %w", err)
	}

	expClient := experiments.NewClient()

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
		stripeWebhookSecret, err := readSecretFromFile(cfg.StripeWebhookSigningSecretPath)
		if err != nil {
			return fmt.Errorf("failed to read stripe secret: %w", err)
		}
		stripeWebhookHandler = webhooks.NewStripeWebhookHandler(billingService, stripeWebhookSecret)
	} else {
		log.Info("No stripe webhook secret is configured, endpoints will return NotImplemented")
	}

	var signer auth.Signer
	if cfg.PersonalAccessTokenSigningKeyPath != "" {
		personalACcessTokenSigningKey, err := readSecretFromFile(cfg.PersonalAccessTokenSigningKeyPath)
		if err != nil {
			return fmt.Errorf("failed to read personal access token signing key: %w", err)
		}

		signer = auth.NewHS256Signer([]byte(personalACcessTokenSigningKey))
	} else {
		log.Info("No Personal Access Token signign key specified, PersonalAccessToken service will be disabled.")
	}

	srv.HTTPMux().Handle("/stripe/invoices/webhook", handlers.ContentTypeHandler(stripeWebhookHandler, "application/json"))

	conn, err := grpc.Dial(cfg.OIDCServiceAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("failed to dial oidc service gRPC server: %w", err)
	}
	var oidcService = iam.NewOIDCServiceClient(conn)

	if registerErr := register(srv, &registerDependencies{
		connPool:    connPool,
		expClient:   expClient,
		dbConn:      dbConn,
		signer:      signer,
		oidcService: oidcService,
		cipher:      cipherSet,
	}); registerErr != nil {
		return fmt.Errorf("failed to register services: %w", registerErr)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve public api server: %w", listenErr)
	}

	return nil
}

type registerDependencies struct {
	connPool    proxy.ServerConnectionPool
	expClient   experiments.Client
	dbConn      *gorm.DB
	signer      auth.Signer
	oidcService iam.OIDCServiceClient
	cipher      db.Cipher
}

func register(srv *baseserver.Server, deps *registerDependencies) error {
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

	workspacesRoute, workspacesServiceHandler := v1connect.NewWorkspacesServiceHandler(apiv1.NewWorkspaceService(deps.connPool), handlerOptions...)
	srv.HTTPMux().Handle(workspacesRoute, workspacesServiceHandler)

	teamsRoute, teamsServiceHandler := v1connect.NewTeamsServiceHandler(apiv1.NewTeamsService(deps.connPool), handlerOptions...)
	srv.HTTPMux().Handle(teamsRoute, teamsServiceHandler)

	if deps.signer != nil {
		tokensRoute, tokensServiceHandler := v1connect.NewTokensServiceHandler(apiv1.NewTokensService(deps.connPool, deps.expClient, deps.dbConn, deps.signer), handlerOptions...)
		srv.HTTPMux().Handle(tokensRoute, tokensServiceHandler)
	}

	userRoute, userServiceHandler := v1connect.NewUserServiceHandler(apiv1.NewUserService(deps.connPool), handlerOptions...)
	srv.HTTPMux().Handle(userRoute, userServiceHandler)

	ideClientRoute, ideClientServiceHandler := v1connect.NewIDEClientServiceHandler(apiv1.NewIDEClientService(deps.connPool), handlerOptions...)
	srv.HTTPMux().Handle(ideClientRoute, ideClientServiceHandler)

	projectsRoute, projectsServiceHandler := v1connect.NewProjectsServiceHandler(apiv1.NewProjectsService(deps.connPool), handlerOptions...)
	srv.HTTPMux().Handle(projectsRoute, projectsServiceHandler)

	oidcRoute, oidcServiceHandler := v1connect.NewOIDCServiceHandler(apiv1.NewOIDCService(deps.connPool, deps.expClient, deps.oidcService, deps.dbConn, deps.cipher), handlerOptions...)
	srv.HTTPMux().Handle(oidcRoute, oidcServiceHandler)

	return nil
}

func readSecretFromFile(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read secret from file: %w", err)
	}

	return strings.TrimSpace(string(b)), nil
}
