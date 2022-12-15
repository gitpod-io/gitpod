// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/url"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-chi/chi/v5"
	"golang.org/x/oauth2"
)

type OIDCService struct {
	Handler chi.Router

	configsById      map[string]*OIDCClientConfig
	verifierByIssuer map[string]*oidc.IDTokenVerifier
	providerByIssuer map[string]*oidc.Provider
}

type OIDCClientConfig struct {
	ID           string
	Issuer       string
	OAuth2Config *oauth2.Config
	OIDCConfig   *oidc.Config
}

type OIDCStartParams struct {
	State       string
	Nonce       string
	AuthCodeURL string
}

type OIDCAuthResult struct {
	IDToken *oidc.IDToken
}

func NewOIDCService() *OIDCService {
	var s OIDCService
	s.configsById = make(map[string]*OIDCClientConfig)
	s.verifierByIssuer = make(map[string]*oidc.IDTokenVerifier)
	s.providerByIssuer = make(map[string]*oidc.Provider)
	return &s
}

func (service *OIDCService) AddClientConfig(config *OIDCClientConfig) error {
	if service.providerByIssuer[config.Issuer] == nil {
		provider, err := oidc.NewProvider(context.Background(), config.Issuer)
		if err != nil {
			return errors.New("OIDC discovery failed: " + err.Error())
		}
		service.providerByIssuer[config.Issuer] = provider
		service.verifierByIssuer[config.Issuer] = provider.Verifier(config.OIDCConfig)
	}

	config.OAuth2Config.Endpoint = service.providerByIssuer[config.Issuer].Endpoint()
	service.configsById[config.ID] = config
	return nil
}

func (service *OIDCService) GetStartParams(config *OIDCClientConfig) (*OIDCStartParams, error) {
	// TODO(at) state should be a JWT encoding a redirect location
	// Using a random string to get the flow running.
	state, err := randString(32)
	if err != nil {
		return nil, errors.New("failed to create state")
	}

	nonce, err := randString(32)
	if err != nil {
		return nil, errors.New("failed to create nonce")
	}

	// Nonce is the single option passed on to configure the consent page ATM.
	authCodeURL := config.OAuth2Config.AuthCodeURL(state, oidc.Nonce(nonce))

	return &OIDCStartParams{
		AuthCodeURL: authCodeURL,
		State:       state,
		Nonce:       nonce,
	}, nil
}

func randString(size int) (string, error) {
	b := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (service *OIDCService) GetClientConfigFromRequest(r *http.Request) (*OIDCClientConfig, error) {
	issuerParam := r.URL.Query().Get("issuer")
	if issuerParam == "" {
		return nil, errors.New("issuer param not specified")
	}
	issuer, err := url.QueryUnescape(issuerParam)
	if err != nil {
		return nil, errors.New("bad issuer param")
	}
	log.WithField("issuer", issuer).Trace("at GetClientConfigFromRequest")

	for _, value := range service.configsById {
		if value.Issuer == issuer {
			return value, nil
		}
	}
	return nil, errors.New("failed to find OIDC config for request")
}

func (service *OIDCService) Authenticate(ctx context.Context, oauth2Result *OAuth2Result, issuer string, nonceCookieValue string) (*OIDCAuthResult, error) {
	rawIDToken, ok := oauth2Result.OAuth2Token.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("id_token not found")
	}

	verifier := service.verifierByIssuer[issuer]
	if verifier == nil {
		return nil, errors.New("verifier not found")
	}

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, errors.New("failed to verify id_token: " + err.Error())
	}

	if idToken.Nonce != nonceCookieValue {
		return nil, errors.New("nonce mismatch")
	}
	return &OIDCAuthResult{
		IDToken: idToken,
	}, nil
}
