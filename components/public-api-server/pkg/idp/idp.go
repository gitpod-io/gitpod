// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package idp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zitadel/oidc/pkg/crypto"
	"github.com/zitadel/oidc/pkg/oidc"
	"github.com/zitadel/oidc/pkg/op"
	"gopkg.in/square/go-jose.v2"
)

func NewService(issuerBaseURL string, tokenEncryptionCode []byte, keyCache KeyCache) *Service {
	return &Service{
		IssuerBaseURL:       issuerBaseURL,
		TokenEncryptionCode: tokenEncryptionCode,
		keys:                keyCache,
	}
}

type Service struct {
	IssuerBaseURL       string
	TokenEncryptionCode []byte
	keys                KeyCache
}

func (kp *Service) Router() http.Handler {
	mux := chi.NewRouter()
	mux.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			req, _ := httputil.DumpRequest(r, false)
			fmt.Println()
			fmt.Println(string(req))
			next.ServeHTTP(w, r)
		})
	})

	mux.Handle(oidc.DiscoveryEndpoint, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		keysURL, err := url.JoinPath(kp.IssuerBaseURL, "keys")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notSupported, err := url.JoinPath(kp.IssuerBaseURL, "not-supported")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		cfg := oidc.DiscoveryConfiguration{
			Issuer:          kp.IssuerBaseURL,
			ScopesSupported: op.DefaultSupportedScopes,
			ResponseTypesSupported: []string{
				string(oidc.ResponseTypeCode),
				string(oidc.ResponseTypeIDTokenOnly),
				string(oidc.ResponseTypeIDToken),
			},
			GrantTypesSupported: []oidc.GrantType{
				oidc.GrantTypeCode,
				oidc.GrantTypeImplicit,
			},
			SubjectTypesSupported: []string{"public"},
			ClaimsSupported: []string{
				"sub",
				"aud",
				"exp",
				"iat",
				"iss",
				"auth_time",
				"nonce",
				"acr",
				"amr",
				"c_hash",
				"at_hash",
				"act",
				"scopes",
				"client_id",
				"azp",
				"preferred_username",
				"name",
				"family_name",
				"given_name",
				"locale",
				"email",
			},
			IDTokenSigningAlgValuesSupported:                   []string{"RS256"},
			RevocationEndpointAuthMethodsSupported:             []oidc.AuthMethod{oidc.AuthMethodNone},
			IntrospectionEndpointAuthMethodsSupported:          []oidc.AuthMethod{oidc.AuthMethodNone},
			IntrospectionEndpointAuthSigningAlgValuesSupported: []string{"RS256"},
			RequestURIParameterSupported:                       false,
			AuthorizationEndpoint:                              notSupported,
			TokenEndpoint:                                      notSupported,
			IntrospectionEndpoint:                              notSupported,
			UserinfoEndpoint:                                   notSupported,
			RevocationEndpoint:                                 notSupported,
			EndSessionEndpoint:                                 notSupported,
			JwksURI:                                            keysURL,
		}
		err = json.NewEncoder(w).Encode(cfg)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}))
	mux.Handle("/keys", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		keys, err := kp.keys.PublicKeys()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		err = json.NewEncoder(w).Encode(keys)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}))

	return mux
}

func (kp *Service) IDToken(org string, audience []string, subject string, user oidc.UserInfo) (string, error) {
	claims := oidc.NewIDTokenClaims(kp.IssuerBaseURL, subject, audience, time.Now().Add(60*time.Minute), time.Now(), "", "", nil, audience[0], 0)
	claims.SetUserinfo(user)

	codeHash, err := oidc.ClaimHash(string(kp.TokenEncryptionCode), jose.RS256)
	if err != nil {
		return "", err
	}
	claims.SetCodeHash(codeHash)

	signer, err := kp.keys.Signer()
	if err != nil {
		return "", err
	}

	return crypto.Sign(claims, signer)
}
