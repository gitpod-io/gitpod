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
			log.WithError(err).Warn("Failed to start SSO sing-in flow.")
			http.Error(rw, "We were unable to find the SSO configuration you've requested. Please ensure your SSO configuration is correct, and validated.", http.StatusNotFound)
			return
		}

		returnToURL := r.URL.Query().Get("returnTo")
		if returnToURL == "" {
			returnToURL = "/"
		}

		activate := false
		if r.URL.Query().Get("activate") != "" {
			activate = true
		}

		redirectURL := getCallbackURL(r.Host)

		startParams, err := s.GetStartParams(config, redirectURL, StateParams{
			ClientConfigID: config.ID,
			ReturnToURL:    returnToURL,
			Activate:       activate,
		})
		if err != nil {
			log.WithError(err).Error("Failed to get start parameters for authentication flow.")
			http.Error(rw, "We were unable to start the authentication flow for system reasons.", http.StatusInternalServerError)
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
		config, state, err := s.GetClientConfigFromCallbackRequest(r)
		if err != nil {
			log.WithError(err).Warn("Client SSO config not found")
			http.Error(rw, "We were unable to find the SSO configuration you've requested. Please ensure your SSO configuration is correct, and validated.", http.StatusNotFound)
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
			http.Error(rw, "There was no nonce present on the request. Please try logging in again.", http.StatusBadRequest)
			return
		}
		result, err := s.Authenticate(r.Context(), AuthenticateParams{
			Config:           config,
			OAuth2Result:     oauth2Result,
			NonceCookieValue: nonceCookie.Value,
		})
		if err != nil {
			log.WithError(err).Warn("OIDC authentication failed")
			http.Error(rw, "We've not been able to authenticate you with the OIDC Provider. Please try again.", http.StatusInternalServerError)
			return
		}

		log.WithField("id_token", result.IDToken).Trace("User verification was successful")

		if state.Activate {
			err = s.ActivateClientConfig(r.Context(), config)
			if err != nil {
				log.WithError(err).Warn("Failed to mark OIDC Client Config as active")
				http.Error(rw, "We've been unable to mark the selected OIDC config as active. Please try again.", http.StatusInternalServerError)
				return
			}
		}

		cookie, _, err := s.CreateSession(r.Context(), result, config)
		if err != nil {
			log.WithError(err).Warn("Failed to create session from downstream session provider.")
			http.Error(rw, "We were unable to create a user session. Please try again.", http.StatusInternalServerError)
			return
		}
		http.SetCookie(rw, cookie)
		http.Redirect(rw, r, oauth2Result.ReturnToURL, http.StatusTemporaryRedirect)
	}
}
