// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/iam/pkg/config"
	"github.com/gitpod-io/gitpod/iam/pkg/oidc"
	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
)

func Start(logger *logrus.Entry, version string, cfg *config.ServiceConfig) error {
	logger.WithField("config", cfg).Info("Starting IAM server.")

	srv, err := baseserver.New("iam",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
		baseserver.WithVersion(version),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize iam server: %w", err)
	}

	err = register(srv)
	if err != nil {
		return fmt.Errorf("failed to register services to iam server")
	}

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve iam server: %w", err)
	}

	return nil
}

func register(srv *baseserver.Server) error {
	router := chi.NewMux()
	router.Mount("/oidc", oidc.Router())

	// All root requests are handled by our router
	srv.HTTPMux().Handle("/", router)
	return nil
}
