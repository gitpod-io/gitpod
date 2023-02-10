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
	"io/ioutil"
	"net/http"

	"github.com/coreos/go-oidc/v3/oidc"
	goidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type Service struct {
	dbConn   *gorm.DB
	cipher   db.Cipher
	stateJWT *StateJWT

	verifierByIssuer      map[string]*goidc.IDTokenVerifier
	sessionServiceAddress string

	// TODO(at) remove by enhancing test setups
	skipVerifyIdToken bool
}

type ClientConfig struct {
	ID             string
	OrganizationID string
	Issuer         string
	OAuth2Config   *oauth2.Config
	VerifierConfig *goidc.Config
}

type StartParams struct {
	State       string
	Nonce       string
	AuthCodeURL string
}

type AuthFlowResult struct {
	IDToken *goidc.IDToken         `json:"idToken"`
	Claims  map[string]interface{} `json:"claims"`
}

func NewService(sessionServiceAddress string, dbConn *gorm.DB, cipher db.Cipher, stateJWT *StateJWT) *Service {
	return &Service{
		verifierByIssuer:      map[string]*goidc.IDTokenVerifier{},
		sessionServiceAddress: sessionServiceAddress,

		dbConn: dbConn,
		cipher: cipher,

		stateJWT: stateJWT,
	}
}

func (s *Service) GetStartParams(config *ClientConfig, redirectURL string) (*StartParams, error) {
	// state is supposed to a) be present on client request as cookie header
	// and b) to be mirrored by the IdP on callback requests.
	stateParam := StateParam{
		ClientConfigID: config.ID,

		// TODO(at) read a relative URL from `returnTo` query param of the start request
		ReturnToURL: "/",
	}
	state, err := s.encodeStateParam(stateParam)
	if err != nil {
		return nil, fmt.Errorf("failed to encode state")
	}

	// number used once
	nonce, err := randString(32)
	if err != nil {
		return nil, fmt.Errorf("failed to create nonce")
	}

	// Nonce is the single option passed on to configure the consent page ATM.
	config.OAuth2Config.RedirectURL = redirectURL
	authCodeURL := config.OAuth2Config.AuthCodeURL(state, goidc.Nonce(nonce))

	return &StartParams{
		AuthCodeURL: authCodeURL,
		State:       state,
		Nonce:       nonce,
	}, nil
}

func (s *Service) encodeStateParam(state StateParam) (string, error) {
	encodedState, err := s.stateJWT.Encode(StateClaims{
		ClientConfigID: state.ClientConfigID,
		ReturnToURL:    state.ReturnToURL,
	})
	return encodedState, err
}

func (s *Service) decodeStateParam(encodedToken string) (StateParam, error) {
	claims, err := s.stateJWT.Decode(encodedToken)
	if err != nil {
		return StateParam{}, err
	}
	return StateParam{
		ClientConfigID: claims.ClientConfigID,
		ReturnToURL:    claims.ReturnToURL,
	}, nil
}

func randString(size int) (string, error) {
	b := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *Service) GetClientConfigFromStartRequest(r *http.Request) (*ClientConfig, error) {
	idParam := r.URL.Query().Get("id")
	if idParam == "" {
		return nil, fmt.Errorf("missing id parameter")
	}

	if idParam != "" {
		config, err := s.getConfigById(idParam)
		if err != nil {
			return nil, err
		}
		return config, nil
	}

	return nil, fmt.Errorf("failed to find OIDC config")
}

func (s *Service) GetClientConfigFromCallbackRequest(r *http.Request) (*ClientConfig, error) {
	stateParam := r.URL.Query().Get("state")
	if stateParam == "" {
		return nil, fmt.Errorf("missing state parameter")
	}

	state, err := s.decodeStateParam(stateParam)
	if err != nil {
		return nil, fmt.Errorf("bad state param")
	}
	config, _ := s.getConfigById(state.ClientConfigID)
	if config != nil {
		return config, nil
	}

	return nil, fmt.Errorf("failed to find OIDC config on callback")
}

func (s *Service) getConfigById(id string) (*ClientConfig, error) {
	uuid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	dbEntry, err := db.GetOIDCClientConfig(context.Background(), s.dbConn, uuid)
	if err != nil {
		return nil, err
	}
	spec, err := dbEntry.Data.Decrypt(s.cipher)
	if err != nil {
		log.Log.WithError(err).Error("Failed to decrypt oidc client config.")
		return nil, status.Errorf(codes.Internal, "Failed to decrypt OIDC client config.")
	}

	provider, err := oidc.NewProvider(context.Background(), dbEntry.Issuer)
	if err != nil {
		return nil, err
	}

	if s.verifierByIssuer[dbEntry.Issuer] == nil {
		if s.skipVerifyIdToken {
			s.verifierByIssuer[dbEntry.Issuer] = provider.Verifier(&goidc.Config{
				ClientID:                   spec.ClientID,
				SkipClientIDCheck:          true,
				SkipIssuerCheck:            true,
				SkipExpiryCheck:            true,
				InsecureSkipSignatureCheck: true,
			})
		} else {
			s.verifierByIssuer[dbEntry.Issuer] = provider.Verifier(&goidc.Config{
				ClientID: spec.ClientID,
			})
		}
	}

	scopes := spec.Scopes
	if len(scopes) < 1 {
		scopes = []string{"openid"}
	}

	return &ClientConfig{
		ID:             dbEntry.ID.String(),
		OrganizationID: dbEntry.OrganizationID.String(),
		Issuer:         dbEntry.Issuer,
		OAuth2Config: &oauth2.Config{
			ClientID:     spec.ClientID,
			ClientSecret: spec.ClientSecret,
			Endpoint:     provider.Endpoint(),
			Scopes:       scopes,
		},
		VerifierConfig: &goidc.Config{
			ClientID: spec.ClientID,
		},
	}, nil
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

func (s *Service) CreateSession(ctx context.Context, flowResult *AuthFlowResult, organizationId string) (*http.Cookie, error) {
	type CreateSessionPayload struct {
		AuthFlowResult
		OrganizationID string `json:"organizationId"`
	}
	sessionPayload := CreateSessionPayload{
		AuthFlowResult: *flowResult,
		OrganizationID: organizationId,
	}
	payload, err := json.Marshal(sessionPayload)
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
	message, _ := ioutil.ReadAll(res.Body)
	log.WithField("create-session-error", message).Error("Failed to create session (via server)")
	return nil, fmt.Errorf("unexpected status code: %v", res.StatusCode)
}
