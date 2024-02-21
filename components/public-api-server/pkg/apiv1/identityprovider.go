// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/zitadel/oidc/pkg/oidc"
)

type IDTokenSource interface {
	IDToken(ctx context.Context, org string, audience []string, userInfo oidc.UserInfo) (string, error)
}

func NewIdentityProviderService(serverConnPool proxy.ServerConnectionPool, source IDTokenSource) *IdentityProviderService {
	return &IdentityProviderService{
		connectionPool: serverConnPool,
		idTokenSource:  source,
	}
}

type IdentityProviderService struct {
	connectionPool proxy.ServerConnectionPool
	idTokenSource  IDTokenSource

	v1connect.UnimplementedWorkspacesServiceHandler
}

var _ v1connect.IdentityProviderServiceHandler = ((*IdentityProviderService)(nil))

// GetIDToken implements v1connect.IDPServiceHandler
func (srv *IdentityProviderService) GetIDToken(ctx context.Context, req *connect.Request[v1.GetIDTokenRequest]) (*connect.Response[v1.GetIDTokenResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	if len(req.Msg.Audience) < 1 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Must have at least one audience entry"))
	}

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
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get calling user.")
		return nil, proxy.ConvertError(err)
	}

	var email string
	for _, id := range user.Identities {
		if id == nil || id.Deleted || id.PrimaryEmail == "" {
			continue
		}
		email = id.PrimaryEmail
		break
	}

	if workspace.Workspace == nil {
		log.Extract(ctx).WithError(err).Error("Server did not return a workspace.")
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("workspace not found"))
	}

	subject := workspace.Workspace.ContextURL
	userInfo := oidc.NewUserInfo()
	userInfo.SetName(user.Name)
	userInfo.SetSubject(subject)
	userInfo.AppendClaims("user_id", user.ID)
	userInfo.AppendClaims("org_id", workspace.Workspace.OrganizationId)

	if email != "" {
		userInfo.SetEmail(email, user.OrganizationId != "")
	}

	token, err := srv.idTokenSource.IDToken(ctx, "gitpod", req.Msg.Audience, userInfo)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to produce ID token.")
		return nil, proxy.ConvertError(err)
	}
	return &connect.Response[v1.GetIDTokenResponse]{
		Msg: &v1.GetIDTokenResponse{
			Token: token,
		},
	}, nil
}
