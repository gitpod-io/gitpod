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

	oidcService := oidc.NewOIDCService()
	err = register(srv, oidcService)
	if err != nil {
		return fmt.Errorf("failed to register services to iam server")
	}

	// TODO(at) remove the demo config after start sync'ing with DB
	clientConfig, err := loadTestConfig(cfg.OIDCClientsConfigFile)
	if err != nil {
		return fmt.Errorf("failed to load test config")
	}

	err = oidcService.AddClientConfig(clientConfig)
	if err != nil {
		return fmt.Errorf("failed to add client config to oidc service: %w", err)
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve iam server: %w", listenErr)
	}

	return nil
}

func register(srv *baseserver.Server, oidcSvc *oidc.OIDCService) error {
	root := chi.NewRouter()

	root.Mount("/oidc", oidc.Router(oidcSvc))

	// All root requests are handled by our router
	srv.HTTPMux().Handle("/", root)
	return nil
}

// TODO(at) remove the demo config after start sync'ing with DB
func loadTestConfig(clientsConfigFilePath string) (*oidc.OIDCClientConfig, error) {
	testConfig, err := oidc.ReadDemoConfigFromFile(clientsConfigFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read test config: %w", err)
	}

	return &oidc.OIDCClientConfig{
		Issuer: testConfig.Issuer,
		ID:     "R4ND0M1D",
		OAuth2Config: &oauth2.Config{
			ClientID:     testConfig.ClientID,
			ClientSecret: testConfig.ClientSecret,
			RedirectURL:  testConfig.RedirectURL,
			Scopes:       []string{goidc.ScopeOpenID, "profile", "email"},
		},
		OIDCConfig: &goidc.Config{
			ClientID: testConfig.ClientID,
		},
	}, nil
}
