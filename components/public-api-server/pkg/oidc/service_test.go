// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	goidc "github.com/coreos/go-oidc/v3/oidc"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2"
	"gorm.io/gorm"
)

func TestGetStartParams(t *testing.T) {
	const (
		issuerG     = "https://accounts.google.com"
		clientID    = "client-id-123"
		redirectURL = "https://test.local/iam/oidc/callback"
	)
	service, _ := setupOIDCServiceForTests(t)
	config := &ClientConfig{
		Issuer:         issuerG,
		VerifierConfig: &oidc.Config{},
		OAuth2Config: &oauth2.Config{
			ClientID: clientID,
			Endpoint: oauth2.Endpoint{
				AuthURL: issuerG + "/o/oauth2/v2/auth",
			},
		},
	}

	params, err := service.getStartParams(config, redirectURL, StateParams{
		ClientConfigID: config.ID,
		ReturnToURL:    "/",
		Activate:       false,
	})

	require.NoError(t, err)
	require.NotNil(t, params.Nonce)
	require.NotNil(t, params.State)

	// AuthCodeURL example:
	// https://accounts.google.com/o/oauth2/v2/auth
	// ?client_id=client-id-123
	// &nonce=UFTMxxUtc5jVZbp2a2R9XEoRwpfzs-04FcmVQ-HdCsw
	// &response_type=code
	// &redirect_url=https...
	// &state=Q4XzRcdo4jtOYeRbF17T9LHHwX-4HacT1_5pZH8mXLI
	require.NotNil(t, params.AuthCodeURL)
	require.Contains(t, params.AuthCodeURL, issuerG)
	require.Contains(t, params.AuthCodeURL, clientID)
	require.Contains(t, params.AuthCodeURL, url.QueryEscape(redirectURL))
	require.Contains(t, params.AuthCodeURL, url.QueryEscape(params.Nonce))
	require.Contains(t, params.AuthCodeURL, url.QueryEscape(params.State))
}

func TestGetClientConfigFromStartRequest(t *testing.T) {
	issuer := newFakeIdP(t)
	service, dbConn := setupOIDCServiceForTests(t)
	config, team := createConfig(t, dbConn, &ClientConfig{
		Issuer:         issuer,
		Active:         true,
		VerifierConfig: &oidc.Config{},
		OAuth2Config:   &oauth2.Config{},
	})
	// create second org to emulate an installation with multiple orgs
	createConfig(t, dbConn, &ClientConfig{
		Issuer:         issuer,
		Active:         true,
		VerifierConfig: &oidc.Config{},
		OAuth2Config:   &oauth2.Config{},
	})
	configID := config.ID.String()

	testCases := []struct {
		Location      string
		ExpectedError bool
		ExpectedId    string
	}{
		{
			Location:      "/start?word=abc",
			ExpectedError: true,
			ExpectedId:    "",
		},
		{
			Location:      "/start?id=UNKNOWN",
			ExpectedError: true,
			ExpectedId:    "",
		},
		{
			Location:      "/start?id=" + configID,
			ExpectedError: false,
			ExpectedId:    configID,
		},
		{
			Location:      "/start?orgSlug=" + team.Slug,
			ExpectedError: false,
			ExpectedId:    configID,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Location, func(te *testing.T) {
			request := httptest.NewRequest(http.MethodGet, tc.Location, nil)
			config, err := service.getClientConfigFromStartRequest(request)
			if tc.ExpectedError == true {
				require.Error(te, err)
			}
			if tc.ExpectedError != true {
				require.NoError(te, err)
				require.NotNil(te, config)
				require.Equal(te, tc.ExpectedId, config.ID)
			}
		})
	}

	t.Cleanup(func() {
		require.NoError(t, dbConn.Where("slug = ?", team.Slug).Delete(&db.Organization{}).Error)
	})
}

func TestGetClientConfigFromStartRequestSingleOrg(t *testing.T) {
	issuer := newFakeIdP(t)
	service, dbConn := setupOIDCServiceForTests(t)
	// make sure no other organizations are in the db anymore
	dbConn.Delete(&db.Organization{}, "1=1")
	config, team := createConfig(t, dbConn, &ClientConfig{
		Issuer:         issuer,
		Active:         true,
		VerifierConfig: &oidc.Config{},
		OAuth2Config:   &oauth2.Config{},
	})
	configID := config.ID.String()

	testCases := []struct {
		Location      string
		ExpectedError bool
		ExpectedId    string
	}{
		{
			Location:      "/start",
			ExpectedError: false,
			ExpectedId:    configID,
		},
		{
			Location:      "/start?word=abc",
			ExpectedError: false,
			ExpectedId:    configID,
		},
		{
			Location:      "/start?id=UNKNOWN",
			ExpectedError: true,
			ExpectedId:    "",
		},
		{
			Location:      "/start?id=" + configID,
			ExpectedError: false,
			ExpectedId:    configID,
		},
		{
			Location:      "/start?orgSlug=" + team.Slug,
			ExpectedError: false,
			ExpectedId:    configID,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Location, func(te *testing.T) {
			request := httptest.NewRequest(http.MethodGet, tc.Location, nil)
			config, err := service.getClientConfigFromStartRequest(request)
			if tc.ExpectedError == true {
				require.Error(te, err)
			}
			if tc.ExpectedError != true {
				require.NoError(te, err)
				require.NotNil(te, config)
				require.Equal(te, tc.ExpectedId, config.ID, "wrong config")
			}
		})
	}

	t.Cleanup(func() {
		require.NoError(t, dbConn.Where("slug = ?", team.Slug).Delete(&db.Organization{}).Error)
	})
}

