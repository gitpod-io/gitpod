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
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/experiments/experimentstest"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
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

	user           = newUser(&protocol.User{})
	organizationID = uuid.New()
)

func TestOIDCService_CreateClientConfig_FeatureFlagDisabled(t *testing.T) {

	t.Run("returns unauthorized", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)
		issuer := newFakeIdP(t, true)

		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: &v1.OIDCClientConfig{
				OrganizationId: organizationID.String(),
				OidcConfig: &v1.OIDCConfig{
					Issuer: issuer,
				},
			},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})
}

func TestOIDCService_CreateClientConfig_FeatureFlagEnabled(t *testing.T) {
	t.Run("returns invalid argument when no organisation specified", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		config := &v1.OIDCClientConfig{
			OidcConfig:   &v1.OIDCConfig{Issuer: issuer},
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
		issuer := newFakeIdP(t, true)

		config := &v1.OIDCClientConfig{
			OrganizationId: "some-random-id",
			OidcConfig:     &v1.OIDCConfig{Issuer: issuer},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns permission denied when user is not org owner", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		anotherOrg := uuid.New()
		dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
			OrganizationID: anotherOrg,
			UserID:         uuid.MustParse(user.ID),
			Role:           db.OrganizationMembershipRole_Member,
		})

		config := &v1.OIDCClientConfig{
			OrganizationId: anotherOrg.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: issuer},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("returns invalid argument when issuer is not valid URL", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: "random thing which is not url"},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns invalid argument when issuer is not reachable", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: "https://this-host-is-not-reachable"},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns invalid argument when issuer does not provide discovery", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, false)

		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: issuer},
			Oauth2Config:   &v1.OAuth2Config{ClientId: "test-id", ClientSecret: "test-secret"},
		}
		_, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.Error(t, err)
		require.Contains(t, err.Error(), "needs to support OIDC Discovery")
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("creates oidc client config", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		// Trailing slashes should be removed from the issuer
		issuerWithTrailingSlash := issuer + "/"
		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig:     &v1.OIDCConfig{Issuer: issuerWithTrailingSlash},
			Active:         true,
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
				Active:         true,
				OrganizationId: response.Msg.Config.OrganizationId,
				Oauth2Config: &v1.OAuth2Config{
					ClientId:     config.Oauth2Config.ClientId,
					ClientSecret: "REDACTED",
					Scopes:       []string{"openid", "profile", "email", "my-scope"},
				},
				OidcConfig: &v1.OIDCConfig{
					Issuer: issuer,
				},
			},
		}, response.Msg)

		t.Cleanup(func() {
			dbtest.HardDeleteOIDCClientConfigs(t, response.Msg.Config.GetId())
		})

		retrieved, err := db.GetOIDCClientConfig(context.Background(), dbConn, uuid.MustParse(response.Msg.Config.Id))
		require.NoError(t, err)
		require.Equal(t, issuer, retrieved.Issuer, "issuer must not contain trailing slash")

		decrypted, err := retrieved.Data.Decrypt(dbtest.CipherSet(t))
		require.NoError(t, err)
		require.Equal(t, toDbOIDCSpec(config.Oauth2Config), decrypted)
	})
}

func TestOIDCService_GetClientConfig_WithFeatureFlagDisabled(t *testing.T) {
	_, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

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
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("retrieves record when it exists", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
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

	t.Run("returns permission denied when user is not org owner", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		anotherOrg := uuid.New()
		dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
			OrganizationID: anotherOrg,
			UserID:         uuid.MustParse(user.ID),
			Role:           db.OrganizationMembershipRole_Member,
		})

		_, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: anotherOrg.String(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})
}

