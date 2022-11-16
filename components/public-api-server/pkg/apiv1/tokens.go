// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func NewTokensService(connPool proxy.ServerConnectionPool, expClient experiments.Client, dbConn *gorm.DB) *TokensService {
	return &TokensService{
		connectionPool: connPool,
		expClient:      expClient,
		dbConn:         dbConn,
	}
}

type TokensService struct {
	connectionPool proxy.ServerConnectionPool
	expClient      experiments.Client
	dbConn         *gorm.DB

	v1connect.UnimplementedTokensServiceHandler
}

func (s *TokensService) CreatePersonalAccessToken(ctx context.Context, req *connect.Request[v1.CreatePersonalAccessTokenRequest]) (*connect.Response[v1.CreatePersonalAccessTokenResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.CreatePersonalAccessToken is not implemented"))
}

func (s *TokensService) GetPersonalAccessToken(ctx context.Context, req *connect.Request[v1.GetPersonalAccessTokenRequest]) (*connect.Response[v1.GetPersonalAccessTokenResponse], error) {
	tokenID, err := validateTokenID(req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	log.Infof("Handling GetPersonalAccessToken request for Token ID '%s'", tokenID.String())
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.GetPersonalAccessToken is not implemented"))
}

func (s *TokensService) ListPersonalAccessTokens(ctx context.Context, req *connect.Request[v1.ListPersonalAccessTokensRequest]) (*connect.Response[v1.ListPersonalAccessTokensResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.ListPersonalAccessTokens is not implemented"))
}

func (s *TokensService) RegeneratePersonalAccessToken(ctx context.Context, req *connect.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect.Response[v1.RegeneratePersonalAccessTokenResponse], error) {
	tokenID, err := validateTokenID(req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	log.Infof("Handling RegeneratePersonalAccessToken request for Token ID '%s'", tokenID.String())
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.RegeneratePersonalAccessToken is not implemented"))
}

func (s *TokensService) UpdatePersonalAccessToken(ctx context.Context, req *connect.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect.Response[v1.UpdatePersonalAccessTokenResponse], error) {
	tokenID, err := validateTokenID(req.Msg.GetToken().GetId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	log.Infof("Handling UpdatePersonalAccessToken request for Token ID '%s'", tokenID.String())
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.UpdatePersonalAccessToken is not implemented"))
}

func (s *TokensService) DeletePersonalAccessToken(ctx context.Context, req *connect.Request[v1.DeletePersonalAccessTokenRequest]) (*connect.Response[v1.DeletePersonalAccessTokenResponse], error) {
	tokenID, err := validateTokenID(req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	log.Infof("Handling DeletePersonalAccessToken request for Token ID '%s'", tokenID.String())
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.DeletePersonalAccessToken is not implemented"))
}

func (s *TokensService) getUser(ctx context.Context, conn protocol.APIInterface) (*protocol.User, error) {
	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	if !experiments.IsPersonalAccessTokensEnabled(ctx, s.expClient, experiments.Attributes{UserID: user.ID}) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("This feature is currently in beta. If you would like to be part of the beta, please contact us."))
	}

	return user, nil
}

func getConnection(ctx context.Context, pool proxy.ServerConnectionPool) (protocol.APIInterface, error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := pool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to establish connection to downstream services. If this issue persists, please contact Gitpod Support."))
	}

	return conn, nil
}

func validateTokenID(id string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Token ID is a required argument."))
	}

	tokenID, err := uuid.Parse(trimmed)
	if err != nil {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Token ID must be a valid UUID"))
	}

	return tokenID, nil
}
