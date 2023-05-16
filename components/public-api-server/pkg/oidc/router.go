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
		config, err := s.getClientConfigFromStartRequest(r)
		if err != nil {
			log.WithError(err).Warn("Failed to start SSO sing-in flow.")
			http.Error(rw, "We were unable to find the SSO configuration you've requested. Please verify SSO is configured with your Organization owner.", http.StatusNotFound)
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

		// `activate` overrides a `verify` parameter
		verify := false
		if !activate && r.URL.Query().Get("verify") != "" {
			verify = true
		}

		redirectURL := getCallbackURL(r.Host)

		startParams, err := s.getStartParams(config, redirectURL, StateParams{
			ClientConfigID: config.ID,
			ReturnToURL:    returnToURL,
			Activate:       activate,
			Verify:         verify,
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
		config, state, err := s.getClientConfigFromCallbackRequest(r)
		if err != nil {
			log.WithError(err).Warn("Client SSO config not found")
			http.Error(rw, "We were unable to find the SSO configuration you've requested. Please verify SSO is configured with your Organization owner.", http.StatusNotFound)
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
			http.Error(rw, "There was no nonce present on the request. Please try to sign-in in again.", http.StatusBadRequest)
			return
		}
		result, err := s.authenticate(r.Context(), authenticateParams{
			Config:           config,
			OAuth2Result:     oauth2Result,
			NonceCookieValue: nonceCookie.Value,
		})
		if err != nil {
			log.WithError(err).Warn("OIDC authentication failed")
			http.Error(rw, "We've not been able to authenticate you with the OIDC Provider.", http.StatusInternalServerError)
			return
		}

		log.WithField("id_token", result.IDToken).Trace("User verification was successful")

		if state.Activate {
			err = s.activateAndVerifyClientConfig(r.Context(), config)
			if err != nil {
				log.WithError(err).Warn("Failed to mark OIDC Client Config as active")
				http.Error(rw, "We've been unable to mark the selected OIDC config as active. Please try again.", http.StatusInternalServerError)
				return
			}
		}

		if state.Verify {
			err = s.markClientConfigAsVerified(r.Context(), config)
			if err != nil {
				log.Warn("Failed to mark config as verified: " + err.Error())
				http.Error(rw, "Failed to mark config as verified", http.StatusInternalServerError)
				return
			}
		}

		// Skip the sign-in on verify-only requests.
		if !state.Verify {
			cookie, _, err := s.createSession(r.Context(), result, config)
			if err != nil {
				log.WithError(err).Warn("Failed to create session from downstream session provider.")
				http.Error(rw, "We were unable to create a user session.", http.StatusInternalServerError)
				return
			}
			http.SetCookie(rw, cookie)
		}

		http.Redirect(rw, r, oauth2Result.ReturnToURL, http.StatusTemporaryRedirect)
	}
}
