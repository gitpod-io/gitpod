// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/experiments/experimentstest"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/golang/mock/gomock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var (
	withTokenFeatureDisabled = &experimentstest.Client{
		BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
			return false
		},
	}
	withTokenFeatureEnabled = &experimentstest.Client{
		BoolMatcher: func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool {
			return experiment == experiments.PersonalAccessTokensEnabledFlag
		},
	}

	signer = auth.NewHS256Signer([]byte("my-secret"))
)

func TestTokensService_CreatePersonalAccessTokenWithoutFeatureFlag(t *testing.T) {
	user := newUser(&protocol.User{})

	t.Run("permission denied when feature flag is not enabled", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.CreatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{
				Name:           "my-token",
				ExpirationTime: timestamppb.Now(),
			},
		}))

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("invalid argument when name is not specified", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureDisabled)

		_, err := client.CreatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{},
		}))
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when expiration time is unspecified", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureDisabled)

		_, err := client.CreatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{
				Name: "my-token",
			},
		}))
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when expiration time is invalid", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureDisabled)

		_, err := client.CreatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{
				Name: "my-token",
				ExpirationTime: &timestamppb.Timestamp{
					Seconds: 253402300799 + 1,
				},
			},
		}))
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("crates personal access token", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		token := &v1.PersonalAccessToken{
			Name:           "my-token",
			ExpirationTime: timestamppb.Now(),
		}

		response, err := client.CreatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
			Token: token,
		}))
		require.NoError(t, err)

		created := response.Msg.GetToken()
		t.Cleanup(func() {
			require.NoError(t, dbConn.Where("id = ?", created.GetId()).Delete(&db.PersonalAccessToken{}).Error)
		})

		require.NotEmpty(t, created.GetId())
		require.Equal(t, token.Name, created.GetName())
		require.Equal(t, token.Scopes, created.GetScopes())
		requireEqualProto(t, token.GetExpirationTime(), created.GetExpirationTime())

		// Returned token must be parseable
		_, err = auth.ParsePersonalAccessToken(created.GetValue(), signer)
		require.NoError(t, err)

		// token must exist in the DB, with the User ID of the requestor
		storedInDB, err := db.GetPersonalAccessTokenForUser(context.Background(), dbConn, uuid.MustParse(created.GetId()), uuid.MustParse(user.ID))
		require.NoError(t, err)
		require.Equal(t, user.ID, storedInDB.UserID.String())
	})
}

func TestTokensService_GetPersonalAccessToken(t *testing.T) {
	user := newUser(&protocol.User{})
	user2 := newUser(&protocol.User{})

	t.Run("get correct token", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		tokens := dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user.ID),
			}),
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user2.ID),
			}),
		)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		response, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: tokens[0].ID.String(),
		}))

		require.NoError(t, err)

		requireEqualProto(t, &v1.GetPersonalAccessTokenResponse{
			Token: personalAccessTokenToAPI(tokens[0], ""),
		}, response.Msg)
	})

	t.Run("invalid argument when Token ID is empty", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is not a valid UUID", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: "foo-bar",
		}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("responds with not found when token is not found", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		someTokenId := uuid.New().String()

		dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user.ID),
			}),
		)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: someTokenId,
		}))

		require.Error(t, err, fmt.Errorf("Token with ID %s does not exist: not found", someTokenId))
	})

	t.Run("permission denied when feature flag disabled", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureDisabled)

		tokens := dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user.ID),
			}),
		)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: tokens[0].ID.String(),
		}))

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})
}

