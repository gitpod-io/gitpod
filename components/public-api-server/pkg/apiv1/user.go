// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
)

func NewUserService(pool proxy.ServerConnectionPool) *UserService {
	return &UserService{
		connectionPool: pool,
	}
}

var _ v1connect.UserServiceHandler = (*UserService)(nil)

type UserService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedUserServiceHandler
}

func (s *UserService) GetAuthenticatedUser(ctx context.Context, req *connect.Request[v1.GetAuthenticatedUserRequest]) (*connect.Response[v1.GetAuthenticatedUserResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	response := userToAPIResponse(user)

	return connect.NewResponse(&v1.GetAuthenticatedUserResponse{
		User: response,
	}), nil
}

func (s *UserService) ListSSHKeys(ctx context.Context, req *connect.Request[v1.ListSSHKeysRequest]) (*connect.Response[v1.ListSSHKeysResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	sshKeys, err := conn.GetSSHPublicKeys(ctx)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	var response []*v1.SSHKey
	for _, k := range sshKeys {
		response = append(response, sshKeyToAPIResponse(k))
	}

	return connect.NewResponse(&v1.ListSSHKeysResponse{
		Keys: response,
	}), nil
}

func userToAPIResponse(user *protocol.User) *v1.User {
	name := user.Name
	if name == "" {
		name = user.FullName
	}

	return &v1.User{
		Id:        user.ID,
		Name:      name,
		AvatarUrl: user.AvatarURL,
		CreatedAt: parseTimeStamp(user.CreationDate),
	}
}

func sshKeyToAPIResponse(key *protocol.UserSSHPublicKeyValue) *v1.SSHKey {
	return &v1.SSHKey{
		Id:        key.ID,
		Name:      key.Name,
		Key:       key.Key,
		CreatedAt: parseTimeStamp(key.CreationTime),
	}
}
