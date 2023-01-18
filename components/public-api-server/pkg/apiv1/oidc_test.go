// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	grpc "google.golang.org/grpc"

	iam "github.com/gitpod-io/gitpod/components/iam-api/go/v1"
	"github.com/google/uuid"

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

func TestOIDCService_CreateClientConfig_FeatureFlagDisabled(t *testing.T) {
	organizationID := uuid.New()

	t.Run("returns unauthorized", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: &v1.OIDCClientConfig{
				OrganizationId: organizationID.String(),
			},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})
}

func TestOIDCService_CreateClientConfig_FeatureFlagEnabled(t *testing.T) {
	organizationID := uuid.New()

	t.Run("returns invalid argument when no organisation specified", func(t *testing.T) {
		_, client := setupOIDCService(t, withOIDCFeatureEnabled)

		config := &v1.OIDCClientConfig{
			OidcConfig:   &v1.OIDCConfig{Issuer: "test-issuer"},
			Oauth2Config: &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns invalid argument when organisation id is not a uuid", func(t *testing.T) {
		_, client := setupOIDCService(t, withOIDCFeatureEnabled)

		config := &v1.OIDCClientConfig{
			OrganizationId: "some-random-id",
			OidcConfig:     &v1.OIDCConfig{Issuer: "test-issuer"},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("delegates to iam and returns created config", func(t *testing.T) {
		serverMock, client := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: "test-issuer"},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		response, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.NoError(t, err)
		require.NotNil(t, response)
		config.Oauth2Config.ClientSecret = "REDACTED"
		requireEqualProto(t, &v1.CreateClientConfigResponse{
			Config: config,
		}, response.Msg)
	})
}

func TestOIDCService_GetClientConfig(t *testing.T) {
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
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
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
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
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
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
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
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

	svc := NewOIDCService(&FakeServerConnPool{api: serverMock}, expClient, &stubOIDCServiceServer{})

	_, handler := v1connect.NewOIDCServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewOIDCServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}

type stubOIDCServiceServer struct {
}

func (stubOIDCServiceServer) CreateClientConfig(ctx context.Context, request *iam.CreateClientConfigRequest, options ...grpc.CallOption) (*iam.CreateClientConfigResponse, error) {
	return &iam.CreateClientConfigResponse{
		Config: request.GetConfig(),
	}, nil
}
func (stubOIDCServiceServer) GetClientConfig(context.Context, *iam.GetClientConfigRequest, ...grpc.CallOption) (*iam.GetClientConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetClientConfig not implemented")
}
func (stubOIDCServiceServer) ListClientConfigs(context.Context, *iam.ListClientConfigsRequest, ...grpc.CallOption) (*iam.ListClientConfigsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListClientConfigs not implemented")
}
func (stubOIDCServiceServer) UpdateClientConfig(context.Context, *iam.UpdateClientConfigRequest, ...grpc.CallOption) (*iam.UpdateClientConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UpdateClientConfig not implemented")
}
func (stubOIDCServiceServer) DeleteClientConfig(context.Context, *iam.DeleteClientConfigRequest, ...grpc.CallOption) (*iam.DeleteClientConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DeleteClientConfig not implemented")
}
