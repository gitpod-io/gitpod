// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
)

func NewTokensService(connPool proxy.ServerConnectionPool, expClient experiments.Client) *TokensService {
	return &TokensService{
		connectionPool: connPool,
		expClient:      expClient,
	}
}

type TokensService struct {
	connectionPool proxy.ServerConnectionPool

	expClient experiments.Client

	v1connect.UnimplementedTokensServiceHandler
}

func (s *TokensService) CreatePersonalAccessToken(ctx context.Context, req *connect.Request[v1.CreatePersonalAccessTokenRequest]) (*connect.Response[v1.CreatePersonalAccessTokenResponse], error) {

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	isEnabled := experiments.IsPersonalAccessTokensEnabled(ctx, s.expClient, experiments.Attributes{UserID: user.ID})

	if !isEnabled {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("This feature is currently in beta. If you would like to be part of the beta, please contact us."))
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.CreatePersonalAccessToken is not implemented"))
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
