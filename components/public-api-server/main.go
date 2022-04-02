// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"net/http"
)

func main() {
	logger := log.New()
	srv, err := baseserver.New("public_api_server",
		baseserver.WithLogger(logger),
		baseserver.WithHTTPPort(9000),
		baseserver.WithGRPCPort(9001),
	)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize public api server.")
	}

	srv.HTTPMux().HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`hello world\n`))
	})

	if listenErr := srv.ListenAndServe(); listenErr != nil {
		logger.WithError(listenErr).Fatal("Failed to serve public api server")
	}
}
