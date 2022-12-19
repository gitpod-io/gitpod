// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/oauth2"

	"github.com/go-chi/chi/v5"
)

func Router(oidcService *Service) *chi.Mux {
	router := chi.NewRouter()

	router.Route("/start", func(r chi.Router) {
		r.Use(oidcService.clientConfigMiddleware())
		r.Get("/", oidcService.getStartHandler())
	})
	router.Route("/callback", func(r chi.Router) {
		r.Use(oidcService.clientConfigMiddleware())
		r.Use(OAuth2Middleware)
		r.Get("/", oidcService.getCallbackHandler())
	})

	return router
}

type keyOIDCClientConfig struct{}

const (
	stateCookieName = "state"
	nonceCookieName = "nonce"
)

func (s *Service) getStartHandler() http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		log.Trace("at start handler")

		ctx := r.Context()
		config, ok := ctx.Value(keyOIDCClientConfig{}).(ClientConfig)
		if !ok {
			http.Error(rw, "config not found", http.StatusInternalServerError)
			return
		}

		startParams, err := s.GetStartParams(&config)
		if err != nil {
			http.Error(rw, "failed to start auth flow", http.StatusInternalServerError)
			return
		}

		http.SetCookie(rw, newCallbackCookie(r, nonceCookieName, startParams.Nonce))
		http.SetCookie(rw, newCallbackCookie(r, stateCookieName, startParams.State))

		http.Redirect(rw, r, startParams.AuthCodeURL, http.StatusTemporaryRedirect)
	}
}

func newCallbackCookie(r *http.Request, name string, value string) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		MaxAge:   int(10 * time.Minute.Seconds()),
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
		HttpOnly: true,
	}
}

// The config middleware is responsible to retrieve the client config suitable for request
func (s *Service) clientConfigMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			log.Trace("at config middleware")

			config, err := s.GetClientConfigFromRequest(r)
			if err != nil {
				log.Warn("client config not found: " + err.Error())
				http.Error(rw, "config not found", http.StatusNotFound)
				return
			}

			ctx := context.WithValue(r.Context(), keyOIDCClientConfig{}, config)
			next.ServeHTTP(rw, r.WithContext(ctx))
		})
	}
}

// The OIDC callback handler depends on the state produced in the OAuth2 middleware
func (s *Service) getCallbackHandler() http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		log.Trace("at callback handler")

		ctx := r.Context()
		config, ok := ctx.Value(keyOIDCClientConfig{}).(ClientConfig)
		if !ok {
			http.Error(rw, "config not found", http.StatusInternalServerError)
			return
		}
		oauth2Result, ok := ctx.Value(keyOAuth2Result{}).(OAuth2Result)
		if !ok {
			http.Error(rw, "OIDC precondition failure", http.StatusInternalServerError)
			return
		}

		// nonce = number used once
		nonceCookie, err := r.Cookie(nonceCookieName)
		if err != nil {
			http.Error(rw, "nonce not found", http.StatusBadRequest)
			return
		}

		result, err := s.Authenticate(ctx, &oauth2Result,
			config.Issuer, nonceCookie.Value)
		if err != nil {
			http.Error(rw, "OIDC authentication failed", http.StatusInternalServerError)
			return
		}

		// TODO(at) given the result of OIDC authN, let's proceed with the redirect

		// For testing purposes, let's print out redacted results
		oauth2Result.OAuth2Token.AccessToken = "*** REDACTED ***"

		var claims map[string]interface{}
		err = result.IDToken.Claims(&claims)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		resp := struct {
			OAuth2Token *oauth2.Token
			Claims      map[string]interface{}
		}{oauth2Result.OAuth2Token, claims}

		data, err := json.MarshalIndent(resp, "", "    ")
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		_, err = rw.Write(data)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
		}
	}
}