func TestTokensService_ListPersonalAccessTokens(t *testing.T) {
	user := newUser(&protocol.User{})

	t.Run("permission denied when feature flag is disabled", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.ListPersonalAccessTokens(context.Background(), connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("no tokens returns empty list", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		response, err := client.ListPersonalAccessTokens(context.Background(), connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.ListPersonalAccessTokensResponse{
			Tokens:       nil,
			TotalResults: 0,
		}, response.Msg)
	})

	t.Run("lists first page of results, when no pagination preference specified", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		now := time.Now().UTC().Round(time.Millisecond)
		tokens := dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID:    uuid.MustParse(user.ID),
				CreatedAt: now.Add(-1 * time.Minute),
			}),
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID:    uuid.MustParse(user.ID),
				CreatedAt: now,
			}),
		)

		response, err := client.ListPersonalAccessTokens(context.Background(), connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.ListPersonalAccessTokensResponse{
			Tokens:       personalAccessTokensToAPI(tokens),
			TotalResults: 2,
		}, response.Msg)
	})

	t.Run("paginating through results", func(t *testing.T) {
		now := time.Now().UTC().Round(time.Millisecond)
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil).Times(3)

		var toCreate []db.PersonalAccessToken
		total := 5
		for i := 5; i > 0; i-- {
			toCreate = append(toCreate, dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID:    uuid.MustParse(user.ID),
				CreatedAt: now.Add(time.Duration(-1*i) * time.Minute),
			}))
		}

		tokens := dbtest.CreatePersonalAccessTokenRecords(t, dbConn, toCreate...)

		firstPage, err := client.ListPersonalAccessTokens(context.Background(), connect.NewRequest(&v1.ListPersonalAccessTokensRequest{
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     1,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListPersonalAccessTokensResponse{
			Tokens:       personalAccessTokensToAPI(tokens[0:2]),
			TotalResults: int64(total),
		}, firstPage.Msg)

		secondPage, err := client.ListPersonalAccessTokens(context.Background(), connect.NewRequest(&v1.ListPersonalAccessTokensRequest{
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     2,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListPersonalAccessTokensResponse{
			Tokens:       personalAccessTokensToAPI(tokens[2:4]),
			TotalResults: int64(total),
		}, secondPage.Msg)

		thirdPage, err := client.ListPersonalAccessTokens(context.Background(), connect.NewRequest(&v1.ListPersonalAccessTokensRequest{
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     3,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListPersonalAccessTokensResponse{
			Tokens:       personalAccessTokensToAPI([]db.PersonalAccessToken{tokens[4]}),
			TotalResults: int64(total),
		}, thirdPage.Msg)
	})
}

func TestTokensService_RegeneratePersonalAccessToken(t *testing.T) {
	user := newUser(&protocol.User{})
	user2 := newUser(&protocol.User{})

	t.Run("permission denied when feature flag is disabled", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.RegeneratePersonalAccessToken(context.Background(), connect.NewRequest(&v1.RegeneratePersonalAccessTokenRequest{
			Id:             uuid.New().String(),
			ExpirationTime: timestamppb.Now(),
		}))

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is empty", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.RegeneratePersonalAccessToken(context.Background(), connect.NewRequest(&v1.RegeneratePersonalAccessTokenRequest{}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is not a valid UUID", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.RegeneratePersonalAccessToken(context.Background(), connect.NewRequest(&v1.RegeneratePersonalAccessTokenRequest{
			Id: "foo-bar",
		}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("responds with not found when token is not found", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		someTokenId := uuid.New().String()

		dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user.ID),
			}),
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user2.ID),
			}),
		)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		newTimestamp := timestamppb.New(time.Date(2023, 1, 2, 15, 4, 5, 0, time.UTC))
		_, err := client.RegeneratePersonalAccessToken(context.Background(), connect.NewRequest(&v1.RegeneratePersonalAccessTokenRequest{
			Id:             someTokenId,
			ExpirationTime: newTimestamp,
		}))
		require.Error(t, err, fmt.Errorf("Token with ID %s does not exist: not found", someTokenId))
	})

	t.Run("regenerate correct token", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		tokens := dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user.ID),
			}),
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user2.ID),
			}),
		)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil).MaxTimes(2)

		origResponse, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: tokens[0].ID.String(),
		}))
		require.NoError(t, err)

		newTimestamp := timestamppb.New(time.Now().Add(24 * time.Hour).UTC().Truncate(time.Millisecond))
		response, err := client.RegeneratePersonalAccessToken(context.Background(), connect.NewRequest(&v1.RegeneratePersonalAccessTokenRequest{
			Id:             tokens[0].ID.String(),
			ExpirationTime: newTimestamp,
		}))
		require.NoError(t, err)

		require.Equal(t, origResponse.Msg.Token.Id, response.Msg.Token.Id)
		require.NotEqual(t, "", response.Msg.Token.Value)
		require.Equal(t, origResponse.Msg.Token.Name, response.Msg.Token.Name)
		require.Equal(t, origResponse.Msg.Token.Scopes, response.Msg.Token.Scopes)
		require.Equal(t, newTimestamp.AsTime(), response.Msg.Token.ExpirationTime.AsTime())
		require.Equal(t, origResponse.Msg.Token.CreatedAt, response.Msg.Token.CreatedAt)
	})
}

func TestTokensService_UpdatePersonalAccessToken(t *testing.T) {
	user := newUser(&protocol.User{})

	t.Run("permission denied when feature flag is disabled", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.UpdatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.UpdatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{
				Id: uuid.New().String(),
			},
		}))

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is empty", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.UpdatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.UpdatePersonalAccessTokenRequest{}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is not a valid UUID", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.UpdatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.UpdatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{
				Id: "foo-bar",
			},
		}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("unimplemented when feature flag enabled", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureEnabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.UpdatePersonalAccessToken(context.Background(), connect.NewRequest(&v1.UpdatePersonalAccessTokenRequest{
			Token: &v1.PersonalAccessToken{
				Id: uuid.New().String(),
			},
		}))

		require.Equal(t, connect.CodeUnimplemented, connect.CodeOf(err))
	})
}

