// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/go-chi/chi/v5"
)

func Router(s *Service) *chi.Mux {
	router := chi.NewRouter()

	router.Route("/start", func(r chi.Router) {
		r.Use(s.clientConfigMiddleware())
		r.Get("/", s.getStartHandler())
	})
	router.Route("/callback", func(r chi.Router) {
		r.Use(s.clientConfigMiddleware())
		r.Use(OAuth2Middleware)
		r.Get("/", s.getCallbackHandler())
	})

	return router
}

type keyOIDCClientConfig struct{}

const (
	stateCookieName = "state"
	nonceCookieName = "nonce"
)

func AttachClientConfigToContext(parentContext context.Context, config *ClientConfig) context.Context {
	childContext := context.WithValue(parentContext, keyOIDCClientConfig{}, config)
	return childContext
}

func GetClientConfigFromContext(ctx context.Context) *ClientConfig {
	value, ok := ctx.Value(keyOIDCClientConfig{}).(*ClientConfig)
	if !ok {
		return nil
	}
	return value
}

func (s *Service) getStartHandler() http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		config := GetClientConfigFromContext(r.Context())
		if config == nil {
			http.Error(rw, "config not found", http.StatusInternalServerError)
			return
		}

		startParams, err := s.GetStartParams(config)
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
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		HttpOnly: true,
	}
}

// The config middleware is responsible to retrieve the client config suitable for request
func (s *Service) clientConfigMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			config, err := s.GetClientConfigFromRequest(r)
			if err != nil {
				log.Warn("client config not found: " + err.Error())
				http.Error(rw, "config not found", http.StatusNotFound)
				return
			}

			ctx := AttachClientConfigToContext(r.Context(), config)
			next.ServeHTTP(rw, r.WithContext(ctx))
		})
	}
}

// The OIDC callback handler depends on the state produced in the OAuth2 middleware
func (s *Service) getCallbackHandler() http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		config := GetClientConfigFromContext(r.Context())
		if config == nil {
			http.Error(rw, "config not found", http.StatusInternalServerError)
			return
		}
		oauth2Result := GetOAuth2ResultFromContext(r.Context())
		if oauth2Result == nil {
			http.Error(rw, "OIDC precondition failure", http.StatusInternalServerError)
			return
		}

		// nonce = number used once
		nonceCookie, err := r.Cookie(nonceCookieName)
		if err != nil {
			http.Error(rw, "nonce not found", http.StatusBadRequest)
			return
		}
		result, err := s.Authenticate(r.Context(), AuthenticateParams{
			OAuth2Result:     oauth2Result,
			Issuer:           config.Issuer,
			NonceCookieValue: nonceCookie.Value,
		})
		if err != nil {
			log.Warn("OIDC authentication failed: " + err.Error())
			http.Error(rw, "OIDC authentication failed", http.StatusInternalServerError)
			return
		}

		// TODO(at) given the result of OIDC authN, let's proceed with the redirect
		log.WithField("id_token", result.IDToken).Trace("user verification was successful")

		returnToURL := oauth2Result.ReturnToURL
		http.Redirect(rw, r, returnToURL, http.StatusTemporaryRedirect)
	}
}
