// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"

	goidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/iam/pkg/config"
	"github.com/gitpod-io/gitpod/iam/pkg/oidc"
	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
	"golang.org/x/oauth2"
)

func Start(logger *logrus.Entry, version string, cfg *config.ServiceConfig) error {
	logger.WithField("config", cfg).Info("Starting IAM server.")

	logger.Logger.SetLevel(logrus.TraceLevel)

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
	oidcService := oidc.NewOIDCService()
	rootHandler.Mount("/oidc", oidc.Router(oidcService))

	// TODO(at) remove the demo config after start sync'ing with DB
	err = loadTestConfig(oidcService, cfg)
	if err != nil {
		return fmt.Errorf("failed to load test config")
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
func loadTestConfig(oidcService *oidc.OIDCService, cfg *config.ServiceConfig) error {
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
	clientConfig := &oidc.OIDCClientConfig{
		Issuer:       testConfig.Issuer,
		ID:           "R4ND0M1D",
		OAuth2Config: oauth2Config,
		OIDCConfig:   oidcConfig,
	}
	err = oidcService.AddClientConfig(clientConfig)
	return err
}
