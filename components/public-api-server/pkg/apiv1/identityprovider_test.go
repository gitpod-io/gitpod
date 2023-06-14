// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/stretchr/testify/require"
	"github.com/zitadel/oidc/pkg/oidc"
)

func TestGetIDToken(t *testing.T) {
	const workspaceID = "gitpodio-gitpod-te23l4bjejv"
	type Expectation struct {
		Error    string
		Response *v1.GetIDTokenResponse
	}
	tests := []struct {
		Name        string
		TokenSource func(t *testing.T) IDTokenSource
		ServerSetup func(*protocol.MockAPIInterface)
		Request     *v1.GetIDTokenRequest

		Expectation Expectation
	}{
		{
			Name: "org-owned user",
			TokenSource: func(t *testing.T) IDTokenSource {
				return functionIDTokenSource(func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
					require.Equal(t, "correct@gitpod.io", userInfo.GetEmail())
					require.True(t, userInfo.IsEmailVerified())

					return "foobar", nil
				})
			},
			ServerSetup: func(ma *protocol.MockAPIInterface) {
				ma.EXPECT().GetIDToken(gomock.Any()).MinTimes(1).Return(nil)
				ma.EXPECT().GetWorkspace(gomock.Any(), workspaceID).MinTimes(1).Return(
					&protocol.WorkspaceInfo{
						Workspace: &protocol.Workspace{
							ContextURL: "https://github.com/gitpod-io/gitpod",
						},
					},
					nil,
				)
				ma.EXPECT().GetLoggedInUser(gomock.Any()).Return(
					&protocol.User{
						Name: "foobar",
						Identities: []*protocol.Identity{
							nil,
							{Deleted: true, PrimaryEmail: "nonsense@gitpod.io"},
							{Deleted: false, PrimaryEmail: "correct@gitpod.io"},
						},
						OrganizationId: "test",
					},
					nil,
				)
			},
			Request: &v1.GetIDTokenRequest{
				WorkspaceId: workspaceID,
				Audience:    []string{"some.audience.com"},
			},
			Expectation: Expectation{
				Response: &v1.GetIDTokenResponse{
					Token: "foobar",
				},
			},
		},
		{
			Name: "none org-owned user",
			TokenSource: func(t *testing.T) IDTokenSource {
				return functionIDTokenSource(func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
					require.Equal(t, "correct@gitpod.io", userInfo.GetEmail())
					require.False(t, userInfo.IsEmailVerified())

					return "foobar", nil
				})
			},
			ServerSetup: func(ma *protocol.MockAPIInterface) {
				ma.EXPECT().GetIDToken(gomock.Any()).MinTimes(1).Return(nil)
				ma.EXPECT().GetWorkspace(gomock.Any(), workspaceID).MinTimes(1).Return(
					&protocol.WorkspaceInfo{
						Workspace: &protocol.Workspace{
							ContextURL: "https://github.com/gitpod-io/gitpod",
						},
					},
					nil,
				)
				ma.EXPECT().GetLoggedInUser(gomock.Any()).Return(
					&protocol.User{
						Name: "foobar",
						Identities: []*protocol.Identity{
							nil,
							{Deleted: true, PrimaryEmail: "nonsense@gitpod.io"},
							{Deleted: false, PrimaryEmail: "correct@gitpod.io"},
						},
					},
					nil,
				)
			},
			Request: &v1.GetIDTokenRequest{
				WorkspaceId: workspaceID,
				Audience:    []string{"some.audience.com"},
			},
			Expectation: Expectation{
				Response: &v1.GetIDTokenResponse{
					Token: "foobar",
				},
			},
		},
		{
			Name: "workspace not found",
			TokenSource: func(t *testing.T) IDTokenSource {
				return functionIDTokenSource(func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
					return "foobar", nil
				})
			},
			ServerSetup: func(ma *protocol.MockAPIInterface) {
				ma.EXPECT().GetIDToken(gomock.Any()).MinTimes(1).Return(nil)
				ma.EXPECT().GetWorkspace(gomock.Any(), workspaceID).MinTimes(1).Return(
					nil,
					&jsonrpc2.Error{Code: 400, Message: "workspace not found"},
				)
			},
			Request: &v1.GetIDTokenRequest{
				WorkspaceId: workspaceID,
				Audience:    []string{"some.audience.com"},
			},
			Expectation: Expectation{
				Error: connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("workspace not found")).Error(),
			},
		},
		{
			Name: "no logged in user",
			TokenSource: func(t *testing.T) IDTokenSource {
				return functionIDTokenSource(func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
					return "foobar", nil
				})
			},
			ServerSetup: func(ma *protocol.MockAPIInterface) {
				ma.EXPECT().GetIDToken(gomock.Any()).MinTimes(1).Return(nil)
				ma.EXPECT().GetWorkspace(gomock.Any(), workspaceID).MinTimes(1).Return(
					&protocol.WorkspaceInfo{
						Workspace: &protocol.Workspace{
							ContextURL: "https://github.com/gitpod-io/gitpod",
						},
					},
					nil,
				)
				ma.EXPECT().GetLoggedInUser(gomock.Any()).Return(
					nil,
					&jsonrpc2.Error{Code: 401, Message: "User is not authenticated. Please login."},
				)
			},
			Request: &v1.GetIDTokenRequest{
				WorkspaceId: workspaceID,
				Audience:    []string{"some.audience.com"},
			},
			Expectation: Expectation{
				Error: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("User is not authenticated. Please login.")).Error(),
			},
		},
		{
			Name: "no audience",
			TokenSource: func(t *testing.T) IDTokenSource {
				return functionIDTokenSource(func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
					return "foobar", nil
				})
			},
			Request: &v1.GetIDTokenRequest{
				WorkspaceId: workspaceID,
			},
			Expectation: Expectation{
				Error: connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Must have at least one audience entry")).Error(),
			},
		},
		{
			Name: "token source error",
			TokenSource: func(t *testing.T) IDTokenSource {
				return functionIDTokenSource(func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
					return "", fmt.Errorf("cannot produce token")
				})
			},
			ServerSetup: func(ma *protocol.MockAPIInterface) {
				ma.EXPECT().GetIDToken(gomock.Any()).MinTimes(1).Return(nil)
				ma.EXPECT().GetWorkspace(gomock.Any(), workspaceID).MinTimes(1).Return(
					&protocol.WorkspaceInfo{
						Workspace: &protocol.Workspace{
							ContextURL: "https://github.com/gitpod-io/gitpod",
						},
					},
					nil,
				)
				ma.EXPECT().GetLoggedInUser(gomock.Any()).Return(
					&protocol.User{
						Name: "foobar",
					},
					nil,
				)
			},
			Request: &v1.GetIDTokenRequest{
				WorkspaceId: workspaceID,
				Audience:    []string{"some.audience.com"},
			},
			Expectation: Expectation{
				Error: connect.NewError(connect.CodeInternal, fmt.Errorf("cannot produce token")).Error(),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			t.Cleanup(ctrl.Finish)
			serverMock := protocol.NewMockAPIInterface(ctrl)
			if test.ServerSetup != nil {
				test.ServerSetup(serverMock)
			}

			keyset := jwstest.GenerateKeySet(t)
			rsa256, err := jws.NewRSA256(keyset)
			require.NoError(t, err)

			svc := NewIdentityProviderService(&FakeServerConnPool{api: serverMock}, test.TokenSource(t))
			_, handler := v1connect.NewIdentityProviderServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor(config.SessionConfig{
				Issuer: "unitetest.com",
				Cookie: config.CookieConfig{
					Name: "cookie_jwt",
				},
			}, rsa256)))
			srv := httptest.NewServer(handler)
			t.Cleanup(srv.Close)

			client := v1connect.NewIdentityProviderServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
				auth.NewClientInterceptor("auth-token"),
			))

			resp, err := client.GetIDToken(context.Background(), &connect.Request[v1.GetIDTokenRequest]{
				Msg: test.Request,
			})
			var act Expectation
			if err != nil {
				act.Error = err.Error()
			} else {
				act.Response = resp.Msg
			}

			if diff := cmp.Diff(test.Expectation, act, cmpopts.IgnoreUnexported(v1.GetIDTokenResponse{})); diff != "" {
				t.Errorf("GetIDToken() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

type functionIDTokenSource func(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error)

func (f functionIDTokenSource) IDToken(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error) {
	return f(ctx, org, audience, userInfo)
}
