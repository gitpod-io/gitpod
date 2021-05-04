// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/gitpod-io/gitpod/supervisor/api"
)

func TestInMemoryTokenServiceGetToken(t *testing.T) {
	type Expectation struct {
		Resp *api.GetTokenResponse
		Err  string
	}
	var (
		defaultToken = "foobar"
		defaultKind  = "myprovider"
		defaultHost  = "gitpod.io"

		errNoToken = status.Error(codes.NotFound, "no token available").Error()
	)
	newToken := func(scopes ...string) *Token {
		expiry := time.Now().Add(1 * time.Hour)
		return &Token{
			Host:       defaultHost,
			ExpiryDate: &expiry,
			Scope:      mapScopes(scopes),
			Token:      defaultToken,
			Reuse:      api.TokenReuse_REUSE_WHEN_POSSIBLE,
		}
	}

	tests := []struct {
		Desc        string
		Req         *api.GetTokenRequest
		Cache       map[string][]*Token
		Provider    map[string][]tokenProvider
		Expectation Expectation
	}{
		{
			Desc: "no provider",
			Req: &api.GetTokenRequest{
				Kind: defaultKind,
				Host: defaultHost,
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (no reuse)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {
					func(t *Token) *Token {
						t.Reuse = api.TokenReuse_REUSE_NEVER
						return t
					}(newToken("a1", "a2")),
				},
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (exact, reuse when possible)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {newToken("a1", "a2")},
			},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken, Scope: []string{"a1", "a2"}},
			},
		},
		{
			Desc: "cached token (expired)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {
					func(t *Token) *Token {
						exp := time.Now().Add(-2 * time.Hour)
						t.ExpiryDate = &exp
						return t
					}(newToken("a1", "a2")),
					{Host: "foo." + defaultHost},
				},
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (no expiry)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {
					func(t *Token) *Token {
						t.ExpiryDate = nil
						return t
					}(newToken("a1", "a2")),
				},
			},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken, Scope: []string{"a1", "a2"}},
			},
		},
		{
			Desc: "cached token (fewer scopes)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {newToken("a1")},
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "cached token (more scopes, reuse when possible)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {newToken("a1", "a2", "a3")},
			},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken, Scope: []string{"a1", "a2", "a3"}},
			},
		},
		{
			Desc: "cached token (more scopes, exact reuse)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Cache: map[string][]*Token{
				defaultKind: {
					func(t *Token) *Token {
						t.Reuse = api.TokenReuse_REUSE_EXACTLY
						return t
					}(newToken("a1", "a2", "a3")),
				},
			},
			Expectation: Expectation{
				Err: errNoToken,
			},
		},
		{
			Desc: "token provider (no token)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Provider: map[string][]tokenProvider{
				defaultKind: {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
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
				Kind:  defaultKind,
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Provider: map[string][]tokenProvider{
				defaultKind: {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
					return newToken("a1", "a2"), nil
				})},
				defaultKind + "2": {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
					t := newToken("a1", "a2")
					t.Token += "2"
					return t, nil
				})},
			},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken, Scope: []string{"a1", "a2"}},
			},
		},
		{
			Desc: "token provider (another kind)",
			Req: &api.GetTokenRequest{
				Kind:  defaultKind + "2",
				Host:  defaultHost,
				Scope: []string{"a1", "a2"},
			},
			Provider: map[string][]tokenProvider{
				defaultKind: {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
					return newToken("a1", "a2"), nil
				})},
				defaultKind + "2": {tokenProviderFunc(func(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
					t := newToken("a1", "a2")
					t.Token += "2"
					return t, nil
				})},
			},
			Expectation: Expectation{
				Resp: &api.GetTokenResponse{Token: defaultToken + "2", Scope: []string{"a1", "a2"}},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			service := NewInMemoryTokenService()
			if test.Cache != nil {
				service.token = test.Cache
			}
			service.provider = test.Provider

			resp, err := service.GetToken(context.Background(), test.Req)

			res := Expectation{
				Resp: resp,
			}
			if err != nil {
				res.Err = err.Error()
			}

			sortScopes := cmpopts.SortSlices(func(x, y string) bool { return x < y })
			if diff := cmp.Diff(test.Expectation, res, cmpopts.IgnoreUnexported(api.GetTokenResponse{}), sortScopes); diff != "" {
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

	tExpired := timestamppb.New(time.Now().Add(-2 * time.Hour))
	tValid := timestamppb.New(time.Now().Add(2 * time.Hour))

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

			if diff := cmp.Diff(test.Expectation, res, cmpopts.IgnoreUnexported(api.GetTokenResponse{})); diff != "" {
				t.Errorf("unexpected status (-want +got):\n%s", diff)
			}
		})
	}
}

type tokenProviderFunc func(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error)

func (f tokenProviderFunc) GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
	return f(ctx, req)
}
