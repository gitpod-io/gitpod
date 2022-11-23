// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"
	"strings"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

func NewTokensService(connPool proxy.ServerConnectionPool, expClient experiments.Client, dbConn *gorm.DB, signer auth.Signer) *TokensService {
	return &TokensService{
		connectionPool: connPool,
		expClient:      expClient,
		dbConn:         dbConn,
		signer:         signer,
	}
}

type TokensService struct {
	connectionPool proxy.ServerConnectionPool
	expClient      experiments.Client
	dbConn         *gorm.DB
	signer         auth.Signer

	v1connect.UnimplementedTokensServiceHandler
}

func (s *TokensService) CreatePersonalAccessToken(ctx context.Context, req *connect.Request[v1.CreatePersonalAccessTokenRequest]) (*connect.Response[v1.CreatePersonalAccessTokenResponse], error) {
	tokenReq := req.Msg.GetToken()

	name := strings.TrimSpace(tokenReq.GetName())
	if name == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("Token Name is a required parameter."))
	}

	description := strings.TrimSpace(tokenReq.GetDescription())

	expiry := tokenReq.GetExpirationTime()
	if !expiry.IsValid() {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("Received invalid Expiration Time, it is a required parameter."))
	}

	// TODO: Parse and validate scopes before storing
	// Until we do that, we store empty scopes.
	var scopes []string

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	pat, err := auth.GeneratePersonalAccessToken(s.signer)
	if err != nil {
		log.WithError(err).Errorf("Failed to generate personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to generate personal access token."))
	}

	hash, err := pat.ValueHash()
	if err != nil {
		log.WithError(err).Errorf("Failed to generate personal access token value hash for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to compute personal access token hash."))
	}

	token, err := db.CreatePersonalAccessToken(ctx, s.dbConn, db.PersonalAccessToken{
		ID:             uuid.New(),
		UserID:         userID,
		Hash:           hash,
		Name:           name,
		Description:    description,
		Scopes:         scopes,
		ExpirationTime: expiry.AsTime().UTC(),
	})
	if err != nil {
		log.WithError(err).Errorf("Failed to store personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to store personal access token."))
	}

	return connect.NewResponse(&v1.CreatePersonalAccessTokenResponse{
		Token: personalAccessTokenToAPI(token, pat.String()),
	}), nil
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

	_, userId, err := s.getUser(ctx, conn)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, err
	}

	log.Infof("Handling GetPersonalAccessToken request for Token ID '%s'", tokenID.String())

	token, err := db.GetPersonalAccessTokenForUser(ctx, s.dbConn, tokenID, userId)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.GetPersonalAccessTokenResponse{Token: personalAccessTokenToAPI(token, "")}), nil
}

func (s *TokensService) ListPersonalAccessTokens(ctx context.Context, req *connect.Request[v1.ListPersonalAccessTokensRequest]) (*connect.Response[v1.ListPersonalAccessTokensResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	result, err := db.ListPersonalAccessTokensForUser(ctx, s.dbConn, userID, paginationToDB(req.Msg.GetPagination()))
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to list Personal Access Tokens for User %s", userID.String()))
	}

	return connect.NewResponse(&v1.ListPersonalAccessTokensResponse{
		Tokens:       personalAccessTokensToAPI(result.Results),
		TotalResults: result.Total,
	}), nil
}

func (s *TokensService) RegeneratePersonalAccessToken(ctx context.Context, req *connect.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect.Response[v1.RegeneratePersonalAccessTokenResponse], error) {
	tokenID, err := validateTokenID(req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	expiry := req.Msg.GetExpirationTime()
	if !expiry.IsValid() {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("Received invalid Expiration Time, it is a required parameter."))
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}
	pat, err := auth.GeneratePersonalAccessToken(s.signer)
	if err != nil {
		log.WithError(err).Errorf("Failed to regenerate personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to regenerate personal access token."))
	}

	hash, err := pat.ValueHash()
	if err != nil {
		log.WithError(err).Errorf("Failed to regenerate personal access token value hash for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to compute personal access token hash."))
	}

	token, err := db.UpdatePersonalAccessTokenHash(ctx, s.dbConn, tokenID, userID, hash, expiry.AsTime().UTC())
	if err != nil {
		log.WithError(err).Errorf("Failed to store personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to store personal access token."))
	}

	return connect.NewResponse(&v1.RegeneratePersonalAccessTokenResponse{
		Token: personalAccessTokenToAPI(token, pat.String()),
	}), nil
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

	_, _, err = s.getUser(ctx, conn)
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

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	_, err = db.DeletePersonalAccessTokenForUser(ctx, s.dbConn, tokenID, userID)
	if err != nil {
		log.WithError(err).Errorf("failed to delete personal access token (ID: %s) for user %s", tokenID.String(), userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to delete personal access token."))
	}

	return connect.NewResponse(&v1.DeletePersonalAccessTokenResponse{}), nil
}

func (s *TokensService) getUser(ctx context.Context, conn protocol.APIInterface) (*protocol.User, uuid.UUID, error) {
	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, uuid.Nil, proxy.ConvertError(err)
	}

	if !s.isFeatureEnabled(ctx, conn, user) {
		return nil, uuid.Nil, connect.NewError(connect.CodePermissionDenied, errors.New("This feature is currently in beta. If you would like to be part of the beta, please contact us."))
	}

	userID, err := uuid.Parse(user.ID)
	if err != nil {
		return nil, uuid.Nil, connect.NewError(connect.CodeInternal, errors.New("Failed to parse user ID as UUID. Please contact support."))
	}

	return user, userID, nil
}

func (s *TokensService) isFeatureEnabled(ctx context.Context, conn protocol.APIInterface, user *protocol.User) bool {
	if user == nil {
		return false
	}

	if experiments.IsPersonalAccessTokensEnabled(ctx, s.expClient, experiments.Attributes{UserID: user.ID}) {
		return true
	}

	teams, err := conn.GetTeams(ctx)
	if err != nil {
		log.WithError(err).Warnf("Failed to retreive Teams for user %s, personal access token feature flag will not evaluate team membership.", user.ID)
		teams = nil
	}
	for _, team := range teams {
		if experiments.IsPersonalAccessTokensEnabled(ctx, s.expClient, experiments.Attributes{TeamID: team.ID}) {
			return true
		}
	}

	return false
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

func personalAccessTokensToAPI(ts []db.PersonalAccessToken) []*v1.PersonalAccessToken {
	var tokens []*v1.PersonalAccessToken
	for _, t := range ts {
		tokens = append(tokens, personalAccessTokenToAPI(t, ""))
	}

	return tokens
}

func personalAccessTokenToAPI(t db.PersonalAccessToken, value string) *v1.PersonalAccessToken {
	return &v1.PersonalAccessToken{
		Id: t.ID.String(),
		// value is only present when the token is first created, or regenerated. It's empty for all subsequent requests.
		Value:          value,
		Name:           t.Name,
		Description:    t.Description,
		Scopes:         t.Scopes,
		ExpirationTime: timestamppb.New(t.ExpirationTime),
		CreatedAt:      timestamppb.New(t.CreatedAt),
	}
}
