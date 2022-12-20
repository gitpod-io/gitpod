// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
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
			return fmt.Errorf("OIDC discovery failed: %w", err)
		}
		s.providerByIssuer[config.Issuer] = provider
		s.verifierByIssuer[config.Issuer] = provider.Verifier(config.VerifierConfig)
	}

	config.OAuth2Config.Endpoint = s.providerByIssuer[config.Issuer].Endpoint()
	s.configsById[config.ID] = config
	return nil
}

func (s *Service) GetStartParams(config *ClientConfig) (*StartParams, error) {
	// state is supposed to a) be present on client request as cookie header
	// and b) to be mirrored by the IdP on callback requests.
	stateParam := StateParam{
		ClientConfigID: config.ID,

		// TODO(at) read a relative URL from `returnTo` query param of the start request
		ReturnToURL: "/",
	}
	state, err := encodeStateParam(stateParam)
	if err != nil {
		return nil, fmt.Errorf("failed to encode state")
	}

	// number used once
	nonce, err := randString(32)
	if err != nil {
		return nil, fmt.Errorf("failed to create nonce")
	}

	// Nonce is the single option passed on to configure the consent page ATM.
	authCodeURL := config.OAuth2Config.AuthCodeURL(state, oidc.Nonce(nonce))

	return &StartParams{
		AuthCodeURL: authCodeURL,
		State:       state,
		Nonce:       nonce,
	}, nil
}

// TODO(at) state should be a JWT encoding a redirect location
// For now, just use base64
func encodeStateParam(state StateParam) (string, error) {
	b, err := json.Marshal(state)
	if err != nil {
		return "", fmt.Errorf("failed to marshal state to json: %w", err)
	}

	return base64.StdEncoding.EncodeToString(b), nil
}

func decodeStateParam(encoded string) (StateParam, error) {
	var result StateParam
	err := json.NewDecoder(base64.NewDecoder(base64.StdEncoding, strings.NewReader(encoded))).Decode(&result)
	return result, err
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
	stateParam := r.URL.Query().Get("state")
	if issuerParam == "" && stateParam == "" {
		return nil, fmt.Errorf("missing request parameters")
	}

	if issuerParam != "" {
		for _, value := range s.configsById {
			if value.Issuer == issuerParam {
				return value, nil
			}
		}
	}

	if stateParam != "" {
		state, err := decodeStateParam(stateParam)
		if err != nil {
			return nil, fmt.Errorf("bad state param")
		}
		config := s.configsById[state.ClientConfigID]
		if config != nil {
			return config, nil
		}
	}

	return nil, fmt.Errorf("failed to find OIDC config for request")
}

func (s *Service) Authenticate(ctx context.Context, oauth2Result *OAuth2Result, issuer string, nonceCookieValue string) (*AuthFlowResult, error) {
	rawIDToken, ok := oauth2Result.OAuth2Token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("id_token not found")
	}

	verifier := s.verifierByIssuer[issuer]
	if verifier == nil {
		return nil, fmt.Errorf("verifier not found")
	}

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id_token: %w", err)
	}

	if idToken.Nonce != nonceCookieValue {
		return nil, fmt.Errorf("nonce mismatch")
	}
	return &AuthFlowResult{
		IDToken: idToken,
	}, nil
}
