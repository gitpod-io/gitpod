// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"gorm.io/gorm"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
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
		serverMock, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

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
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

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
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

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

	t.Run("creates oidc client config", func(t *testing.T) {
		serverMock, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: "test-issuer"},
			Oauth2Config: &v1.OAuth2Config{
				ClientId:     "test-id",
				ClientSecret: "test-secret",
				Scopes:       []string{"my-scope"},
			},
		}
		response, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.CreateClientConfigResponse{
			Config: &v1.OIDCClientConfig{
				Id:             response.Msg.Config.Id,
				OrganizationId: response.Msg.Config.OrganizationId,
				Oauth2Config: &v1.OAuth2Config{
					ClientId:     config.Oauth2Config.ClientId,
					ClientSecret: "REDACTED",
					Scopes:       []string{"openid", "profile", "email", "my-scope"},
				},
			},
		}, response.Msg)

		t.Cleanup(func() {
			dbtest.HardDeleteOIDCClientConfigs(t, response.Msg.Config.GetId())
		})

		retrieved, err := db.GetOIDCClientConfig(context.Background(), dbConn, uuid.MustParse(response.Msg.Config.Id))
		require.NoError(t, err)

		decrypted, err := retrieved.Data.Decrypt(dbtest.CipherSet(t))
		require.NoError(t, err)
		require.Equal(t, toDbOIDCSpec(config.Oauth2Config, config.OidcConfig), decrypted)
	})
}

func TestOIDCService_GetClientConfig_WithFeatureFlagDisabled(t *testing.T) {
	serverMock, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

	serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
	serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

	_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
		Id:             uuid.NewString(),
		OrganizationId: uuid.NewString(),
	}))
	require.Error(t, err)
	require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
}

func TestOIDCService_GetClientConfig_WithFeatureFlagEnabled(t *testing.T) {

	t.Run("invalid argument when config id missing", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when organization id missing", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("not found when record does not exist", func(t *testing.T) {
		serverMock, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("retrieves record when it exists", func(t *testing.T) {
		serverMock, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		orgID := uuid.New()

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: &orgID,
		})[0]

		resp, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
		}))
		require.NoError(t, err)

		converted, err := dbOIDCClientConfigToAPI(created, dbtest.CipherSet(t))
		require.NoError(t, err)

		requireEqualProto(t, &v1.GetClientConfigResponse{
			Config: converted,
		}, resp.Msg)
	})
}

func TestOIDCService_ListClientConfigs_WithFeatureFlagDisabled(t *testing.T) {
	serverMock, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

	serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
	serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

	_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{
		OrganizationId: uuid.NewString(),
	}))
	require.Error(t, err)
	require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
}

func TestOIDCService_ListClientConfigs_WithFeatureFlagEnabled(t *testing.T) {

	t.Run("invalid argument when organization id missing", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when organization id is invalid", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{
			OrganizationId: "some-invalid-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("retrieves configs by organization id", func(t *testing.T) {
		serverMock, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		orgA, orgB := uuid.New(), uuid.New()

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		configs := dbtest.CreateOIDCClientConfigs(t, dbConn,
			dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
				OrganizationID: &orgA,
			}),
			dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
				OrganizationID: &orgA,
			}),
			dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
				OrganizationID: &orgB,
			}),
		)

		response, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{
			OrganizationId: orgA.String(),
		}))
		require.NoError(t, err)

		configA, err := dbOIDCClientConfigToAPI(configs[0], dbtest.CipherSet(t))
		require.NoError(t, err)
		configB, err := dbOIDCClientConfigToAPI(configs[1], dbtest.CipherSet(t))
		require.NoError(t, err)

		expected := []*v1.OIDCClientConfig{
			configA,
			configB,
		}
		sort.Slice(expected, func(i, j int) bool {
			return strings.Compare(expected[i].Id, expected[j].Id) == -1

		})

		requireEqualProto(t, expected, response.Msg.ClientConfigs)
	})

}

func TestOIDCService_UpdateClientConfig(t *testing.T) {
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
		serverMock, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("feature flag enabled returns unimplemented", func(t *testing.T) {
		serverMock, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func TestOIDCService_DeleteClientConfig_WithFeatureFlagDisabled(t *testing.T) {
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
		serverMock, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)
		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

}

func TestOIDCService_DeleteClientConfig_WithFeatureFlagEnabled(t *testing.T) {
	t.Run("invalid argument when ID not specified", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when Organization ID not specified", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("not found when record does not exist", func(t *testing.T) {
		serverMock, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("deletes record", func(t *testing.T) {
		serverMock, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		orgID := uuid.New()

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: &orgID,
		})[0]

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		resp, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.DeleteClientConfigResponse{}, resp.Msg)
	})
}

func setupOIDCService(t *testing.T, expClient experiments.Client) (*protocol.MockAPIInterface, v1connect.OIDCServiceClient, *gorm.DB) {
	t.Helper()

	dbConn := dbtest.ConnectForTests(t)

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewOIDCService(&FakeServerConnPool{api: serverMock}, expClient, dbConn, dbtest.CipherSet(t))

	_, handler := v1connect.NewOIDCServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewOIDCServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client, dbConn
}