func TestOIDCService_ListClientConfigs_WithFeatureFlagDisabled(t *testing.T) {
	_, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

	_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{
		OrganizationId: organizationID.String(),
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

	t.Run("returns permission denied when user is not org owner", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		anotherOrg := uuid.New()
		dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
			OrganizationID: anotherOrg,
			UserID:         uuid.MustParse(user.ID),
			Role:           db.OrganizationMembershipRole_Member,
		})

		_, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{
			OrganizationId: anotherOrg.String(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("retrieves configs by organization id", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		anotherOrgID := uuid.New()

		configs := dbtest.CreateOIDCClientConfigs(t, dbConn,
			dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
				OrganizationID: organizationID,
				Issuer:         issuer,
			}),
			dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
				OrganizationID: organizationID,
				Issuer:         issuer,
			}),
			dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
				OrganizationID: anotherOrgID,
				Issuer:         issuer,
			}),
		)

		response, err := client.ListClientConfigs(context.Background(), connect.NewRequest(&v1.ListClientConfigsRequest{
			OrganizationId: organizationID.String(),
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

func TestOIDCService_UpdateClientConfig_WithFeatureFlagDisabled(t *testing.T) {
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{
			Config: &v1.OIDCClientConfig{
				Id:             uuid.NewString(),
				OrganizationId: organizationID.String(),
			},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

}

func TestOIDCService_UpdateClientConfig_WithFeatureFlagEnabled(t *testing.T) {
	t.Run("non-existent config ID returns not found", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{
			Config: &v1.OIDCClientConfig{
				Id:             uuid.New().String(),
				OrganizationId: organizationID.String(),
			},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("returns permission denied when user is not org owner", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		anotherOrg := uuid.New()
		dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
			OrganizationID: anotherOrg,
			UserID:         uuid.MustParse(user.ID),
			Role:           db.OrganizationMembershipRole_Member,
		})

		_, err := client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{
			Config: &v1.OIDCClientConfig{
				Id:             uuid.New().String(),
				OrganizationId: anotherOrg.String(),
			},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("partially applies updates to issuer and scopes", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)
		issuerNew := newFakeIdP(t, true)

		config := &v1.OIDCClientConfig{
			OrganizationId: organizationID.String(),
			OidcConfig: &v1.OIDCConfig{
				Issuer: issuer,
			},
			Active: true,
			Oauth2Config: &v1.OAuth2Config{
				ClientId:     "test-id",
				ClientSecret: "test-secret",
				Scopes:       []string{"my-scope"},
			},
		}
		created, err := client.CreateClientConfig(context.Background(), connect.NewRequest(&v1.CreateClientConfigRequest{
			Config: config,
		}))
		require.NoError(t, err)

		_, err = client.UpdateClientConfig(context.Background(), connect.NewRequest(&v1.UpdateClientConfigRequest{
			Config: &v1.OIDCClientConfig{
				Id:             created.Msg.GetConfig().Id,
				OrganizationId: organizationID.String(),
				OidcConfig: &v1.OIDCConfig{
					Issuer: issuerNew + "/", // trailing slash should be removed
				},
				Oauth2Config: &v1.OAuth2Config{
					Scopes: []string{"foo"},
				},
			},
		}))
		require.NoError(t, err)

		retrieved, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             created.Msg.GetConfig().GetId(),
			OrganizationId: created.Msg.GetConfig().OrganizationId,
		}))
		require.NoError(t, err)

		require.Equal(t, config.Active, retrieved.Msg.GetConfig().Active, "unexpected change of `active` flag")
		require.Equal(t, issuerNew, retrieved.Msg.GetConfig().OidcConfig.Issuer)
		require.Equal(t, []string{"email", "foo", "openid", "profile"}, retrieved.Msg.GetConfig().GetOauth2Config().GetScopes())

	})
}

func TestOIDCService_DeleteClientConfig_WithFeatureFlagDisabled(t *testing.T) {
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

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
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: organizationID.String(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("returns permission denied when user is not org owner", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		anotherOrg := uuid.New()
		dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
			OrganizationID: anotherOrg,
			UserID:         uuid.MustParse(user.ID),
			Role:           db.OrganizationMembershipRole_Member,
		})

		_, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id:             uuid.NewString(),
			OrganizationId: anotherOrg.String(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("deletes record", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
		})[0]

		resp, err := client.DeleteClientConfig(context.Background(), connect.NewRequest(&v1.DeleteClientConfigRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.DeleteClientConfigResponse{}, resp.Msg)
	})
}

func TestOIDCService_SetClientConfigActivation_WithFeatureFlagDisabled(t *testing.T) {
	t.Run("feature flag disabled returns unauthorized", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureDisabled)

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             uuid.NewString(),
			OrganizationId: uuid.NewString(),
			Activate:       true,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

}

