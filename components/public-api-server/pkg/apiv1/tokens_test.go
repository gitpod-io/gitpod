// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/experiments/experimentstest"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
)

func TestTokensService_CreatePersonalAccessTokenWithoutFeatureFlag(t *testing.T) {
	experimentsClient := &experimentstest.Client{
		BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
			return experiment == experiments.PersonalAccessTokensEnabledFlag
		},
	}

	user := newUser(&protocol.User{})

	t.Run("permission denied when feature flag is not enabled", func(t *testing.T) {
		serverMock, client := setupTokensService(t, &experimentstest.Client{
			BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
				return false
			},
		})

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.CreatePersonalAccessToken(context.Background(), &connect.Request[v1.CreatePersonalAccessTokenRequest]{})

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("unimplemented when feature flag enabled", func(t *testing.T) {
		serverMock, client := setupTokensService(t, experimentsClient)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.CreatePersonalAccessToken(context.Background(), &connect.Request[v1.CreatePersonalAccessTokenRequest]{})
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func setupTokensService(t *testing.T, expClient experiments.Client) (*protocol.MockAPIInterface, v1connect.TokensServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewTokensService(&FakeServerConnPool{api: serverMock}, expClient)

	_, handler := v1connect.NewTokensServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewTokensServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}
