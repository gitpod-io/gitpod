// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"net/http"
	"net/url"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/go-chi/chi/v5"
)

func Router(s *Service) *chi.Mux {
	router := chi.NewRouter()

	router.Route("/start", func(r chi.Router) {
		r.Get("/", s.getStartHandler())
	})
	router.Route("/callback", func(r chi.Router) {
		r.Use(s.OAuth2Middleware)
		r.Get("/", s.getCallbackHandler())
	})

	return router
}

const (
	stateCookieName = "state"
	nonceCookieName = "nonce"
)

func (s *Service) getStartHandler() http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		config, err := s.GetClientConfigFromStartRequest(r)
		if err != nil {
			log.Warn("client config not found: " + err.Error())
			http.Error(rw, "config not found", http.StatusNotFound)
			return
		}

		redirectURL := getCallbackURL(r.Host)
		startParams, err := s.GetStartParams(config, redirectURL)
		if err != nil {
			http.Error(rw, "failed to start auth flow", http.StatusInternalServerError)
			return
		}

		http.SetCookie(rw, newCallbackCookie(r, nonceCookieName, startParams.Nonce))
		http.SetCookie(rw, newCallbackCookie(r, stateCookieName, startParams.State))

		http.Redirect(rw, r, startParams.AuthCodeURL, http.StatusTemporaryRedirect)
	}
}

func getCallbackURL(host string) string {
	callbackURL := url.URL{Scheme: "https", Path: "/iam/oidc/callback", Host: host}
	return callbackURL.String()
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

// The OIDC callback handler depends on the state produced in the OAuth2 middleware
func (s *Service) getCallbackHandler() http.HandlerFunc {
	return func(rw http.ResponseWriter, r *http.Request) {
		config, err := s.GetClientConfigFromCallbackRequest(r)
		if err != nil {
			log.Warn("client config not found: " + err.Error())
			http.Error(rw, "config not found", http.StatusNotFound)
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

		log.WithField("id_token", result.IDToken).Trace("user verification was successful")

		cookie, err := s.CreateSession(r.Context(), result)
		if err != nil {
			log.Warn("Failed to create session: " + err.Error())
			http.Error(rw, "Failed to create session", http.StatusInternalServerError)
			return
		}
		http.SetCookie(rw, cookie)
		http.Redirect(rw, r, oauth2Result.ReturnToURL, http.StatusTemporaryRedirect)
	}
}
