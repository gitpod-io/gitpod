// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/oauth2"
)

type OAuth2Result struct {
	OAuth2Token *oauth2.Token
	Redirect    string
}

type keyOAuth2Result struct{}

func OAuth2Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		log.Trace("at oauth2 middleware")
		ctx := r.Context()
		config, ok := ctx.Value(keyOIDCClientConfig{}).(ClientConfig)
		if !ok {
			http.Error(rw, "config not found", http.StatusInternalServerError)
			return
		}

		// http-only cookie written during flow start request
		stateCookie, err := r.Cookie(stateCookieName)
		if err != nil {
			http.Error(rw, "state cookie not found", http.StatusBadRequest)
			return
		}
		// the starte param passed back from IdP
		stateParam := r.URL.Query().Get("state")
		if stateParam == "" {
			http.Error(rw, "state param not found", http.StatusBadRequest)
			return
		}
		// on mismatch, obviously there is a client side error
		if stateParam != stateCookie.Value {
			http.Error(rw, "state did not match", http.StatusBadRequest)
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(rw, "code param not found", http.StatusBadRequest)
			return
		}

		oauth2Token, err := config.OAuth2Config.Exchange(ctx, code)
		if err != nil {
			http.Error(rw, "failed to exchange token: "+err.Error(), http.StatusInternalServerError)
			return
		}

		ctx = context.WithValue(ctx, keyOAuth2Result{}, OAuth2Result{
			OAuth2Token: oauth2Token,
		})
		next.ServeHTTP(rw, r.WithContext(ctx))
	})
}
