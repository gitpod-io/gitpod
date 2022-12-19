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
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
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
	// state is supposed to a) be present on client request as cookie header
	// and b) to be mirrored by the IdP on callback requests.
	stateParam := StateParam{
		ClientConfigID: config.ID,
		RedirectURL:    config.OAuth2Config.RedirectURL,
	}
	state, err := encodeStateParam(stateParam)
	if err != nil {
		return nil, errors.New("failed to encode state")
	}

	// number used once
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

// TODO(at) state should be a JWT encoding a redirect location
// For now, just use base64
func encodeStateParam(state StateParam) (string, error) {
	var buf bytes.Buffer
	encoder := base64.NewEncoder(base64.StdEncoding, &buf)
	err := json.NewEncoder(encoder).Encode(state)
	if err != nil {
		return "", err
	}
	encoder.Close()
	return buf.String(), nil
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

func (service *OIDCService) GetClientConfigFromRequest(r *http.Request) (*OIDCClientConfig, error) {
	issuerParam := r.URL.Query().Get("issuer")
	stateParam := r.URL.Query().Get("state")
	if issuerParam == "" && stateParam == "" {
		return nil, errors.New("missing request parameters")
	}

	if issuerParam != "" {
		for _, value := range service.configsById {
			if value.Issuer == issuerParam {
				return value, nil
			}
		}
	}

	if stateParam != "" {
		state, err := decodeStateParam(stateParam)
		if err != nil {
			return nil, errors.New("bad state param")
		}
		config := service.configsById[state.ClientConfigID]
		if config != nil {
			return config, nil
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
