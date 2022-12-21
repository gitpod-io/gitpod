// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"net"
	"os"

	goidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/iam/pkg/config"
	"github.com/gitpod-io/gitpod/iam/pkg/oidc"
	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
	"golang.org/x/oauth2"
)

func Start(logger *logrus.Entry, version string, cfg *config.ServiceConfig) error {
	logger.WithField("config", cfg).Info("Starting IAM server.")

	_, err := db.Connect(db.ConnectionParams{
		User:     os.Getenv("DB_USERNAME"),
		Password: os.Getenv("DB_PASSWORD"),
		Host:     net.JoinHostPort(os.Getenv("DB_HOST"), os.Getenv("DB_PORT")),
		Database: "gitpod",
		CaCert:   os.Getenv("DB_CA_CERT"),
	})
	if err != nil {
		return fmt.Errorf("failed to establish database connection: %w", err)
	}

	srv, err := baseserver.New("iam",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
		baseserver.WithVersion(version),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize IAM server: %w", err)
	}

	// All root requests are handled by our router
	rootHandler, err := registerRootRouter(srv)
	if err != nil {
		return fmt.Errorf("failed to register services to iam server")
	}

	// Requests to /oidc/* are handled by oidc.Router
	oidcService := oidc.NewService()
	rootHandler.Mount("/oidc", oidc.Router(oidcService))

	// TODO(at) remove the demo config after start sync'ing with DB
	err = loadTestConfig(oidcService, cfg)
	if err != nil {
		log.Errorf("failed to load test config: %v", err)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve iam server: %w", listenErr)
	}

	return nil
}

func registerRootRouter(srv *baseserver.Server) (*chi.Mux, error) {
	rootHandler := chi.NewRouter()

	srv.HTTPMux().Handle("/", rootHandler)
	return rootHandler, nil
}

// TODO(at) remove the demo config after start sync'ing with DB
func loadTestConfig(s *oidc.Service, cfg *config.ServiceConfig) error {
	testConfig, err := oidc.ReadDemoConfigFromFile(cfg.OIDCClientsConfigFile)
	if err != nil {
		return fmt.Errorf("failed to read test config: %w", err)
	}
	oidcConfig := &goidc.Config{
		ClientID: testConfig.ClientID,
	}
	oauth2Config := &oauth2.Config{
		ClientID:     testConfig.ClientID,
		ClientSecret: testConfig.ClientSecret,
		RedirectURL:  testConfig.RedirectURL,
		Scopes:       []string{goidc.ScopeOpenID, "profile", "email"},
	}
	clientConfig := &oidc.ClientConfig{
		Issuer:         testConfig.Issuer,
		ID:             "R4ND0M1D",
		OAuth2Config:   oauth2Config,
		VerifierConfig: oidcConfig,
	}
	return s.AddClientConfig(clientConfig)
}
