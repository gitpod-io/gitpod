// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	goidc "github.com/coreos/go-oidc/v3/oidc"
)

func TestRoute_start(t *testing.T) {
	// setup fake OIDC service
	idpUrl := newFakeIdP(t)

	// setup test server with client routes
	baseUrl, _, configId, _ := newTestServer(t, testServerParams{
		issuer:      idpUrl,
		returnToURL: "",
	})

	// go to /start
	// don't follow redirect
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Get(baseUrl + "/oidc/start?id=" + configId)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode)
	redirectUrl, err := resp.Location()
	require.NoError(t, err)
	require.Contains(t, redirectUrl.String(), idpUrl, "should redirect to IdP")
}

func TestRoute_callback(t *testing.T) {
	// setup fake OIDC service
	idpUrl := newFakeIdP(t)

	// setup test server with client routes
	baseUrl, stateParam, _, service := newTestServer(t, testServerParams{
		issuer:      idpUrl,
		returnToURL: "/relative/url/to/some/page",
	})
	state, err := service.encodeStateParam(*stateParam)
	require.NoError(t, err)

	// hit the /callback endpoint
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	req, err := http.NewRequest("GET", baseUrl+"/oidc/callback?code=123&state="+state, nil)
	require.NoError(t, err)
	req.AddCookie(&http.Cookie{
		Name: "state", Value: state, MaxAge: 60,
	})
	req.AddCookie(&http.Cookie{
		Name: "nonce", Value: "111", MaxAge: 60,
	})
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode, "callback should response with redirect (307)")
	require.NotEmpty(t, resp.Cookies(), "missing cookies on redirect")
	require.Equal(t, "test-cookie", resp.Cookies()[0].Name, "missing cookie on redirect")

	url, err := resp.Location()
	require.NoError(t, err)
	require.Equal(t, "/relative/url/to/some/page", url.Path, "callback redirects properly")

}

type testServerParams struct {
	issuer      string
	returnToURL string
	clientID    string
}

func newTestServer(t *testing.T, params testServerParams) (url string, state *StateParam, configId string, oidcService *Service) {
	router := chi.NewRouter()
	oidcService, dbConn := setupOIDCServiceForTests(t)
	router.Mount("/oidc", Router(oidcService))

	ts := httptest.NewServer(router)
	url = ts.URL

	oidcConfig := &goidc.Config{
		ClientID:                   params.clientID,
		SkipClientIDCheck:          true,
		SkipIssuerCheck:            true,
		SkipExpiryCheck:            true,
		InsecureSkipSignatureCheck: true,
	}
	oauth2Config := &oauth2.Config{
		ClientID:     params.clientID,
		ClientSecret: "secret",
		Scopes:       []string{goidc.ScopeOpenID, "profile", "email"},
	}
	clientConfig := &ClientConfig{
		Issuer:         params.issuer,
		OAuth2Config:   oauth2Config,
		VerifierConfig: oidcConfig,
	}
	configId = createConfig(t, dbConn, clientConfig)

	stateParam := &StateParam{
		ClientConfigID: configId,
		ReturnToURL:    params.returnToURL,
	}

	return url, stateParam, configId, oidcService
}
