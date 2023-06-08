// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestNewServerInterceptor(t *testing.T) {
	requestPayload := "request"
	type TokenResponse struct {
		Token string `json:"token"`
	}

	type Header struct {
		Key   string
		Value string
	}

	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	sessionCfg := config.SessionConfig{
		Issuer: "unittest.com",
		Cookie: config.CookieConfig{
			Name: "cookie_jwt",
		},
	}

	handler := connect.UnaryFunc(func(ctx context.Context, ar connect.AnyRequest) (connect.AnyResponse, error) {
		token, _ := TokenFromContext(ctx)
		return connect.NewResponse(&TokenResponse{Token: token.Value}), nil
	})

	validJWTToken, err := rsa256.Sign(NewSessionJWT(uuid.New(), sessionCfg.Issuer, time.Now(), time.Now().Add(5*time.Minute)))
	require.NoError(t, err)
	expiredJWTToken, err := rsa256.Sign(NewSessionJWT(uuid.New(), sessionCfg.Issuer, time.Now(), time.Now().Add(-1*time.Minute)))
	require.NoError(t, err)
	invalidIssuerJWTToken, err := rsa256.Sign(NewSessionJWT(uuid.New(), "random issuer", time.Now(), time.Now().Add(-1*time.Minute)))
	require.NoError(t, err)

	scenarios := []struct {
		Name string

		Headers []Header

		ExpectedError error
		ExpectedToken string
	}{
		{
			Name:          "no headers return Unathenticated",
			Headers:       nil,
			ExpectedError: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No access token or cookie credentials available on request.")),
		},
		{
			Name:          "authorization header with bearer token returns ok",
			Headers:       []Header{{Key: "Authorization", Value: "Bearer foo"}},
			ExpectedToken: "foo",
		},
		{
			Name:          "authorization header with bearer token returns ok",
			Headers:       []Header{{Key: "Authorization", Value: "Bearer foo"}},
			ExpectedToken: "foo",
		},
		{
			Name:          "cookie header with invalid JWT token is rejected",
			Headers:       []Header{{Key: "Cookie", Value: fmt.Sprintf("%s=%s", sessionCfg.Cookie.Name, "invalid_token")}},
			ExpectedError: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("JWT session could not be verified.")),
		},
		{
			Name: "cookie header with expired JWT token is rejected",
			Headers: []Header{{
				Key:   "Cookie",
				Value: fmt.Sprintf("%s=%s", sessionCfg.Cookie.Name, expiredJWTToken)},
			},
			ExpectedError: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("JWT session could not be verified.")),
		},
		{
			Name: "cookie header with invalid issuer is rejected",
			Headers: []Header{{
				Key:   "Cookie",
				Value: fmt.Sprintf("%s=%s", sessionCfg.Cookie.Name, invalidIssuerJWTToken)},
			},
			ExpectedError: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("JWT session could not be verified.")),
		},
		{
			Name: "cookie header with valid JWT token is accepted",
			Headers: []Header{{
				Key:   "Cookie",
				Value: fmt.Sprintf("%s=%s", sessionCfg.Cookie.Name, validJWTToken),
			}},
			ExpectedToken: fmt.Sprintf("%s=%s", sessionCfg.Cookie.Name, validJWTToken),
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			ctx := context.Background()
			request := connect.NewRequest(&requestPayload)

			for _, header := range s.Headers {
				request.Header().Add(header.Key, header.Value)
			}

			interceptor := NewServerInterceptor(sessionCfg, rsa256)
			resp, err := interceptor.WrapUnary(handler)(ctx, request)

			require.Equal(t, s.ExpectedError, err)
			if err == nil {
				require.Equal(t, &TokenResponse{
					Token: s.ExpectedToken,
				}, resp.Any())
			}

		})
	}
}

func TestNewClientInterceptor(t *testing.T) {
	expectedToken := "my_token"

	tokenOnRequest := ""
	// Setup a test server where we capture the token supplied, we don't actually care for the response.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Println(r.Header)
		token, err := BearerTokenFromHeaders(r.Header)
		require.NoError(t, err)

		// Capture the token supplied in the request so we can test for it
		tokenOnRequest = token
		w.WriteHeader(http.StatusNotFound)
	}))

	client := connect.NewClient[any, any](http.DefaultClient, srv.URL, connect.WithInterceptors(
		NewClientInterceptor(expectedToken),
	))

	_, _ = client.CallUnary(context.Background(), connect.NewRequest[any](nil))
	require.Equal(t, expectedToken, tokenOnRequest)
}
