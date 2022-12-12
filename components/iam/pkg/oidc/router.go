// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"github.com/go-chi/chi/v5"
	"net/http"
)

func Router() *chi.Mux {
	router := chi.NewMux()

	router.HandleFunc("/start", func(writer http.ResponseWriter, request *http.Request) {
		writer.Write([]byte(`hello`))
	})

	return router
}
