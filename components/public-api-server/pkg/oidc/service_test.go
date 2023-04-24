// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
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

	params, err := service.GetStartParams(config, redirectURL, "/")

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
			config, err := service.GetClientConfigFromStartRequest(request)
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
		require.NoError(t, dbConn.Where("slug = ?", team.Slug).Delete(&db.Team{}).Error)
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

	state, err := service.encodeStateParam(StateParam{
		ClientConfigID: configID,
		ReturnToURL:    "",
	})
	require.NoError(t, err, "failed encode state param")

	state_unknown, err := service.encodeStateParam(StateParam{
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
			config, err := service.GetClientConfigFromCallbackRequest(request)
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

func TestAuthenticate_nonce_check(t *testing.T) {
	t.Skip()
	issuer := newFakeIdP(t)
	service, dbConn := setupOIDCServiceForTests(t)
	config, _ := createConfig(t, dbConn, &ClientConfig{
		Issuer: issuer,
		// VerifierConfig: &oidc.Config{
		// 	SkipClientIDCheck:          true,
		// 	SkipIssuerCheck:            true,
		// 	SkipExpiryCheck:            true,
		// 	InsecureSkipSignatureCheck: true,
		// },
		OAuth2Config: &oauth2.Config{},
	})

	_, err := service.getConfigById(context.Background(), config.ID.String())
	require.NoError(t, err, "could not assert config creation")

	token := oauth2.Token{}
	extra := map[string]interface{}{
		"id_token": `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkN1bXF1YXQgRG9wdGlnIiwibm9uY2UiOiIxMTEiLCJpYXQiOjE1MTYyMzkwMjJ9.NfbRZns-Sefhw6MT4ULWMj_7bX0vScklaZA2ObCYkStYlo2SvNu5Be79-5Lwcy4GY95vY_dFvLIKrZjfqv_duURSKLUbtH8VxskhcrW4sPAK2R5lzz62a6d_OnVydjNJRZf754TQZILAzMm81tEDNAJSDQjaTFl7t8Bp0iYapNyyH9ZoBrGAPaZkXHYoq4lNH88gCZj5JMRIbrZbsvhOuR3CAzbAMplOmKIWxhFVnHdm6aq6HRjz0ra6Y7yh0R9jEF3vWl2w5D3aN4XESPNBbyB3CHKQ5TG0WkbgdUpv1wwzbPfz4aFHOt--qLy7ZK0TOrS-A7YLFFsJKtoPGRjAPA`,
	}

	result, err := service.Authenticate(context.Background(), AuthenticateParams{
		OAuth2Result: &OAuth2Result{
			OAuth2Token: token.WithExtra(extra),
		},
		NonceCookieValue: "111",
		Config: &ClientConfig{
			Issuer: issuer,
		},
	})

	require.NoError(t, err, "failed to authenticate")
	require.NotNil(t, result)
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

func createConfig(t *testing.T, dbConn *gorm.DB, config *ClientConfig) (db.OIDCClientConfig, db.Team) {
	t.Helper()

	orgID := uuid.New()
	team, err := db.CreateTeam(context.Background(), dbConn, db.Team{
		ID:   orgID,
		Name: "Org 1",
		// creating random slug using UUID generator, because it's handy here
		Slug: uuid.New().String(),
	})
	require.NoError(t, err)

	data, err := db.EncryptJSON(dbtest.CipherSet(t), db.OIDCSpec{
		ClientID:     config.OAuth2Config.ClientID,
		ClientSecret: config.OAuth2Config.ClientSecret,
	})
	require.NoError(t, err)

	created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
		OrganizationID: orgID,
		Issuer:         config.Issuer,
		Data:           data,
	})[0]

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
	})

	t.Cleanup(ts.Close)
	return url.Host
}

func newFakeIdP(t *testing.T) string {
	router := chi.NewRouter()
	ts := httptest.NewServer(router)
	url := ts.URL

	router.Use(middleware.Logger)
	router.Get("/oauth2/v3/certs", func(w http.ResponseWriter, r *http.Request) {
		_, err := w.Write([]byte(`{
			"keys": [
			]
		  }`))
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
		_, err := w.Write([]byte(`{
			"access_token": "no-token-set",
			"id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkN1bXF1YXQgRG9wdGlnIiwibm9uY2UiOiIxMTEiLCJpYXQiOjE1MTYyMzkwMjJ9.NfbRZns-Sefhw6MT4ULWMj_7bX0vScklaZA2ObCYkStYlo2SvNu5Be79-5Lwcy4GY95vY_dFvLIKrZjfqv_duURSKLUbtH8VxskhcrW4sPAK2R5lzz62a6d_OnVydjNJRZf754TQZILAzMm81tEDNAJSDQjaTFl7t8Bp0iYapNyyH9ZoBrGAPaZkXHYoq4lNH88gCZj5JMRIbrZbsvhOuR3CAzbAMplOmKIWxhFVnHdm6aq6HRjz0ra6Y7yh0R9jEF3vWl2w5D3aN4XESPNBbyB3CHKQ5TG0WkbgdUpv1wwzbPfz4aFHOt--qLy7ZK0TOrS-A7YLFFsJKtoPGRjAPA"
		}`))
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
