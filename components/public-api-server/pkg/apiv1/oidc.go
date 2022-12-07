// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/google/uuid"
)

func NewOIDCService(connPool proxy.ServerConnectionPool, expClient experiments.Client) *OIDCService {
	return &OIDCService{
		connectionPool: connPool,
		expClient:      expClient,
	}
}

type OIDCService struct {
	expClient      experiments.Client
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedOIDCServiceHandler
}

func (s *OIDCService) CreateClientConfig(ctx context.Context, req *connect.Request[v1.CreateClientConfigRequest]) (*connect.Response[v1.CreateClientConfigResponse], error) {
	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.CreateClientConfig is not implemented"))
}

func (s *OIDCService) GetClientConfig(ctx context.Context, req *connect.Request[v1.GetClientConfigRequest]) (*connect.Response[v1.GetClientConfigResponse], error) {
	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.GetClientConfig is not implemented"))
}

func (s *OIDCService) ListClientConfigs(ctx context.Context, req *connect.Request[v1.ListClientConfigsRequest]) (*connect.Response[v1.ListClientConfigsResponse], error) {
	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.ListClientConfigs is not implemented"))
}

func (s *OIDCService) UpdateClientConfig(ctx context.Context, req *connect.Request[v1.UpdateClientConfigRequest]) (*connect.Response[v1.UpdateClientConfigResponse], error) {
	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.UpdateClientConfig is not implemented"))
}

func (s *OIDCService) DeleteClientConfig(ctx context.Context, req *connect.Request[v1.DeleteClientConfigRequest]) (*connect.Response[v1.DeleteClientConfigResponse], error) {
	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.DeleteClientConfig is not implemented"))
}

func (s *OIDCService) getConnection(ctx context.Context) (protocol.APIInterface, error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to establish connection to downstream services. If this issue persists, please contact Gitpod Support."))
	}

	return conn, nil
}

func (s *OIDCService) getUser(ctx context.Context, conn protocol.APIInterface) (*protocol.User, uuid.UUID, error) {
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

func (s *OIDCService) isFeatureEnabled(ctx context.Context, conn protocol.APIInterface, user *protocol.User) bool {
	if user == nil {
		return false
	}

	if experiments.IsOIDCServiceEnabled(ctx, s.expClient, experiments.Attributes{UserID: user.ID}) {
		return true
	}

	teams, err := conn.GetTeams(ctx)
	if err != nil {
		log.WithError(err).Warnf("Failed to retreive Teams for user %s, personal access token feature flag will not evaluate team membership.", user.ID)
		teams = nil
	}
	for _, team := range teams {
		if experiments.IsOIDCServiceEnabled(ctx, s.expClient, experiments.Attributes{TeamID: team.ID}) {
			return true
		}
	}

	return false
}
