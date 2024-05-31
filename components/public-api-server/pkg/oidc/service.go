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
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	goidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

type Service struct {
	dbConn *gorm.DB
	cipher db.Cipher

	// jwts
	stateExpiry    time.Duration
	signerVerifier jws.SignerVerifier

	sessionServiceAddress string

	// TODO(at) remove by enhancing test setups
	skipVerifyIdToken bool
}

type ClientConfig struct {
	ID             string
	OrganizationID string
	Issuer         string
	Active         bool
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

func NewService(sessionServiceAddress string, dbConn *gorm.DB, cipher db.Cipher, signerVerifier jws.SignerVerifier, stateExpiry time.Duration) *Service {
	return &Service{
		sessionServiceAddress: sessionServiceAddress,

		dbConn: dbConn,
		cipher: cipher,

		signerVerifier: signerVerifier,
		stateExpiry:    stateExpiry,
	}
}

func (s *Service) getStartParams(config *ClientConfig, redirectURL string, stateParams StateParams) (*StartParams, error) {
	// the `state` is supposed to be passed through unmodified by the IdP.
	state, err := s.encodeStateParam(stateParams)
	if err != nil {
		return nil, fmt.Errorf("failed to encode state")
	}

	// number used once
	nonce, err := randString(32)
	if err != nil {
		return nil, fmt.Errorf("failed to create nonce")
	}

	// Configuring `AuthCodeOption`s, e.g. nonce
	config.OAuth2Config.RedirectURL = redirectURL
	authCodeURL := config.OAuth2Config.AuthCodeURL(state, goidc.Nonce(nonce))

	return &StartParams{
		AuthCodeURL: authCodeURL,
		State:       state,
		Nonce:       nonce,
	}, nil
}

func (s *Service) encodeStateParam(state StateParams) (string, error) {
	now := time.Now().UTC()
	expiry := now.Add(s.stateExpiry)
	token := NewStateJWT(state, now, expiry)

	signed, err := s.signerVerifier.Sign(token)
	if err != nil {
		return "", fmt.Errorf("failed to sign jwt: %w", err)
	}
	return signed, nil
}

func (s *Service) decodeStateParam(encodedToken string) (StateParams, error) {
	claims := &StateClaims{}
	_, err := s.signerVerifier.Verify(encodedToken, claims)
	if err != nil {
		return StateParams{}, fmt.Errorf("failed to verify state token: %w", err)
	}

	return claims.StateParams, nil
}

func randString(size int) (string, error) {
	b := make([]byte, size)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (s *Service) getClientConfigFromStartRequest(r *http.Request) (*ClientConfig, error) {
	orgSlug := r.URL.Query().Get("orgSlug")
	idParam := r.URL.Query().Get("id")

	// if no org slug is given, we assume the request is for the default org
	if orgSlug == "" && idParam == "" {
		org, err := db.GetSingleOrganizationWithActiveSSO(r.Context(), s.dbConn)
		if err != nil {
			return nil, fmt.Errorf("Failed to find team: %w", err)
		}
		orgSlug = org.Slug
	}
	if orgSlug != "" {
		dbEntry, err := db.GetActiveOIDCClientConfigByOrgSlug(r.Context(), s.dbConn, orgSlug)
		if err != nil {
			return nil, fmt.Errorf("Failed to find OIDC clients: %w", err)
		}

		config, err := s.convertClientConfig(r.Context(), dbEntry)
		if err != nil {
			return nil, fmt.Errorf("Failed to find OIDC clients: %w", err)
		}

		return &config, nil
	}

	if idParam == "" {
		return nil, fmt.Errorf("missing id parameter")
	}

	if idParam != "" {
		config, err := s.getConfigById(r.Context(), idParam)
		if err != nil {
			return nil, err
		}
		return config, nil
	}

	return nil, fmt.Errorf("failed to find OIDC config")
}

func (s *Service) getClientConfigFromCallbackRequest(r *http.Request) (*ClientConfig, *StateParams, error) {
	stateParam := r.URL.Query().Get("state")
	if stateParam == "" {
		return nil, nil, fmt.Errorf("missing state parameter")
	}

	state, err := s.decodeStateParam(stateParam)
	if err != nil {
		return nil, nil, fmt.Errorf("bad state param")
	}
	config, _ := s.getConfigById(r.Context(), state.ClientConfigID)
	if config != nil {
		return config, &state, nil
	}

	return nil, nil, fmt.Errorf("failed to find OIDC config on callback")
}

func (s *Service) activateAndVerifyClientConfig(ctx context.Context, config *ClientConfig) error {
	uuid, err := uuid.Parse(config.ID)
	if err != nil {
		return err
	}
	err = db.VerifyClientConfig(ctx, s.dbConn, uuid)
	if err != nil {
		return err
	}
	return db.SetClientConfigActiviation(ctx, s.dbConn, uuid, true)
}

func (s *Service) markClientConfigAsVerified(ctx context.Context, config *ClientConfig) error {
	uuid, err := uuid.Parse(config.ID)
	if err != nil {
		return err
	}
	return db.VerifyClientConfig(ctx, s.dbConn, uuid)
}

func (s *Service) getConfigById(ctx context.Context, id string) (*ClientConfig, error) {
	uuid, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	dbEntry, err := db.GetOIDCClientConfig(ctx, s.dbConn, uuid)
	if err != nil {
		return nil, err
	}
	config, err := s.convertClientConfig(ctx, dbEntry)
	if err != nil {
		log.Log.WithError(err).Error("Failed to decrypt oidc client config.")
		return nil, status.Errorf(codes.Internal, "Failed to decrypt OIDC client config.")
	}

	return &config, nil
}

func (s *Service) convertClientConfig(ctx context.Context, dbEntry db.OIDCClientConfig) (ClientConfig, error) {
	spec, err := dbEntry.Data.Decrypt(s.cipher)
	if err != nil {
		log.Log.WithError(err).Error("Failed to decrypt oidc client config.")
		return ClientConfig{}, status.Errorf(codes.Internal, "Failed to decrypt OIDC client config.")
	}

	provider, err := oidc.NewProvider(ctx, dbEntry.Issuer)
	if err != nil {
		return ClientConfig{}, err
	}

	return ClientConfig{
		ID:             dbEntry.ID.String(),
		OrganizationID: dbEntry.OrganizationID.String(),
		Issuer:         dbEntry.Issuer,
		Active:         dbEntry.Active,
		OAuth2Config: &oauth2.Config{
			ClientID:     spec.ClientID,
			ClientSecret: spec.ClientSecret,
			Endpoint:     provider.Endpoint(),
			Scopes:       spec.Scopes,
		},
		VerifierConfig: &goidc.Config{
			ClientID: spec.ClientID,
		},
	}, nil
}

type authenticateParams struct {
	Config           *ClientConfig
	OAuth2Result     *OAuth2Result
	NonceCookieValue string
}

func (s *Service) authenticate(ctx context.Context, params authenticateParams) (*AuthFlowResult, error) {
	rawIDToken, ok := params.OAuth2Result.OAuth2Token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("id_token not found")
	}

	provider, err := oidc.NewProvider(ctx, params.Config.Issuer)
	if err != nil {
		return nil, fmt.Errorf("Failed to initialize provider.")
	}
	verifier := provider.Verifier(&goidc.Config{
		ClientID: params.Config.OAuth2Config.ClientID,
	})

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id_token: %w", err)
	}
	if idToken.Nonce != params.NonceCookieValue {
		return nil, fmt.Errorf("nonce mismatch")
	}
	validatedClaims, err := s.validateRequiredClaims(ctx, provider, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to validate required claims: %w", err)
	}
	return &AuthFlowResult{
		IDToken: idToken,
		Claims:  validatedClaims,
	}, nil
}

