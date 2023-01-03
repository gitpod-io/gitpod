// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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

var (
	withOIDCFeatureDisabled = &experimentstest.Client{
		BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
			return false
		},
	}
	withOIDCFeatureEnabled = &experimentstest.Client{
		BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
			return experiment == experiments.OIDCServiceEnabledFlag
		},
	}

	user = newUser(&protocol.User{})
)

func TestOIDCService_CreateClientConfig(t *testing.T) {
	t.Run("feature flag disabled returns unathorized", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("feature flag enabled returns unimplemented", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func TestOIDCService_GetClientConfig(t *testing.T) {
	t.Run("feature flag disabled returns unathorized", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("feature flag enabled returns unimplemented", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func TestOIDCService_ListClientConfigs(t *testing.T) {
	t.Run("feature flag disabled returns unathorized", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("feature flag enabled returns unimplemented", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func TestOIDCService_UpdateClientConfig(t *testing.T) {
	t.Run("feature flag disabled returns unathorized", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("feature flag enabled returns unimplemented", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func TestOIDCService_DeleteClientConfig(t *testing.T) {
	t.Run("feature flag disabled returns unathorized", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("feature flag enabled returns unimplemented", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func setupOIDCService(t *testing.T, expClient experiments.Client) (*protocol.MockAPIInterface, v1connect.OIDCServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewOIDCService(&FakeServerConnPool{api: serverMock}, expClient)

	_, handler := v1connect.NewOIDCServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewOIDCServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}
