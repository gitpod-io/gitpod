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
	baseUrl := newTestServer(t, idpUrl)

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

func newTestServer(t *testing.T, issuer string) string {
	router := chi.NewRouter()

	oidcService := NewOIDCService()
	router.Mount("/oidc", Router(oidcService))

	ts := httptest.NewServer(router)
	url := ts.URL

	oidcConfig := &goidc.Config{
		ClientID: "123",
	}
	oauth2Config := &oauth2.Config{
		ClientID:     "123",
		ClientSecret: "secret",
		RedirectURL:  url + "/callback",
		Scopes:       []string{goidc.ScopeOpenID, "profile", "email"},
	}
	clientConfig := &OIDCClientConfig{
		Issuer:       issuer,
		ID:           "R4ND0M1D",
		OAuth2Config: oauth2Config,
		OIDCConfig:   oidcConfig,
	}
	err := oidcService.AddClientConfig(clientConfig)
	if err != nil {
		t.Error(err)
		t.FailNow()
	}

	return url
}
