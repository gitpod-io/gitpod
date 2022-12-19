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
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	goidc "github.com/coreos/go-oidc/v3/oidc"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func TestRoute_start(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.TraceLevel)

	// setup fake OIDC service
	idpUrl := newFakeIdP(t)

	// setup test server with client routes
	baseUrl, _ := newTestServer(t, idpUrl)

	// go to /start
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(baseUrl + "/oidc/start?issuer=" + idpUrl)
	if err != nil {
		t.Error(err)
		t.FailNow()
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		t.Error(err)
		t.FailNow()
	}
	t.Log(string(body))
	require.Equal(t, 200, resp.StatusCode)
	require.NotEqual(t, "config not found", string(body))
}

func TestRoute_callback(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.TraceLevel)

	// setup fake OIDC service
	idpUrl := newFakeIdP(t)

	// setup test server with client routes
	baseUrl, stateParam := newTestServer(t, idpUrl)
	state, err := encodeStateParam(*stateParam)
	require.NoError(t, err)

	// hit the /callback endpoint
	client := &http.Client{Timeout: 10 * time.Second}
	req := httptest.NewRequest("GET", baseUrl+"/oidc/callback?code=123&state="+state, nil)
	req.RequestURI = ""
	req.AddCookie(&http.Cookie{
		Name: "state", Value: state, MaxAge: 60,
	})
	req.AddCookie(&http.Cookie{
		Name: "nonce", Value: "111", MaxAge: 60,
	})
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	require.NoError(t, err)

	t.Log(string(body))
	require.Equal(t, 200, resp.StatusCode)
	require.NotEqual(t, "config not found", string(body))
}

func newTestServer(t *testing.T, issuer string) (url string, state *StateParam) {
	router := chi.NewRouter()

	oidcService := NewOIDCService()
	router.Mount("/oidc", Router(oidcService))

	ts := httptest.NewServer(router)
	url = ts.URL

	clientConfigId := "R4ND0M1D"
	stateParam := &StateParam{
		ClientConfigID: clientConfigId,
		RedirectURL:    "",
	}

	oidcConfig := &goidc.Config{
		ClientID:                   "123",
		SkipClientIDCheck:          true,
		SkipIssuerCheck:            true,
		SkipExpiryCheck:            true,
		InsecureSkipSignatureCheck: true,
	}
	oauth2Config := &oauth2.Config{
		ClientID:     "123",
		ClientSecret: "secret",
		RedirectURL:  url + "/callback",
		Scopes:       []string{goidc.ScopeOpenID, "profile", "email"},
	}
	clientConfig := &OIDCClientConfig{
		Issuer:       issuer,
		ID:           clientConfigId,
		OAuth2Config: oauth2Config,
		OIDCConfig:   oidcConfig,
	}
	err := oidcService.AddClientConfig(clientConfig)
	require.NoError(t, err)

	return url, stateParam
}
