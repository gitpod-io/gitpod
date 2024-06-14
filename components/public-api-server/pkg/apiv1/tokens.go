// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
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
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
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

	name, err := validatePersonalAccessTokenName(tokenReq.GetName())
	if err != nil {
		return nil, err
	}

	expiry := tokenReq.GetExpirationTime()
	if !expiry.IsValid() {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("Received invalid Expiration Time, it is a required parameter."))
	}

	scopes, err := validateScopes(tokenReq.GetScopes())
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

	pat, err := auth.GeneratePersonalAccessToken(s.signer)
	if err != nil {
		log.Extract(ctx).WithError(err).Errorf("Failed to generate personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to generate personal access token."))
	}

	token, err := db.CreatePersonalAccessToken(ctx, s.dbConn, db.PersonalAccessToken{
		ID:             uuid.New(),
		UserID:         userID,
		Hash:           pat.ValueHash(),
		Name:           name,
		Scopes:         scopes,
		ExpirationTime: expiry.AsTime().UTC(),
	})
	if err != nil {
		log.Extract(ctx).WithError(err).Errorf("Failed to store personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to store personal access token."))
	}

	return connect.NewResponse(&v1.CreatePersonalAccessTokenResponse{
		Token: personalAccessTokenToAPI(token, pat.String()),
	}), nil
}

func (s *TokensService) GetPersonalAccessToken(ctx context.Context, req *connect.Request[v1.GetPersonalAccessTokenRequest]) (*connect.Response[v1.GetPersonalAccessTokenResponse], error) {
	tokenID, err := validatePersonalAccessTokenID(ctx, req.Msg.GetId())
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

	token, err := db.GetPersonalAccessTokenForUser(ctx, s.dbConn, tokenID, userID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("Personal Access Token with ID %s for User %s does not exist", tokenID.String(), userID.String()))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to get Personal Access Token with ID %s", tokenID.String()))
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
	tokenID, err := validatePersonalAccessTokenID(ctx, req.Msg.GetId())
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
		log.Extract(ctx).WithError(err).Errorf("Failed to regenerate personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to regenerate personal access token."))
	}

	hash := pat.ValueHash()
	token, err := db.UpdatePersonalAccessTokenHash(ctx, s.dbConn, tokenID, userID, hash, expiry.AsTime().UTC())
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("Personal Access Token with ID %s for User %s does not exist", tokenID.String(), userID.String()))
		}

		log.Extract(ctx).WithError(err).Errorf("Failed to store personal access token for user %s", userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to store personal access token."))
	}

	return connect.NewResponse(&v1.RegeneratePersonalAccessTokenResponse{
		Token: personalAccessTokenToAPI(token, pat.String()),
	}), nil
}

func (s *TokensService) UpdatePersonalAccessToken(ctx context.Context, req *connect.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect.Response[v1.UpdatePersonalAccessTokenResponse], error) {
	const (
		nameField   = "name"
		scopesField = "scopes"
	)
	var (
		updatableMask = fieldmaskpb.FieldMask{Paths: []string{nameField, scopesField}}
	)

	tokenReq := req.Msg.GetToken()

	tokenID, err := validatePersonalAccessTokenID(ctx, tokenReq.GetId())
	if err != nil {
		return nil, err
	}

	mask, err := validateFieldMask(req.Msg.GetUpdateMask(), tokenReq)
	if err != nil {
		return nil, err
	}

	// If no mask fields are specified, we treat the request as updating all updatable fields
	if len(mask.GetPaths()) == 0 {
		mask = &updatableMask
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	toUpdate := fieldmaskpb.Intersect(mask, &updatableMask)
	updateOpts := db.UpdatePersonalAccessTokenOpts{
		TokenID: tokenID,
		UserID:  userID,
	}

	for _, path := range toUpdate.GetPaths() {
		switch path {
		case nameField:
			name, err := validatePersonalAccessTokenName(tokenReq.GetName())
			if err != nil {
				return nil, err
			}

			updateOpts.Name = &name
		case scopesField:
			scopes, err := validateScopes(tokenReq.GetScopes())
			if err != nil {
				return nil, err
			}
			dbScopes := db.Scopes(scopes)
			updateOpts.Scopes = &dbScopes
		}
	}

	token, err := db.UpdatePersonalAccessTokenForUser(ctx, s.dbConn, updateOpts)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("Personal Access Token with ID %s for User %s does not exist", tokenID.String(), userID.String()))
		}

		log.Extract(ctx).WithError(err).Error("Failed to update PAT for user")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to update token (ID %s) for user (ID %s).", tokenID.String(), userID.String()))
	}

	return connect.NewResponse(&v1.UpdatePersonalAccessTokenResponse{
		Token: personalAccessTokenToAPI(token, ""),
	}), nil
}