func TestOIDCService_SetClientConfigActivation_WithFeatureFlagEnabled(t *testing.T) {
	t.Run("invalid argument when ID not specified", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when Organization ID not specified", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id: uuid.NewString(),
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns permission denied when user is not org owner", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)

		anotherOrg := uuid.New()
		dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
			OrganizationID: anotherOrg,
			UserID:         uuid.MustParse(user.ID),
			Role:           db.OrganizationMembershipRole_Member,
		})

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             uuid.NewString(),
			OrganizationId: anotherOrg.String(),
			Activate:       true,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("activates record", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
			Active:         false,
			Verified:       db.BoolPointer(true),
		})[0]

		resp, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
			Activate:       true,
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.SetClientConfigActivationResponse{}, resp.Msg)
	})

	t.Run("fails to activate unverified record", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
			Active:         false,
			Verified:       db.BoolPointer(false),
		})[0]

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
			Activate:       true,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeFailedPrecondition, connect.CodeOf(err))
	})

	t.Run("activation of record should deactivate others", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		configs := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
			Active:         true,
			Verified:       db.BoolPointer(true),
		}, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
			Active:         false,
			Verified:       db.BoolPointer(true),
		})

		first := configs[0]
		second := configs[1]

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             second.ID.String(),
			OrganizationId: organizationID.String(),
			Activate:       true,
		}))
		require.NoError(t, err)

		getFirstConfigResponse, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             first.ID.String(),
			OrganizationId: organizationID.String(),
		}))
		require.NoError(t, err)
		require.Equal(t, false, getFirstConfigResponse.Msg.GetConfig().Active)
	})

	t.Run("deactivates record", func(t *testing.T) {
		_, client, dbConn := setupOIDCService(t, withOIDCFeatureEnabled)
		issuer := newFakeIdP(t, true)

		created := dbtest.CreateOIDCClientConfigs(t, dbConn, db.OIDCClientConfig{
			OrganizationID: organizationID,
			Issuer:         issuer,
			Active:         true,
			Verified:       db.BoolPointer(true),
		})[0]

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
			Activate:       false,
		}))
		require.NoError(t, err)

		getResponse, err := client.GetClientConfig(context.Background(), connect.NewRequest(&v1.GetClientConfigRequest{
			Id:             created.ID.String(),
			OrganizationId: created.OrganizationID.String(),
		}))
		require.NoError(t, err)
		require.Equal(t, false, getResponse.Msg.Config.Active)
	})

	t.Run("record not found", func(t *testing.T) {
		_, client, _ := setupOIDCService(t, withOIDCFeatureEnabled)

		_, err := client.SetClientConfigActivation(context.Background(), connect.NewRequest(&v1.SetClientConfigActivationRequest{
			Id:             uuid.NewString(),
			OrganizationId: organizationID.String(),
			Activate:       false,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})
}

func setupOIDCService(t *testing.T, expClient experiments.Client) (*protocol.MockAPIInterface, v1connect.OIDCServiceClient, *gorm.DB) {
	t.Helper()

	dbConn := dbtest.ConnectForTests(t)

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewOIDCService(&FakeServerConnPool{api: serverMock}, expClient, dbConn, dbtest.CipherSet(t))

	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	_, handler := v1connect.NewOIDCServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor(config.SessionConfig{
		Issuer: "unitetest.com",
		Cookie: config.CookieConfig{
			Name: "cookie_jwt",
		},
	}, rsa256)))

	router := chi.NewRouter()
	router.Use(middleware.Logger)
	router.Mount("/", handler)
	ts := httptest.NewServer(router)
	t.Cleanup(ts.Close)

	client := v1connect.NewOIDCServiceClient(http.DefaultClient, ts.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	// setup our default user
	serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil).AnyTimes()
	serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil).AnyTimes()
	// ensure our user is owner of our default org
	dbtest.CreateTeamMembership(t, dbConn, db.OrganizationMembership{
		UserID:         uuid.MustParse(user.ID),
		OrganizationID: organizationID,
		Role:           db.OrganizationMembershipRole_Owner,
	})

	return serverMock, client, dbConn
}

func newFakeIdP(t *testing.T, discoveryEnabled bool) string {
	t.Helper()

	router := chi.NewRouter()
	ts := httptest.NewServer(router)
	t.Cleanup(ts.Close)
	url := ts.URL

	router.Use(middleware.Logger)
	if discoveryEnabled {
		router.Get("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Add("Content-Type", "application/json;application/foo")
			_, err := w.Write([]byte(`{}`))
			require.NoError(t, err)
		})
	}
	return url
}
