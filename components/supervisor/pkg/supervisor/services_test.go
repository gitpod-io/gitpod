// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/golang/protobuf/ptypes"
	"github.com/google/go-cmp/cmp"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestInMemoryTokenServiceGetToken(t *testing.T) {
	type Expectation struct {
		Resp *api.GetTokenResponse
		Err  string
	}
	var (
		defaultToken = "foobar"
		defaultHost  = "gitpod.io"

		errNoToken = status.Error(codes.NotFound, "no token available").Error()
	)
	newToken := func(scopes ...string) *token {
		return &token{
			Host:       defaultHost,
			ExpiryDate: time.Now().Add(1 * time.Hour),
			Scope:      mapScopes(scopes),
			Token:      defaultToken,
			Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
		}
	}

	tests := []struct {
		Desc        string
		Req         *api.GetTokenRequest
		Cache       []*token
		Provider    map[string][]tokenProvider
		Expectation Expectation
	}{
		{
			Desc: "no provider",
			Req: &api.GetTokenRequest{
				Host: defaultHost,
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (no reuse)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: []*token{
				func(t *token) *token {
					t.Reuse = api.TokenReuse_REUSE_NEVER
					return t
				}(newToken("a1", "a2")),
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (exact, reuse when possible)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: []*token{newToken("a1", "a2")},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken},
			},
		},
		{
			Desc: "cached token (expired)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: []*token{
				{
					Host:       defaultHost,
					ExpiryDate: time.Now().Add(-2 * time.Hour),
					Scope:      mapScopes([]string{"a1", "a2"}),
					Token:      defaultToken,
				},
				{Host: "foo." + defaultHost},
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (fewer scopes)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: []*token{newToken("a1")},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (more scopes, reuse when possible)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: []*token{newToken("a1", "a2", "a3")},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken},
			},
		},
		{
			Desc: "cached token (more scopes, exact reuse)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: []*token{
				func(t *token) *token {
					t.Reuse = api.TokenReuse_REUSE_EXACTLY
					return t
				}(newToken("a1", "a2", "a3")),
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "token provider (no token)",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Provider: map[string][]tokenProvider{
				defaultHost: {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *token, err error) {
					return
				})},
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "token provider",
			Req: &api.GetTokenRequest{
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Provider: map[string][]tokenProvider{
				defaultHost: {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *token, err error) {
					return newToken("a1", "a2"), nil
				})},
			},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			service := NewInMemoryTokenService()
			service.token = test.Cache
			service.provider = test.Provider

			resp, err := service.GetToken(context.Background(), test.Req)

			res := Expectation{
				Resp: resp,
			}
			if err != nil {
				res.Err = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, res); diff != "" {
				t.Errorf("unexpected status (-want +got):\n%s", diff)
			}
		})
	}
}

func TestInMemoryTokenServiceSetToken(t *testing.T) {
	var (
		defaultHost  = "gitpod.io"
		defaultToken = "foobar"
	)

	tExpired, _ := ptypes.TimestampProto(time.Now().Add(-2 * time.Hour))
	tValid, _ := ptypes.TimestampProto(time.Now().Add(2 * time.Hour))

	type Expectation struct {
		Err        string
		TokenCount int
	}
	tests := []struct {
		Desc        string
		Req         *api.SetTokenRequest
		Expectation Expectation
	}{
		{
			Desc: "expired token",
			Req: &api.SetTokenRequest{
				Host:       defaultHost,
				ExpiryDate: tExpired,
				Scope:      []string{},
				Token:      defaultToken,
				Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
			},
			Expectation: Expectation{
				Err: status.Error(codes.InvalidArgument, "invalid expiry date: already expired").Error(),
			},
		},
		{
			Desc: "missing token",
			Req: &api.SetTokenRequest{
				Host:       defaultHost,
				ExpiryDate: tValid,
				Scope:      []string{},
				Token:      "",
				Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
			},
			Expectation: Expectation{
				Err: status.Error(codes.InvalidArgument, "token is required").Error(),
			},
		},
		{
			Desc: "missing host",
			Req: &api.SetTokenRequest{
				Host:       "",
				ExpiryDate: tValid,
				Scope:      []string{},
				Token:      defaultToken,
				Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
			},
			Expectation: Expectation{
				Err: status.Error(codes.InvalidArgument, "host is required").Error(),
			},
		},
		{
			Desc: "no scopes",
			Req: &api.SetTokenRequest{
				Host:       defaultHost,
				ExpiryDate: tValid,
				Scope:      []string{},
				Token:      defaultToken,
				Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
			},
			Expectation: Expectation{
				TokenCount: 1,
			},
		},
		{
			Desc: "with scopes",
			Req: &api.SetTokenRequest{
				Host:       defaultHost,
				ExpiryDate: tValid,
				Scope:      []string{"a1"},
				Token:      defaultToken,
				Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
			},
			Expectation: Expectation{
				TokenCount: 1,
			},
		},
		{
			Desc: "no reuse",
			Req: &api.SetTokenRequest{
				Host:       defaultHost,
				ExpiryDate: tValid,
				Scope:      []string{"a1"},
				Token:      defaultToken,
				Reuse:      api.TokenReuse_REUSE_NEVER,
			},
			Expectation: Expectation{
				TokenCount: 0,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			service := NewInMemoryTokenService()
			_, err := service.SetToken(context.Background(), test.Req)
			res := Expectation{
				TokenCount: len(service.token),
			}
			if err != nil {
				res.Err = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, res); diff != "" {
				t.Errorf("unexpected status (-want +got):\n%s", diff)
			}
		})
	}
}

type tokenProviderFunc func(ctx context.Context, req *api.GetTokenRequest) (tkn *token, err error)

func (f tokenProviderFunc) GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *token, err error) {
	return f(ctx, req)
}