func (s *TokensService) DeletePersonalAccessToken(ctx context.Context, req *connect.Request[v1.DeletePersonalAccessTokenRequest]) (*connect.Response[v1.DeletePersonalAccessTokenResponse], error) {
	tokenID, err := validatePersonalAccessTokenID(ctx, req.Msg.GetId())
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
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("Personal Access Token with ID %s for User %s does not exist", tokenID.String(), userID.String()))
		}

		log.Extract(ctx).WithError(err).Errorf("failed to delete personal access token (ID: %s) for user %s", tokenID.String(), userID.String())
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to delete personal access token."))
	}

	return connect.NewResponse(&v1.DeletePersonalAccessTokenResponse{}), nil
}

func (s *TokensService) getUser(ctx context.Context, conn protocol.APIInterface) (*protocol.User, uuid.UUID, error) {
	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, uuid.Nil, proxy.ConvertError(err)
	}

	log.AddFields(ctx, log.UserID(user.ID))

	userID, err := uuid.Parse(user.ID)
	if err != nil {
		return nil, uuid.Nil, connect.NewError(connect.CodeInternal, errors.New("Failed to parse user ID as UUID. Please contact support."))
	}

	return user, userID, nil
}

func getConnection(ctx context.Context, pool proxy.ServerConnectionPool) (protocol.APIInterface, error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := pool.Get(ctx, token)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to establish connection to downstream services. If this issue persists, please contact Gitpod Support."))
	}

	return conn, nil
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
		Scopes:         t.Scopes,
		ExpirationTime: timestamppb.New(t.ExpirationTime),
		CreatedAt:      timestamppb.New(t.CreatedAt),
	}
}

var (
	// alpha-numeric characters, dashes, underscore, spaces, between 3 and 63 chars
	personalAccessTokenNameRegex = regexp.MustCompile(`^[a-zA-Z0-9-_ ]{3,63}$`)
)

func validatePersonalAccessTokenName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Token Name is a required parameter, but got empty."))
	}

	if !personalAccessTokenNameRegex.MatchString(trimmed) {
		return "", connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Token Name is required to match regexp %s.", personalAccessTokenNameRegex.String()))
	}

	return trimmed, nil
}

const (
	allFunctionsScope    = "function:*"
	defaultResourceScope = "resource:default"
)

func validateScopes(scopes []string) ([]string, error) {
	// Currently we do not have support for fine grained permissions, and therefore do not support fine-grained scopes.
	// Therefore, for now we operate in one of the following modes:
	// * Token has no scopes - represented as the empty list of scopes
	// * Token explicitly has access to everything the user has access to, represented as ["function:*", "resource:default"]
	if len(scopes) == 0 {
		return nil, nil
	}

	sort.Strings(scopes)
	allScopesSorted := []string{allFunctionsScope, defaultResourceScope}

	if cmp.Equal(scopes, allScopesSorted) {
		return scopes, nil
	}

	return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Tokens can currently only have no scopes (empty), or all scopes represented as [%s, %s]", allFunctionsScope, defaultResourceScope))
}