func TestTokensService_DeletePersonalAccessToken(t *testing.T) {
	user := newUser(&protocol.User{})

	t.Run("permission denied when feature flag is disabled", func(t *testing.T) {
		serverMock, _, client := setupTokensService(t, withTokenFeatureDisabled)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil)

		_, err := client.DeletePersonalAccessToken(context.Background(), connect.NewRequest(&v1.DeletePersonalAccessTokenRequest{
			Id: uuid.New().String(),
		}))

		require.Error(t, err, "This feature is currently in beta. If you would like to be part of the beta, please contact us.")
		require.Equal(t, connect.CodePermissionDenied, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is empty", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.DeletePersonalAccessToken(context.Background(), connect.NewRequest(&v1.DeletePersonalAccessTokenRequest{}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when Token ID is not a valid UUID", func(t *testing.T) {
		_, _, client := setupTokensService(t, withTokenFeatureEnabled)

		_, err := client.DeletePersonalAccessToken(context.Background(), connect.NewRequest(&v1.DeletePersonalAccessTokenRequest{
			Id: "foo-bar",
		}))

		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("delete token", func(t *testing.T) {
		serverMock, dbConn, client := setupTokensService(t, withTokenFeatureEnabled)

		tokens := dbtest.CreatePersonalAccessTokenRecords(t, dbConn,
			dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
				UserID: uuid.MustParse(user.ID),
			}),
		)

		serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil).Times(3)

		_, err := client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: tokens[0].ID.String(),
		}))
		require.NoError(t, err)

		_, err = client.DeletePersonalAccessToken(context.Background(), connect.NewRequest(&v1.DeletePersonalAccessTokenRequest{
			Id: tokens[0].ID.String(),
		}))
		require.NoError(t, err)

		_, err = client.GetPersonalAccessToken(context.Background(), connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
			Id: tokens[0].ID.String(),
		}))
		require.Error(t, err, fmt.Errorf("Token with ID %s does not exist: not found", tokens[0].ID.String()))
	})
}

func TestTokensService_Workflow(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Round(time.Millisecond)
	user := newUser(&protocol.User{})
	serverMock, _, client := setupTokensService(t, withTokenFeatureEnabled)

	serverMock.EXPECT().GetLoggedInUser(gomock.Any()).Return(user, nil).AnyTimes()

	// Create 1 token
	createdTokenResponse, err := client.CreatePersonalAccessToken(ctx, connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
		Token: &v1.PersonalAccessToken{
			Name:           "my-first-token",
			ExpirationTime: timestamppb.New(now.Add(1 * time.Hour)),
		},
	}))
	require.NoError(t, err)

	_, err = client.GetPersonalAccessToken(ctx, connect.NewRequest(&v1.GetPersonalAccessTokenRequest{
		Id: createdTokenResponse.Msg.Token.GetId(),
	}))
	require.NoError(t, err, "must retrieve the token we created")

	response, err := client.ListPersonalAccessTokens(ctx, connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))
	require.NoError(t, err)
	require.Len(t, response.Msg.Tokens, 1, "must retrieve one token which we created earlier")

	// Create a second token
	secondTokenResponse, err := client.CreatePersonalAccessToken(ctx, connect.NewRequest(&v1.CreatePersonalAccessTokenRequest{
		Token: &v1.PersonalAccessToken{
			Name:           "my-second-token",
			ExpirationTime: timestamppb.New(now.Add(1 * time.Hour)),
		},
	}))
	require.NoError(t, err)

	response, err = client.ListPersonalAccessTokens(ctx, connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))
	require.NoError(t, err)
	require.Len(t, response.Msg.Tokens, 2, "must retrieve both tokens we created")

	_, err = client.RegeneratePersonalAccessToken(ctx, connect.NewRequest(&v1.RegeneratePersonalAccessTokenRequest{
		Id:             secondTokenResponse.Msg.GetToken().GetId(),
		ExpirationTime: timestamppb.New(now.Add(2 * time.Hour)),
	}))
	require.NoError(t, err)

	response, err = client.ListPersonalAccessTokens(ctx, connect.NewRequest(&v1.ListPersonalAccessTokensRequest{}))
	require.NoError(t, err)
	require.Len(t, response.Msg.Tokens, 2, "must retrieve both tokens")

	_, err = client.DeletePersonalAccessToken(ctx, connect.NewRequest(&v1.DeletePersonalAccessTokenRequest{
		Id: secondTokenResponse.Msg.GetToken().GetId(),
	}))
	require.NoError(t, err)
}

func setupTokensService(t *testing.T, expClient experiments.Client) (*protocol.MockAPIInterface, *gorm.DB, v1connect.TokensServiceClient) {
	t.Helper()

	dbConn := dbtest.ConnectForTests(t)

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewTokensService(&FakeServerConnPool{api: serverMock}, expClient, dbConn, signer)

	_, handler := v1connect.NewTokensServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewTokensServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, dbConn, client
}
