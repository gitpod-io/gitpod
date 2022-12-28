// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"path/filepath"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/components/iam-api/go/v1"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/iam/pkg/apiv1"
	"github.com/gitpod-io/gitpod/iam/pkg/config"
	"github.com/gitpod-io/gitpod/iam/pkg/oidc"
	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
)

func Start(logger *logrus.Entry, version string, cfg *config.ServiceConfig) error {
	logger.WithField("config", cfg).Info("Starting IAM server.")

	dbConn, err := db.Connect(db.ConnectionParamsFromEnv())
	if err != nil {
		return fmt.Errorf("failed to establish database connection: %w", err)
	}

	cipherSet, err := db.NewCipherSetFromKeysInFile(filepath.Join(cfg.DatabaseConfigPath, "encryptionKeys"))
	if err != nil {
		return fmt.Errorf("failed to read cipherset from file: %w", err)
	}

	srv, err := baseserver.New("iam",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
		baseserver.WithVersion(version),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize IAM server: %w", err)
	}

	oidcService, err := oidc.NewServiceWithTestConfig(cfg.OIDCClientsConfigFile, cfg.SessionServiceAddress)
	if err != nil {
		return fmt.Errorf("failed to construct oidc service: %w", err)
	}
	oidcClientConfigService := apiv1.NewOIDCClientConfigService(dbConn, cipherSet)

	err = register(srv, &dependencies{
		oidcClientConfigSvc: oidcClientConfigService,
		oidcService:         oidcService,
	})
	if err != nil {
		return fmt.Errorf("failed to register services for iam server: %w", err)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve iam server: %w", listenErr)
	}

	return nil
}

type dependencies struct {
	oidcClientConfigSvc v1.OIDCServiceServer

	oidcService *oidc.Service
}

func register(srv *baseserver.Server, deps *dependencies) error {
	// HTTP
	rootHandler := chi.NewRouter()

	rootHandler.Mount("/oidc", oidc.Router(deps.oidcService))

	// All root requests are handled by our router
	srv.HTTPMux().Handle("/", rootHandler)

	// gRPC
	v1.RegisterOIDCServiceServer(srv.GRPC(), deps.oidcClientConfigSvc)

	return nil
}
