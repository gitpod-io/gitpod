// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"bytes"
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
	configsById           map[string]*ClientConfig
	verifierByIssuer      map[string]*oidc.IDTokenVerifier
	providerByIssuer      map[string]*oidc.Provider
	sessionServiceAddress string
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
	IDToken *oidc.IDToken          `json:"idToken"`
	Claims  map[string]interface{} `json:"claims"`
}

func NewService(sessionServiceAddress string) *Service {
	return &Service{
		configsById:           map[string]*ClientConfig{},
		verifierByIssuer:      map[string]*oidc.IDTokenVerifier{},
		providerByIssuer:      map[string]*oidc.Provider{},
		sessionServiceAddress: sessionServiceAddress,
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

func (s *Service) GetClientConfigFromStartRequest(r *http.Request) (*ClientConfig, error) {
	issuerParam := r.URL.Query().Get("issuer")
	idParam := r.URL.Query().Get("id")
	if issuerParam == "" && idParam == "" {
		return nil, fmt.Errorf("missing parameters")
	}

	if idParam != "" {
		config := s.configsById[idParam]
		if config != nil {
			return config, nil
		}
		return nil, fmt.Errorf("failed to find OIDC config by ID")
	}
	if issuerParam != "" {
		for _, value := range s.configsById {
			if value.Issuer == issuerParam {
				return value, nil
			}
		}
	}

	return nil, fmt.Errorf("failed to find OIDC config")
}

func (s *Service) GetClientConfigFromCallbackRequest(r *http.Request) (*ClientConfig, error) {
	stateParam := r.URL.Query().Get("state")
	if stateParam == "" {
		return nil, fmt.Errorf("missing state parameter")
	}

	state, err := decodeStateParam(stateParam)
	if err != nil {
		return nil, fmt.Errorf("bad state param")
	}
	config := s.configsById[state.ClientConfigID]
	if config != nil {
		return config, nil
	}

	return nil, fmt.Errorf("failed to find OIDC config on callback")
}

type AuthenticateParams struct {
	OAuth2Result     *OAuth2Result
	Issuer           string
	NonceCookieValue string
}

func (s *Service) Authenticate(ctx context.Context, params AuthenticateParams) (*AuthFlowResult, error) {
	rawIDToken, ok := params.OAuth2Result.OAuth2Token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("id_token not found")
	}

	verifier := s.verifierByIssuer[params.Issuer]
	if verifier == nil {
		return nil, fmt.Errorf("verifier not found")
	}

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id_token: %w", err)
	}
	claims := map[string]interface{}{}
	err = idToken.Claims(&claims)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal the payload of the ID token: %w", err)
	}
	if idToken.Nonce != params.NonceCookieValue {
		return nil, fmt.Errorf("nonce mismatch")
	}
	return &AuthFlowResult{
		IDToken: idToken,
		Claims:  claims,
	}, nil
}

func (s *Service) CreateSession(ctx context.Context, flowResult *AuthFlowResult) (*http.Cookie, error) {
	payload, err := json.Marshal(flowResult)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("http://%s/session", s.sessionServiceAddress)
	res, err := http.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}

	if res.StatusCode == http.StatusOK {
		cookies := res.Cookies()
		if len(cookies) == 1 {
			return cookies[0], nil
		}
		return nil, fmt.Errorf("unexpected count of cookies: %v", len(cookies))
	}
	return nil, fmt.Errorf("unexpected status code: %v", res.StatusCode)
}
