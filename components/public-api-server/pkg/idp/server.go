// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package idp

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/zitadel/oidc/pkg/oidc"
	"github.com/zitadel/oidc/pkg/op"
	"gopkg.in/square/go-jose.v2"
)

// This is a basic zitadel based server implementation

func NewIDToken(ctx context.Context, provider op.OpenIDProvider, audience []string, subject string) (string, error) {
	resp, err := op.CreateTokenResponse(context.Background(), NewAuthRequest(audience, subject), &dummyClient{}, provider, false, "", "")
	if err != nil {
		return "", err
	}
	return resp.IDToken, nil
}

func NewAuthRequest(audience []string, subject string) op.AuthRequest {
	return &authRequest{
		CreationDate: time.Now(),
		Audience:     audience,
		Subject:      subject,
	}
}

type authRequest struct {
	CreationDate time.Time
	Audience     []string
	Subject      string
}

func (a *authRequest) GetID() string {
	return ""
}

func (a *authRequest) GetACR() string {
	return "" // we won't handle acr in this example
}

func (a *authRequest) GetAMR() []string {
	return nil
}

func (a *authRequest) GetAudience() []string {
	return a.Audience
}

func (a *authRequest) GetAuthTime() time.Time {
	return time.Now()
}

func (a *authRequest) GetClientID() string {
	// don't duplicate the audience entry
	// because of https://github.com/zitadel/oidc/blob/b5da6ec29b7e601ece7c97b8c1f4334cba8acd2b/pkg/oidc/token.go#L582
	return a.Audience[0]
}

func (a *authRequest) GetCodeChallenge() *oidc.CodeChallenge {
	return nil
}

func (a *authRequest) GetNonce() string {
	return ""
}

func (a *authRequest) GetRedirectURI() string {
	return ""
}

func (a *authRequest) GetResponseType() oidc.ResponseType {
	return oidc.ResponseTypeIDTokenOnly
}

func (a *authRequest) GetResponseMode() oidc.ResponseMode {
	return "" // we won't handle response mode in this example
}

func (a *authRequest) GetScopes() []string {
	return nil
}

func (a *authRequest) GetState() string {
	return ""
}

func (a *authRequest) GetSubject() string {
	return a.Subject
}

func (a *authRequest) Done() bool {
	return true
}

func NewServer(ctx context.Context, issuer string) (op.OpenIDProvider, error) {
	// the OpenID Provider requires a 32-byte key for (token) encryption
	// be sure to create a proper crypto random key and manage it securely!
	key := sha256.Sum256([]byte("test"))

	config := &op.Config{
		Issuer:    issuer,
		CryptoKey: key,
	}
	handler, err := op.NewOpenIDProvider(ctx, config, newDummyStorage(),
		// as an example on how to customize an endpoint this will change the authorization_endpoint from /authorize to /auth
		op.WithCustomAuthEndpoint(op.NewEndpoint("auth")),
	)
	if err != nil {
		return nil, err
	}
	return handler, nil
}

type dummyClient struct{}

// AccessTokenType implements op.Client
func (*dummyClient) AccessTokenType() op.AccessTokenType {
	return op.AccessTokenTypeJWT
}

// ApplicationType implements op.Client
func (*dummyClient) ApplicationType() op.ApplicationType {
	return op.ApplicationTypeWeb
}

// AuthMethod implements op.Client
func (*dummyClient) AuthMethod() oidc.AuthMethod {
	return oidc.AuthMethodNone
}

// ClockSkew implements op.Client
func (*dummyClient) ClockSkew() time.Duration {
	return 0
}

// DevMode implements op.Client
func (*dummyClient) DevMode() bool {
	return false
}

// GetID implements op.Client
func (*dummyClient) GetID() string {
	return "dummyclient"
}

// GrantTypes implements op.Client
func (*dummyClient) GrantTypes() []oidc.GrantType {
	return []oidc.GrantType{oidc.GrantTypeClientCredentials}
}

// IDTokenLifetime implements op.Client
func (*dummyClient) IDTokenLifetime() time.Duration {
	return 60 * time.Minute
}

// IDTokenUserinfoClaimsAssertion implements op.Client
func (*dummyClient) IDTokenUserinfoClaimsAssertion() bool {
	return false
}

// IsScopeAllowed implements op.Client
func (*dummyClient) IsScopeAllowed(scope string) bool {
	return false
}

// LoginURL implements op.Client
func (*dummyClient) LoginURL(string) string {
	return ""
}

// PostLogoutRedirectURIs implements op.Client
func (*dummyClient) PostLogoutRedirectURIs() []string {
	return nil
}

// RedirectURIs implements op.Client
func (*dummyClient) RedirectURIs() []string {
	return nil
}

// ResponseTypes implements op.Client
func (*dummyClient) ResponseTypes() []oidc.ResponseType {
	return nil
}

// RestrictAdditionalAccessTokenScopes implements op.Client
func (*dummyClient) RestrictAdditionalAccessTokenScopes() func(scopes []string) []string {
	return func(scopes []string) []string { return nil }
}

// RestrictAdditionalIdTokenScopes implements op.Client
func (*dummyClient) RestrictAdditionalIdTokenScopes() func(scopes []string) []string {
	return func(scopes []string) []string { return nil }
}

var _ op.Client = ((*dummyClient)(nil))

func newDummyStorage() *dummyStorage {
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	return &dummyStorage{key: key}
}

type dummyStorage struct {
	key *rsa.PrivateKey
}

