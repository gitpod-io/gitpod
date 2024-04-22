// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-proxy-gen. DO NOT EDIT.

package v1connect

import (
	context "context"
	connect_go "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
)

var _ SSHServiceHandler = (*ProxySSHServiceHandler)(nil)

type ProxySSHServiceHandler struct {
	Client v1.SSHServiceClient
	UnimplementedSSHServiceHandler
}

func (s *ProxySSHServiceHandler) ListSSHPublicKeys(ctx context.Context, req *connect_go.Request[v1.ListSSHPublicKeysRequest]) (*connect_go.Response[v1.ListSSHPublicKeysResponse], error) {
	resp, err := s.Client.ListSSHPublicKeys(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxySSHServiceHandler) CreateSSHPublicKey(ctx context.Context, req *connect_go.Request[v1.CreateSSHPublicKeyRequest]) (*connect_go.Response[v1.CreateSSHPublicKeyResponse], error) {
	resp, err := s.Client.CreateSSHPublicKey(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxySSHServiceHandler) DeleteSSHPublicKey(ctx context.Context, req *connect_go.Request[v1.DeleteSSHPublicKeyRequest]) (*connect_go.Response[v1.DeleteSSHPublicKeyResponse], error) {
	resp, err := s.Client.DeleteSSHPublicKey(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}
