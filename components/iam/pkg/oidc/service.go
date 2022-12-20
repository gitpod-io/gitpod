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
	"golang.org/x/oauth2"
)

type Service struct {
	configsById      map[string]*ClientConfig
	verifierByIssuer map[string]*oidc.IDTokenVerifier
	providerByIssuer map[string]*oidc.Provider
}

type ClientConfig struct {
	ID             string
	Issuer         string
	OAuth2Config   *oauth2.Config
	VerifierConfig *oidc.Config
}

type StartParams struct {
	State       string
	Nonce       string
	AuthCodeURL string
}

type AuthFlowResult struct {
	IDToken *oidc.IDToken
}

func NewService() *Service {
	return &Service{
		configsById:      map[string]*ClientConfig{},
		verifierByIssuer: map[string]*oidc.IDTokenVerifier{},
		providerByIssuer: map[string]*oidc.Provider{},
	}
}

func (s *Service) AddClientConfig(config *ClientConfig) error {
	if s.providerByIssuer[config.Issuer] == nil {
		provider, err := oidc.NewProvider(context.Background(), config.Issuer)
		if err != nil {
			return errors.New("OIDC discovery failed: " + err.Error())
		}
		s.providerByIssuer[config.Issuer] = provider
		s.verifierByIssuer[config.Issuer] = provider.Verifier(config.VerifierConfig)
	}

	config.OAuth2Config.Endpoint = s.providerByIssuer[config.Issuer].Endpoint()
	s.configsById[config.ID] = config
	return nil
}

func (s *Service) GetStartParams(config *ClientConfig) (*StartParams, error) {
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

	return &StartParams{
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

func (s *Service) GetClientConfigFromRequest(r *http.Request) (*ClientConfig, error) {
	issuerParam := r.URL.Query().Get("issuer")
	if issuerParam == "" {
		return nil, errors.New("issuer param not specified")
	}
	issuer, err := url.QueryUnescape(issuerParam)
	if err != nil {
		return nil, errors.New("bad issuer param")
	}
	log.WithField("issuer", issuer).Trace("at GetClientConfigFromRequest")

	for _, value := range s.configsById {
		if value.Issuer == issuer {
			return value, nil
		}
	}
	return nil, errors.New("failed to find OIDC config for request")
}

func (s *Service) Authenticate(ctx context.Context, oauth2Result *OAuth2Result, issuer string, nonceCookieValue string) (*AuthFlowResult, error) {
	rawIDToken, ok := oauth2Result.OAuth2Token.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("id_token not found")
	}

	verifier := s.verifierByIssuer[issuer]
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
	return &AuthFlowResult{
		IDToken: idToken,
	}, nil
}