// GetKeySet implements op.Storage
func (s *dummyStorage) GetKeySet(context.Context) (*jose.JSONWebKeySet, error) {
	// as mentioned above, this example only has a single signing key without key rotation,
	// so it will directly use its public key
	//
	// when using key rotation you typically would store the public keys alongside the private keys in your database
	// and give both of them an expiration date, with the public key having a longer lifetime (e.g. rotate private key every
	return &jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{
			{
				KeyID:     "id",
				Algorithm: "RS256",
				Use:       oidc.KeyUseSignature,
				Key:       &s.key.PublicKey,
			},
		},
	}, nil
}

// GetSigningKey implements op.Storage
func (s *dummyStorage) GetSigningKey(ctx context.Context, keyCh chan<- jose.SigningKey) {
	// in this example the signing key is a static rsa.PrivateKey and the algorithm used is RS256
	// you would obviously have a more complex implementation and store / retrieve the key from your database as well
	//
	// the idea of the signing key channel is, that you can (with what ever mechanism) rotate your signing key and
	// switch the key of the signer via this channel
	keyCh <- jose.SigningKey{
		Algorithm: jose.SignatureAlgorithm("RS256"), // always tell the signer with algorithm to use
		Key: jose.JSONWebKey{
			KeyID: "id", // always give the key an id so, that it will include it in the token header as `kid` claim
			Key:   s.key,
		},
	}
}

// DeleteAuthRequest implements op.Storage
func (*dummyStorage) DeleteAuthRequest(context.Context, string) error {
	// We need this function implemented to use the auth request to produce ID tokens
	return nil
}

// AuthRequestByCode implements op.Storage
func (*dummyStorage) AuthRequestByCode(context.Context, string) (op.AuthRequest, error) {
	return nil, fmt.Errorf("AuthRequestByCode not implemented")
}

// AuthRequestByID implements op.Storage
func (*dummyStorage) AuthRequestByID(context.Context, string) (op.AuthRequest, error) {
	return nil, fmt.Errorf("AuthRequestByID not implemented")
}

// CreateAccessAndRefreshTokens implements op.Storage
func (*dummyStorage) CreateAccessAndRefreshTokens(ctx context.Context, request op.TokenRequest, currentRefreshToken string) (accessTokenID string, newRefreshTokenID string, expiration time.Time, err error) {
	err = fmt.Errorf("CreateAccessAndRefreshTokens not implemented")
	return
}

// CreateAccessToken implements op.Storage
func (*dummyStorage) CreateAccessToken(context.Context, op.TokenRequest) (accessTokenID string, expiration time.Time, err error) {
	err = fmt.Errorf("CreateAccessToken not implemented")
	return
}

// CreateAuthRequest implements op.Storage
func (*dummyStorage) CreateAuthRequest(ctx context.Context, req *oidc.AuthRequest, userID string) (op.AuthRequest, error) {
	return nil, fmt.Errorf("CreateAuthRequest not implemented")
}

// RevokeToken implements op.Storage
func (*dummyStorage) RevokeToken(ctx context.Context, tokenOrTokenID string, userID string, clientID string) *oidc.Error {
	panic("RevokeToken unimplemented")
}

// SaveAuthCode implements op.Storage
func (*dummyStorage) SaveAuthCode(context.Context, string, string) error {
	panic("SaveAuthCode unimplemented")
}

// TerminateSession implements op.Storage
func (*dummyStorage) TerminateSession(ctx context.Context, userID string, clientID string) error {
	panic("TerminateSession unimplemented")
}

// TokenRequestByRefreshToken implements op.Storage
func (*dummyStorage) TokenRequestByRefreshToken(ctx context.Context, refreshTokenID string) (op.RefreshTokenRequest, error) {
	panic("TokenRequestByRefreshToken unimplemented")
}

// AuthorizeClientIDSecret implements op.Storage
func (*dummyStorage) AuthorizeClientIDSecret(ctx context.Context, clientID string, clientSecret string) error {
	panic("AuthorizeClientIDSecret unimplemented")
}

// GetClientByClientID implements op.Storage
func (*dummyStorage) GetClientByClientID(ctx context.Context, clientID string) (op.Client, error) {
	panic("GetClientByClientID unimplemented")
}

// GetKeyByIDAndUserID implements op.Storage
func (*dummyStorage) GetKeyByIDAndUserID(ctx context.Context, keyID string, clientID string) (*jose.JSONWebKey, error) {
	panic("GetKeyByIDAndUserID unimplemented")
}

// GetPrivateClaimsFromScopes implements op.Storage
func (*dummyStorage) GetPrivateClaimsFromScopes(ctx context.Context, userID string, clientID string, scopes []string) (map[string]interface{}, error) {
	panic("GetPrivateClaimsFromScopes unimplemented")
}

// SetIntrospectionFromToken implements op.Storage
func (*dummyStorage) SetIntrospectionFromToken(ctx context.Context, userinfo oidc.IntrospectionResponse, tokenID string, subject string, clientID string) error {
	panic("SetIntrospectionFromToken unimplemented")
}

// SetUserinfoFromScopes implements op.Storage
func (*dummyStorage) SetUserinfoFromScopes(ctx context.Context, userinfo oidc.UserInfoSetter, userID string, clientID string, scopes []string) error {
	panic("SetUserinfoFromScopes unimplemented")
}

// SetUserinfoFromToken implements op.Storage
func (*dummyStorage) SetUserinfoFromToken(ctx context.Context, userinfo oidc.UserInfoSetter, tokenID string, subject string, origin string) error {
	panic("SetUserinfoFromToken unimplemented")
}

// ValidateJWTProfileScopes implements op.Storage
func (*dummyStorage) ValidateJWTProfileScopes(ctx context.Context, userID string, scopes []string) ([]string, error) {
	panic("ValidateJWTProfileScopes unimplemented")
}

// Health implements op.Storage
func (*dummyStorage) Health(context.Context) error {
	panic("Health unimplemented")
}

var _ op.Storage = ((*dummyStorage)(nil))
