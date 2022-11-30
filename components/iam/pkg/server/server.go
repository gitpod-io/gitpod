// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/iam/pkg/config"
	"github.com/sirupsen/logrus"
)

func Start(logger *logrus.Entry, version string, cfg *config.ServiceConfig) error {
	logger.WithField("config", cfg).Info("starting IAM server.")

	srv, err := baseserver.New("iam",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
		baseserver.WithVersion(version),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize iam server: %w", err)
	}

	srv.HTTPMux().HandleFunc("/tada", func(w http.ResponseWriter, r *http.Request) {
		//nolint
		w.Write([]byte("🎉"))
	})

	srv.HTTPMux().HandleFunc("/oidc", func(w http.ResponseWriter, r *http.Request) {
		//nolint
		w.Write([]byte("oidc"))
	})

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		return fmt.Errorf("failed to serve iam server: %w", err)
	}

	return nil
}