func TestGetClientConfigFromCallbackRequest(t *testing.T) {
	issuer := newFakeIdP(t)
	service, dbConn := setupOIDCServiceForTests(t)
	config, _ := createConfig(t, dbConn, &ClientConfig{
		Issuer:         issuer,
		VerifierConfig: &oidc.Config{},
		OAuth2Config:   &oauth2.Config{},
	})
	configID := config.ID.String()

	state, err := service.encodeStateParam(StateParams{
		ClientConfigID: configID,
		ReturnToURL:    "",
	})
	require.NoError(t, err, "failed encode state param")

	state_unknown, err := service.encodeStateParam(StateParams{
		ClientConfigID: "UNKNOWN",
		ReturnToURL:    "",
	})
	require.NoError(t, err, "failed encode state param")

	testCases := []struct {
		Location      string
		ExpectedError bool
		ExpectedId    string
	}{
		{
			Location:      "/callback?state=BAD",
			ExpectedError: true,
			ExpectedId:    "",
		},
		{
			Location:      "/callback?state=" + state_unknown,
			ExpectedError: true,
			ExpectedId:    "",
		},
		{
			Location:      "/callback?state=" + state,
			ExpectedError: false,
			ExpectedId:    configID,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Location, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, tc.Location, nil)
			config, _, err := service.getClientConfigFromCallbackRequest(request)
			if tc.ExpectedError == true {
				require.Error(t, err)
			}
			if tc.ExpectedError != true {
				require.NoError(t, err)
				require.NotNil(t, config)
				require.Equal(t, tc.ExpectedId, config.ID)
			}
		})
	}
}

func TestCreateSession(t *testing.T) {
	service, _ := setupOIDCServiceForTests(t)

	config := ClientConfig{
		ID:             "foo1",
		OrganizationID: "org1",
	}

	_, message, err := service.createSession(context.Background(), &AuthFlowResult{}, &config)
	require.NoError(t, err, "failed to create session")

	got := map[string]interface{}{}
	err = json.Unmarshal([]byte(message), &got)
	require.NoError(t, err, "failed to parse response")

	expected := map[string]interface{}{
		"claims":             nil,
		"idToken":            nil,
		"oidcClientConfigId": config.ID,
		"organizationId":     config.OrganizationID,
	}

	if diff := cmp.Diff(expected, got); diff != "" {
		t.Errorf("Unexpected create session payload (-want +got):\n%s", diff)
	}
}