func (s *Service) createSession(ctx context.Context, flowResult *AuthFlowResult, clientConfig *ClientConfig) ([]*http.Cookie, string, error) {
	type CreateSessionPayload struct {
		AuthFlowResult
		OrganizationID string `json:"organizationId"`
		ClientConfigID string `json:"oidcClientConfigId"`
	}
	sessionPayload := CreateSessionPayload{
		AuthFlowResult: *flowResult,
		OrganizationID: clientConfig.OrganizationID,
		ClientConfigID: clientConfig.ID,
	}
	payload, err := json.Marshal(sessionPayload)
	if err != nil {
		return nil, "", err
	}

	url := fmt.Sprintf("http://%s/session", s.sessionServiceAddress)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, "", fmt.Errorf("failed to construct session request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to make request to /session endpoint: %w", err)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, "", err
	}
	message := string(body)

	if res.StatusCode == http.StatusOK {
		return res.Cookies(), message, nil
	}

	log.WithField("create-session-error", message).Error("Failed to create session (via server)")
	return nil, message, fmt.Errorf("unexpected status code: %v", res.StatusCode)
}

func (s *Service) validateRequiredClaims(ctx context.Context, provider *oidc.Provider, token *goidc.IDToken) (jwt.MapClaims, error) {
	if len(token.Audience) < 1 {
		return nil, fmt.Errorf("audience claim is missing")
	}
	var claims jwt.MapClaims
	err := token.Claims(&claims)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal claims of ID token: %w", err)
	}
	requiredClaims := []string{"email", "name"}
	missingClaims := []string{}
	for _, claim := range requiredClaims {
		if _, ok := claims[claim]; !ok {
			missingClaims = append(missingClaims, claim)
		}
	}
	if len(missingClaims) > 0 {
		err = s.fillClaims(ctx, provider, claims, missingClaims)
		if err != nil {
			log.WithError(err).Error("failed to fill claims")
		}
		// continue
	}
	for _, claim := range requiredClaims {
		if _, ok := claims[claim]; !ok {
			return nil, fmt.Errorf("%s claim is missing", claim)
		}
	}
	return claims, nil
}

func (s *Service) fillClaims(ctx context.Context, provider *oidc.Provider, claims jwt.MapClaims, missingClaims []string) error {
	oauth2Info := GetOAuth2ResultFromContext(ctx)
	if oauth2Info == nil {
		return fmt.Errorf("oauth2 info not found")
	}
	userinfo, err := provider.UserInfo(ctx, oauth2.StaticTokenSource(oauth2Info.OAuth2Token))
	if err != nil {
		return fmt.Errorf("failed to get userinfo: %w", err)
	}
	var userinfoClaims map[string]interface{}
	if err := userinfo.Claims(&userinfoClaims); err != nil {
		return fmt.Errorf("failed to unmarshal userinfo claims: %w", err)
	}
	for _, key := range missingClaims {
		switch key {
		case "email":
			// check userinfo definition to get more info
			claims["email"] = userinfo.Email
		default:
			if value, ok := userinfoClaims[key]; ok {
				claims[key] = value
			}
		}
	}
	return nil
}
