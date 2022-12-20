// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"io/ioutil"
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
	baseUrl, _ := newTestServer(t, testServerParams{
		issuer:         idpUrl,
		returnToURL:    "",
		clientConfigID: "R4ND0M1D",
	})

	// go to /start
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(baseUrl + "/oidc/start?issuer=" + idpUrl)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	require.NoError(t, err)

	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NotEqual(t, "config not found", string(body))
}

func TestRoute_callback(t *testing.T) {
	// setup fake OIDC service
	idpUrl := newFakeIdP(t)

	// setup test server with client routes
	baseUrl, stateParam := newTestServer(t, testServerParams{
		issuer:         idpUrl,
		returnToURL:    "/relative/url/to/some/page",
		clientConfigID: "R4ND0M1D",
	})
	state, err := encodeStateParam(*stateParam)
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

	require.NoError(t, err)
	require.Equal(t, http.StatusTemporaryRedirect, resp.StatusCode, "callback should response with redirect (307)")

	url, err := resp.Location()
	require.NoError(t, err)
	require.Equal(t, "/relative/url/to/some/page", url.Path, "callback redirects properly")

}

type testServerParams struct {
	issuer         string
	returnToURL    string
	clientConfigID string
	clientID       string
}

func newTestServer(t *testing.T, params testServerParams) (url string, state *StateParam) {
	router := chi.NewRouter()
	oidcService := NewService()
	router.Mount("/oidc", Router(oidcService))

	ts := httptest.NewServer(router)
	url = ts.URL

	stateParam := &StateParam{
		ClientConfigID: params.clientConfigID,
		ReturnToURL:    params.returnToURL,
	}

	oidcConfig := &goidc.Config{
		ClientID:                   params.clientConfigID,
		SkipClientIDCheck:          true,
		SkipIssuerCheck:            true,
		SkipExpiryCheck:            true,
		InsecureSkipSignatureCheck: true,
	}
	oauth2Config := &oauth2.Config{
		ClientID:     params.clientID,
		ClientSecret: "secret",
		RedirectURL:  url + "/callback",
		Scopes:       []string{goidc.ScopeOpenID, "profile", "email"},
	}
	clientConfig := &ClientConfig{
		Issuer:         params.issuer,
		ID:             params.clientConfigID,
		OAuth2Config:   oauth2Config,
		VerifierConfig: oidcConfig,
	}
	err := oidcService.AddClientConfig(clientConfig)
	require.NoError(t, err)

	return url, stateParam
}