func Test_validateRequiredClaims(t *testing.T) {
	service, _ := setupOIDCServiceForTests(t)

	type data struct {
		jwt.RegisteredClaims
		Email string `json:"email,omitempty"`
		Name  string `json:"name,omitempty"`
	}

	testCases := []struct {
		Label         string
		ExpectedError string
		Claims        data
	}{
		{
			Label:         "Required claims present",
			ExpectedError: "",
			Claims: data{
				RegisteredClaims: jwt.RegisteredClaims{
					Audience: []string{"audience"},
				},
				Email: "me@localhost",
				Name:  "Admin",
			},
		},
		{
			Label:         "Email claim is missing",
			ExpectedError: "email claim is missing",
			Claims: data{
				RegisteredClaims: jwt.RegisteredClaims{
					Audience: []string{"audience"},
				},
				Name: "Admin",
			},
		},
		{
			Label:         "Name claim is missing",
			ExpectedError: "name claim is missing",
			Claims: data{
				RegisteredClaims: jwt.RegisteredClaims{
					Audience: []string{"audience"},
				},
				Email: "admin@localhost",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Label, func(t *testing.T) {
			token := createTestIDToken(t, tc.Claims)

			_, err := service.validateRequiredClaims(context.Background(), nil, token)
			if tc.ExpectedError == "" {
				require.NoError(t, err)
			}
			if tc.ExpectedError != "" {
				require.Equal(t, err.Error(), tc.ExpectedError)
			}
		})
	}
}

func Test_verifyCelExpression(t *testing.T) {
	service, _ := setupOIDCServiceForTests(t)

	testCases := []struct {
		Label             string
		ExpectedError     bool
		ExpectedErrorMsg  string
		ExpectedErrorCode string
		ExpectedResult    bool
		Claims            jwt.MapClaims
		CEL               string
	}{
		{
			Label:             "email verify",
			ExpectedError:     true,
			ExpectedErrorMsg:  "CEL Expression did not evaluate to true [CEL:EVAL_FALSE]",
			ExpectedErrorCode: "CEL:EVAL_FALSE",
			ExpectedResult:    false,
			Claims: jwt.MapClaims{
				"Audience": []string{"audience"},
				"groups_direct": []string{
					"gitpod-team",
					"gitpod-team2/sub_group",
				},
				"email":          "test@gitpod.io",
				"email_verified": false,
			},
			CEL: "claims.email_verified && claims.email_verified.email.endsWith('@gitpod.io')",
		},
		{
			Label:          "GitLab: groups restriction",
			ExpectedError:  false,
			ExpectedResult: true,
			Claims: jwt.MapClaims{
				"Audience": []string{"audience"},
				"groups_direct": []string{
					"gitpod-team",
					"gitpod-team2/sub_group",
				},
				"email":          "test@gitpod.io",
				"email_verified": false,
			},
			CEL: "(claims.email_verified && claims.email_verified.email.endsWith('@gitpod.io')) || 'gitpod-team' in claims.groups_direct",
		},
		{
			Label:             "GitLab: groups restriction (not allowed)",
			ExpectedError:     true,
			ExpectedErrorMsg:  "CEL Expression did not evaluate to true [CEL:EVAL_FALSE]",
			ExpectedErrorCode: "CEL:EVAL_FALSE",
			ExpectedResult:    false,
			Claims: jwt.MapClaims{
				"Audience": []string{"audience"},
				"groups_direct": []string{
					"gitpod-team2/sub_group",
				},
				"email":          "test@gitpod.io",
				"email_verified": false,
			},
			CEL: "(claims.email_verified && claims.email_verified.email.endsWith('@gitpod.io')) || 'gitpod-team2' in claims.groups_direct",
		},
		{
			Label:             "invalidate cel",
			ExpectedError:     true,
			ExpectedErrorCode: "CEL:INVALIDATE",
			ExpectedResult:    false,
			Claims: jwt.MapClaims{
				"Audience": []string{"audience"},
				"groups_direct": []string{
					"gitpod-team",
					"gitpod-team2/sub_group",
				},
				"email":          "test@gitpod.io",
				"email_verified": false,
			},
			CEL: "foo",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Label, func(t *testing.T) {
			result, err := service.verifyCelExpression(context.Background(), tc.CEL, tc.Claims)
			if tc.ExpectedErrorCode != "" {
				if celExprErr, ok := err.(*CelExprError); ok {
					require.Equal(t, celExprErr.Code, tc.ExpectedErrorCode, "Unexpected CEL error code")
				}
			}
			if !tc.ExpectedError {
				require.NoError(t, err)
			} else {
				require.True(t, err != nil, "Should return error")
				if tc.ExpectedErrorMsg != "" {
					require.Equal(t, err.Error(), tc.ExpectedErrorMsg)
				}
			}
			require.Equal(t, result, tc.ExpectedResult, "Unexpected result")
		})
	}
}

func createTestIDToken(t *testing.T, claims jwt.Claims) *goidc.IDToken {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	rawIDToken, err := token.SignedString([]byte("no-relevant-for-this-test"))
	require.NoError(t, err)

	verifier := goidc.NewVerifier("http://localhost", nil, &goidc.Config{
		SkipIssuerCheck:            true,
		SkipClientIDCheck:          true,
		SkipExpiryCheck:            true,
		InsecureSkipSignatureCheck: true,
	})

	verifiedToken, err := verifier.Verify(context.Background(), rawIDToken)
	require.NoError(t, err)

	return verifiedToken
}

func setupOIDCServiceForTests(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()

	dbConn := dbtest.ConnectForTests(t)
	cipher := dbtest.CipherSet(t)

	sessionServerAddress := newFakeSessionServer(t)

	keyset := jwstest.GenerateKeySet(t)
	signerVerifier := jws.NewHS256FromKeySet(keyset)

	service := NewService(sessionServerAddress, dbConn, cipher, signerVerifier, 5*time.Minute)
	service.skipVerifyIdToken = true
	return service, dbConn
}

func createConfig(t *testing.T, dbConn *gorm.DB, config *ClientConfig) (db.OIDCClientConfig, db.Organization) {
	t.Helper()

	team := dbtest.CreateOrganizations(t, dbConn, db.Organization{})[0]

	data, err := db.EncryptJSON(dbtest.CipherSet(t), db.OIDCSpec{
		ClientID:     config.OAuth2Config.ClientID,
		ClientSecret: config.OAuth2Config.ClientSecret,
	})
	require.NoError(t, err)

	created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
		ID:             uuid.New(),
		OrganizationID: team.ID,
		Issuer:         config.Issuer,
		Active:         false,
		Data:           data,
	}, db.OIDCClientConfig{
		ID:             uuid.New(),
		OrganizationID: team.ID,
		Issuer:         config.Issuer,
		Active:         config.Active,
		Data:           data,
	})[1]

	return created, team
}

