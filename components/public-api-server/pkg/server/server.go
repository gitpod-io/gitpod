// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-chi/chi/v5"
	chi_middleware "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gorilla/handlers"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/public-api-server/middleware"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/apiv1"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/identityprovider"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/oidc"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/origin"
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

	redisClient := redis.NewClient(&redis.Options{
		Addr: cfg.Redis.Address,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = redisClient.Ping(ctx).Err()
	if err != nil {
		return fmt.Errorf("redis is unavailable at %s", cfg.Redis.Address)
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

	keyset, err := jws.NewKeySetFromAuthPKI(cfg.Auth.PKI)
	if err != nil {
		return fmt.Errorf("failed to setup JWS Keyset: %w", err)
	}
	rsa256, err := jws.NewRSA256(keyset)
	if err != nil {
		return fmt.Errorf("failed to setup jws.RSA256: %w", err)
	}
	hs256 := jws.NewHS256FromKeySet(keyset)

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

	oidcService := oidc.NewService(cfg.SessionServiceAddress, dbConn, cipherSet, hs256, 5*time.Minute)

	if redisClient == nil {
		return fmt.Errorf("no Redis configiured")
	}
	idpService, err := identityprovider.NewService(strings.TrimSuffix(cfg.PublicURL, "/")+"/idp", identityprovider.NewRedisCache(context.Background(), redisClient))
	if err != nil {
		return err
	}

	if registerErr := register(srv, &registerDependencies{
		connPool:        connPool,
		expClient:       expClient,
		dbConn:          dbConn,
		signer:          signer,
		cipher:          cipherSet,
		oidcService:     oidcService,
		idpService:      idpService,
		authCfg:         cfg.Auth,
		sessionVerifier: rsa256,
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
	cipher      db.Cipher
	oidcService *oidc.Service
	idpService  *identityprovider.Service

	sessionVerifier jws.SignerVerifier
	authCfg         config.AuthConfiguration
}

func register(srv *baseserver.Server, deps *registerDependencies) error {
	proxy.RegisterMetrics(srv.MetricsRegistry())
	oidc.RegisterMetrics(srv.MetricsRegistry())

	connectMetrics := NewConnectMetrics()
	err := connectMetrics.Register(srv.MetricsRegistry())
	if err != nil {
		return err
	}

	rootHandler := chi.NewRouter()
	rootHandler.Use(chi_middleware.Recoverer)
	rootHandler.Use(middleware.NewLoggingMiddleware())

	handlerOptions := []connect.HandlerOption{
		connect.WithInterceptors(
			NewMetricsInterceptor(connectMetrics),
			NewLogInterceptor(log.Log),
			auth.NewServerInterceptor(deps.authCfg.Session, deps.sessionVerifier),
			origin.NewInterceptor(),
		),
	}

	rootHandler.Mount(v1connect.NewWorkspacesServiceHandler(apiv1.NewWorkspaceService(deps.connPool, deps.expClient), handlerOptions...))
	rootHandler.Mount(v1connect.NewTeamsServiceHandler(apiv1.NewTeamsService(deps.connPool), handlerOptions...))
	rootHandler.Mount(v1connect.NewUserServiceHandler(apiv1.NewUserService(deps.connPool), handlerOptions...))
	rootHandler.Mount(v1connect.NewIDEClientServiceHandler(apiv1.NewIDEClientService(deps.connPool), handlerOptions...))
	rootHandler.Mount(v1connect.NewProjectsServiceHandler(apiv1.NewProjectsService(deps.connPool), handlerOptions...))
	rootHandler.Mount(v1connect.NewOIDCServiceHandler(apiv1.NewOIDCService(deps.connPool, deps.expClient, deps.dbConn, deps.cipher), handlerOptions...))
	rootHandler.Mount(v1connect.NewIdentityProviderServiceHandler(apiv1.NewIdentityProviderService(deps.connPool, deps.idpService), handlerOptions...))

	if deps.signer != nil {
		rootHandler.Mount(v1connect.NewTokensServiceHandler(apiv1.NewTokensService(deps.connPool, deps.expClient, deps.dbConn, deps.signer), handlerOptions...))
	}

	// OIDC sign-in handlers
	rootHandler.Mount("/oidc", oidc.Router(deps.oidcService))

	// The OIDC spec dictates how the identity provider endpoint needs to look like,
	// hence the extra endpoint rather than making this part of the proto API.
	// See https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationRequest
	rootHandler.Mount("/idp", deps.idpService.Router())

	// All requests are handled by our root router
	srv.HTTPMux().Handle("/", rootHandler)

	return nil
}

func readSecretFromFile(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read secret from file: %w", err)
	}

	return strings.TrimSpace(string(b)), nil
}
