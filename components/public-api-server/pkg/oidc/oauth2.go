// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/oauth2"
)

type OAuth2Result struct {
	ClientConfigID string
	OAuth2Token    *oauth2.Token
	ReturnToURL    string
}

type StateParams struct {
	// Gitpod's client config ID, not to be confused with OAuth `clientID`
	ClientConfigID string `json:"clientConfigId"`
	ReturnToURL    string `json:"returnTo"`
	Activate       bool   `json:"activate"`
	Verify         bool   `json:"verify"`
	UseHttpErrors  bool   `json:"useHttpErrors"`
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

func (s *Service) OAuth2Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		config, _, err := s.getClientConfigFromCallbackRequest(r)
		if err != nil {
			log.Warn("client config not found: " + err.Error())
			http.Error(rw, "config not found", http.StatusNotFound)
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

		state, err := s.decodeStateParam(stateParam)
		if err != nil {
			http.Error(rw, "bad state param", http.StatusBadRequest)
			return
		}
		useHttpErrors := state.UseHttpErrors

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(rw, "code param not found", http.StatusBadRequest)
			log.Warn("'code' parameter not found.")
			respondeWithError(rw, r, "'code' parameter not found.", http.StatusInternalServerError, useHttpErrors)
			return
		}

		opts := []oauth2.AuthCodeOption{}
		if config.UsePKCE {
			codeVerifier, err := r.Cookie(verifierCookieName)
			if err != nil {
				http.Error(rw, "code_verifier cookie not found", http.StatusBadRequest)
				return
			}
			opts = append(opts, oauth2.VerifierOption(codeVerifier.Value))
		}

		config.OAuth2Config.RedirectURL = getCallbackURL(r.Host)
		oauth2Token, err := config.OAuth2Config.Exchange(r.Context(), code, opts...)
		if err != nil {
			log.WithError(err).Warn("Failed to exchange OAuth2 token.")
			respondeWithError(rw, r, "Failed to exchange OAuth2 token: "+err.Error(), http.StatusInternalServerError, useHttpErrors)
			return
		}

		ctx := AttachOAuth2ResultToContext(r.Context(), &OAuth2Result{
			OAuth2Token:    oauth2Token,
			ReturnToURL:    state.ReturnToURL,
			ClientConfigID: state.ClientConfigID,
		})
		next.ServeHTTP(rw, r.WithContext(ctx))
	})
}
