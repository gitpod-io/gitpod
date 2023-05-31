// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package identityprovider

import (
	"context"
	"crypto"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/zitadel/oidc/pkg/oidc"
	"gopkg.in/square/go-jose.v2"
)

const (
	issuerBaseURL = "https://api.gitpod.io/idp"
)

func TestRouter(t *testing.T) {
	type Expectation struct {
		Error    string
		Response string
	}
	tests := []struct {
		Name                string
		Expectation         Expectation
		ResponseExpectation func(*Service) string
		ExpectedHeaders     map[string]string
		Path                string
	}{
		{
			Name: "OIDC discovery",
			Path: oidc.DiscoveryEndpoint,
			Expectation: Expectation{
				Response: `{"issuer":"https://api.gitpod.io/idp","authorization_endpoint":"https://api.gitpod.io/idp/not-supported","token_endpoint":"https://api.gitpod.io/idp/not-supported","introspection_endpoint":"https://api.gitpod.io/idp/not-supported","userinfo_endpoint":"https://api.gitpod.io/idp/not-supported","revocation_endpoint":"https://api.gitpod.io/idp/not-supported","end_session_endpoint":"https://api.gitpod.io/idp/not-supported","jwks_uri":"https://api.gitpod.io/idp/keys","scopes_supported":["openid","profile","email","phone","address","offline_access"],"response_types_supported":["code","id_token","id_token token"],"grant_types_supported":["authorization_code","implicit"],"subject_types_supported":["public"],"id_token_signing_alg_values_supported":["RS256"],"revocation_endpoint_auth_methods_supported":["none"],"introspection_endpoint_auth_methods_supported":["none"],"introspection_endpoint_auth_signing_alg_values_supported":["RS256"],"claims_supported":["sub","aud","exp","iat","iss","auth_time","nonce","acr","amr","c_hash","at_hash","act","scopes","client_id","azp","preferred_username","name","family_name","given_name","locale","email"],"request_uri_parameter_supported":false}` + "\n",
			},
			ExpectedHeaders: map[string]string{
				"Content-Type": "application/json",
			},
		},
		{
			Name: "keys",
			Path: "/keys",
			ResponseExpectation: func(s *Service) string {
				r, _ := s.keys.PublicKeys(context.Background())
				return string(r)
			},
			ExpectedHeaders: map[string]string{
				"Content-Type": "application/json",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			service, err := NewService(issuerBaseURL, NewInMemoryCache())
			if err != nil {
				t.Fatal(err)
			}
			server := httptest.NewServer(service.Router())
			t.Cleanup(server.Close)

			resp, err := http.Get(server.URL + test.Path)
			if err != nil {
				t.Fatal(err)
			}
			respBody, err := io.ReadAll(resp.Body)

			var act Expectation
			act.Response = string(respBody)
			if err != nil {
				act.Error = err.Error()
			}

			if test.ResponseExpectation != nil {
				test.Expectation.Response = test.ResponseExpectation(service)
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Router() mismatch (-want +got):\n%s", diff)
			}

			for name, expected := range test.ExpectedHeaders {
				actual := resp.Header.Get(name)
				if actual != expected {
					t.Errorf("Unexpected value for header '%s'. got: '%s', want: '%s'", name, actual, expected)
				}
			}
		})
	}
}

func TestIDToken(t *testing.T) {
	type Expectation struct {
		Error string
		Token *jwt.Token
	}
	tests := []struct {
		Name        string
		Expectation Expectation
		Org         string
		Audience    []string
		UserInfo    oidc.UserInfo
	}{
		{
			Name: "all empty",
			Expectation: Expectation{
				Error: "audience cannot be empty",
			},
		},
		{
			Name:     "just audience",
			Audience: []string{"some.audience.com"},
			Expectation: Expectation{
				Error: "user info cannot be nil",
			},
		},
		{
			Name:     "with user info",
			Audience: []string{"some.audience.com"},
			UserInfo: func() oidc.UserInfo {
				userInfo := oidc.NewUserInfo()
				userInfo.SetName("foo")
				userInfo.SetSubject("bar")
				return userInfo
			}(),
			Expectation: Expectation{
				Token: &jwt.Token{
					Method: &jwt.SigningMethodRSA{Name: "RS256", Hash: crypto.SHA256},
					Header: map[string]interface{}{"alg": string(jose.RS256)},
					Claims: jwt.MapClaims{
						"aud":  []any{string("some.audience.com")},
						"azp":  string("some.audience.com"),
						"iss":  string("https://api.gitpod.io/idp"),
						"name": "foo",
						"sub":  "bar",
					},
					Valid: true,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			cache := NewInMemoryCache()
			service, err := NewService(issuerBaseURL, cache)
			if err != nil {
				t.Fatal(err)
			}

			var act Expectation
			token, err := service.IDToken(context.TODO(), test.Org, test.Audience, test.UserInfo)
			if err != nil {
				act.Error = err.Error()
			} else {
				parsedToken, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) { return &cache.current.PublicKey, nil })
				if err != nil {
					t.Fatalf("cannot parse IDToken result: %v", err)
				}
				act.Token = parsedToken
			}

			if diff := cmp.Diff(test.Expectation, act, cmpJWTToken()...); diff != "" {
				t.Errorf("IDToken() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func cmpJWTToken() []cmp.Option {
	return []cmp.Option{
		cmpopts.IgnoreFields(jwt.Token{}, "Raw", "Signature"),
		cmpopts.IgnoreMapEntries(func(k string, v any) bool {
			_, ignore := map[string]struct{}{
				"auth_time": {},
				"c_hash":    {},
				"exp":       {},
				"iat":       {},
				"iss":       {},
			}[k]
			return ignore
		}),
	}
}