func newFakeSessionServer(t *testing.T) string {
	router := chi.NewRouter()
	ts := httptest.NewServer(router)
	url, err := url.Parse(ts.URL)
	if err != nil {
		log.Fatal(err)
	}

	router.Use(middleware.Logger)
	router.Post("/session", func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     "test-cookie",
			Value:    "chocolate-chips",
			Path:     "/",
			HttpOnly: true,
			Expires:  time.Now().AddDate(0, 0, 1),
		})
		w.WriteHeader(http.StatusOK)

		// mirroring back the request body for testing
		body, err := io.ReadAll(r.Body)
		if err != nil {
			body = []byte(err.Error())
		}
		_, err = w.Write(body)
		if err != nil {
			log.Fatal(err)
		}
	})

	t.Cleanup(ts.Close)
	return url.Host
}

func newFakeIdP(t *testing.T) string {
	router := chi.NewRouter()
	ts := httptest.NewServer(router)
	url := ts.URL

	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	type IDTokenClaims struct {
		Nonce string `json:"nonce"`
		Email string `json:"email"`
		Name  string `json:"name"`
		jwt.RegisteredClaims
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, &IDTokenClaims{
		Nonce: "111",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-id",
			Audience:  jwt.ClaimStrings{"client-id"},
			Issuer:    url,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Email: "me@idp.org",
		Name:  "User",
	})

	idTokenValue, err := rsa256.Sign(token)
	require.NoError(t, err)

	var jwks jose.JSONWebKeySet
	jwks.Keys = append(jwks.Keys, jose.JSONWebKey{
		Key:       &keyset.Signing.Private.PublicKey,
		KeyID:     "0001",
		Algorithm: string(jose.RS256),
	})
	keysValue, err := json.Marshal(jwks)
	require.NoError(t, err)

	router.Use(middleware.Logger)
	router.Get("/oauth2/v3/certs", func(w http.ResponseWriter, r *http.Request) {
		_, err := w.Write(keysValue)
		if err != nil {
			log.Fatal(err)
		}
	})
	router.Get("/o/oauth2/v2/auth", func(w http.ResponseWriter, r *http.Request) {
		_, err := w.Write([]byte(r.URL.RawQuery))
		if err != nil {
			log.Fatal(err)
		}
	})
	router.Post("/token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")
		_, err := w.Write([]byte(fmt.Sprintf(`{
			"access_token": "no-token-set",
			"id_token": "%[1]s"
		}`, idTokenValue)))
		if err != nil {
			log.Fatal(err)
		}
	})
	router.Get("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")
		_, err := w.Write([]byte(fmt.Sprintf(`{
			"issuer": "%[1]s",
			"authorization_endpoint": "%[1]s/o/oauth2/v2/auth",
			"device_authorization_endpoint": "%[1]s/device/code",
			"token_endpoint": "%[1]s/token",
			"userinfo_endpoint": "%[1]s/v1/userinfo",
			"revocation_endpoint": "%[1]s/revoke",
			"jwks_uri": "%[1]s/oauth2/v3/certs",
			"response_types_supported": [
			 "code",
			 "token",
			 "id_token",
			 "code token",
			 "code id_token",
			 "token id_token",
			 "code token id_token",
			 "none"
			],
			"subject_types_supported": [
			 "public"
			],
			"id_token_signing_alg_values_supported": [
			 "RS256"
			],
			"scopes_supported": [
			 "openid",
			 "email",
			 "profile"
			],
			"token_endpoint_auth_methods_supported": [
			 "client_secret_post",
			 "client_secret_basic"
			],
			"claims_supported": [
			 "aud",
			 "email",
			 "email_verified",
			 "exp",
			 "family_name",
			 "given_name",
			 "iat",
			 "iss",
			 "locale",
			 "name",
			 "picture",
			 "sub"
			],
			"code_challenge_methods_supported": [
			 "plain",
			 "S256"
			],
			"grant_types_supported": [
			 "authorization_code",
			 "refresh_token",
			 "urn:ietf:params:oauth:grant-type:device_code",
			 "urn:ietf:params:oauth:grant-type:jwt-bearer"
			]
		   }`, url)))
		if err != nil {
			t.Error((err))
			t.FailNow()
		}
	})

	t.Cleanup(ts.Close)
	return url
}
