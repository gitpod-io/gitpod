// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package identityprovider

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-chi/chi/v5"
	"github.com/zitadel/oidc/pkg/crypto"
	"github.com/zitadel/oidc/pkg/oidc"
	"github.com/zitadel/oidc/pkg/op"
	"gopkg.in/square/go-jose.v2"
)

func NewService(issuerBaseURL string, keyCache KeyCache) (*Service, error) {
	idpKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("cannot produce IDP private key: %w", err)
	}
	err = keyCache.Set(context.Background(), idpKey)
	if err != nil {
		return nil, fmt.Errorf("cannot cache IDP key: %w", err)
	}

	tokenEncryptionCode := make([]byte, 128)
	_, err = io.ReadFull(rand.Reader, tokenEncryptionCode)
	if err != nil {
		return nil, fmt.Errorf("cannot produce random token encryption code: %w", err)
	}

	return &Service{
		IssuerBaseURL:       issuerBaseURL,
		TokenEncryptionCode: tokenEncryptionCode,
		keys:                keyCache,
	}, nil
}

type Service struct {
	IssuerBaseURL       string
	TokenEncryptionCode []byte
	keys                KeyCache
}

func (kp *Service) Router() http.Handler {
	mux := chi.NewRouter()
	mux.Get(oidc.DiscoveryEndpoint, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(cfg)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}))
	mux.Get("/keys", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		keys, err := kp.keys.PublicKeys(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write(keys)
		if err != nil {
			log.WithError(err).Error("cannot respond to /keys")
		}
	}))

	return mux
}

func (kp *Service) IDToken(ctx context.Context, org string, audience []string, user oidc.UserInfo) (string, error) {
	if len(audience) == 0 {
		return "", fmt.Errorf("audience cannot be empty")
	}
	if user == nil {
		return "", fmt.Errorf("user info cannot be nil")
	}

	claims := oidc.NewIDTokenClaims(kp.IssuerBaseURL, user.GetSubject(), audience, time.Now().Add(60*time.Minute), time.Now(), "", "", nil, audience[0], 0)
	claims.SetUserinfo(user)

	codeHash, err := oidc.ClaimHash(string(kp.TokenEncryptionCode), jose.RS256)
	if err != nil {
		return "", err
	}
	claims.SetCodeHash(codeHash)

	signer, err := kp.keys.Signer(ctx)
	if err != nil {
		return "", err
	}

	token, err := crypto.Sign(claims, signer)
	if err != nil {
		log.WithError(err).Error("cannot sign OIDC ID token")
		return "", fmt.Errorf("cannot sign ID token")
	}
	return token, nil
}
