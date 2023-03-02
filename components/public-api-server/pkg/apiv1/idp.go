// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"github.com/zitadel/oidc/pkg/oidc"
)

type IDTokenSource interface {
	IDToken(ctx context.Context, org string, audience []string, subject string, userInfo oidc.UserInfo) (string, error)
}

func NewIDPService(serverConnPool proxy.ServerConnectionPool, source IDTokenSource) *IDPService {
	return &IDPService{
		connectionPool: serverConnPool,
		idTokenSource:  source,
	}
}

type IDPService struct {
	connectionPool proxy.ServerConnectionPool
	idTokenSource  IDTokenSource

	v1connect.UnimplementedWorkspacesServiceHandler
}

var _ v1connect.IDPServiceHandler = ((*IDPService)(nil))

// GetIDToken implements v1connect.IDPServiceHandler
func (srv *IDPService) GetIDToken(ctx context.Context, req *connect.Request[v1.GetIDTokenRequest]) (*connect.Response[v1.GetIDTokenResponse], error) {
	workspaceID, err := validateWorkspaceID(req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	if len(req.Msg.Audience) < 1 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("must have at least one audience entry"))
	}

	logger := ctxlogrus.Extract(ctx).WithField("workspace_id", workspaceID)

	conn, err := getConnection(ctx, srv.connectionPool)
	if err != nil {
		return nil, err
	}

	// We use GetIDToken as standin for the IDP operation authorisation until we have a better way of handling this
	err = conn.GetIDToken(ctx)
	if err != nil {
		return nil, err
	}

	workspace, err := conn.GetWorkspace(ctx, workspaceID)
	if err != nil {
		logger.WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		logger.WithError(err).Error("Failed to get calling user.")
		return nil, proxy.ConvertError(err)
	}

	subject := workspace.Workspace.ContextURL
	userInfo := oidc.NewUserInfo()
	userInfo.SetName(user.Name)
	userInfo.SetSubject(subject)

	token, err := srv.idTokenSource.IDToken(ctx, "gitpod", req.Msg.Audience, subject, userInfo)
	if err != nil {
		logger.WithError(err).Error("Failed to produce ID token.")
		return nil, proxy.ConvertError(err)
	}
	return &connect.Response[v1.GetIDTokenResponse]{
		Msg: &v1.GetIDTokenResponse{
			Token: token,
		},
	}, nil
}
