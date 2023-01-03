// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"net/http"

	"golang.org/x/oauth2"
)

type OAuth2Result struct {
	ClientID    string
	OAuth2Token *oauth2.Token
	ReturnToURL string
}

type StateParam struct {
	// Internal client ID
	ClientConfigID string `json:"clientId"`

	ReturnToURL string `json:"returnTo"`
}

type keyOAuth2Result struct{}

func AttachOAuth2ResultToContext(parentContext context.Context, result *OAuth2Result) context.Context {
	childContext := context.WithValue(parentContext, keyOAuth2Result{}, result)
	return childContext
}

func GetOAuth2ResultFromContext(ctx context.Context) *OAuth2Result {
	value, ok := ctx.Value(keyOAuth2Result{}).(*OAuth2Result)
	if !ok {
		return nil
	}
	return value
}

func OAuth2Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		config := GetClientConfigFromContext(r.Context())
		if config == nil {
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

		state, err := decodeStateParam(stateParam)
		if err != nil {
			http.Error(rw, "bad state param", http.StatusBadRequest)
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(rw, "code param not found", http.StatusBadRequest)
			return
		}

		oauth2Token, err := config.OAuth2Config.Exchange(r.Context(), code)
		if err != nil {
			http.Error(rw, "failed to exchange token: "+err.Error(), http.StatusInternalServerError)
			return
		}

		ctx := AttachOAuth2ResultToContext(r.Context(), &OAuth2Result{
			OAuth2Token: oauth2Token,
			ReturnToURL: state.ReturnToURL,
			ClientID:    state.ClientConfigID,
		})
		next.ServeHTTP(rw, r.WithContext(ctx))
	})
}
