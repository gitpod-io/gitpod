// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-connect-proxy. DO NOT EDIT.

package v1connect

import (
	context "context"
	connect_go "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

type ProxyWorkspacesServiceHandler struct {
	client v1.WorkspacesServiceClient
}

func (s *ProxyWorkspacesServiceHandler) ListWorkspaces(ctx context.Context, req *connect_go.Request[v1.ListWorkspacesRequest]) (*connect_go.Response[v1.ListWorkspacesResponse], error) {
	resp, err := s.client.ListWorkspaces(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) GetWorkspace(ctx context.Context, req *connect_go.Request[v1.GetWorkspaceRequest]) (*connect_go.Response[v1.GetWorkspaceResponse], error) {
	resp, err := s.client.GetWorkspace(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) StreamWorkspaceStatus(ctx context.Context, req *connect_go.Request[v1.StreamWorkspaceStatusRequest]) (*connect_go.Response[v1.StreamWorkspaceStatusResponse], error) {
	resp, err := s.client.StreamWorkspaceStatus(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) GetOwnerToken(ctx context.Context, req *connect_go.Request[v1.GetOwnerTokenRequest]) (*connect_go.Response[v1.GetOwnerTokenResponse], error) {
	resp, err := s.client.GetOwnerToken(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) CreateAndStartWorkspace(ctx context.Context, req *connect_go.Request[v1.CreateAndStartWorkspaceRequest]) (*connect_go.Response[v1.CreateAndStartWorkspaceResponse], error) {
	resp, err := s.client.CreateAndStartWorkspace(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) StopWorkspace(ctx context.Context, req *connect_go.Request[v1.StopWorkspaceRequest]) (*connect_go.Response[v1.StopWorkspaceResponse], error) {
	resp, err := s.client.StopWorkspace(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) DeleteWorkspace(ctx context.Context, req *connect_go.Request[v1.DeleteWorkspaceRequest]) (*connect_go.Response[v1.DeleteWorkspaceResponse], error) {
	resp, err := s.client.DeleteWorkspace(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyWorkspacesServiceHandler) UpdatePort(ctx context.Context, req *connect_go.Request[v1.UpdatePortRequest]) (*connect_go.Response[v1.UpdatePortResponse], error) {
	resp, err := s.client.UpdatePort(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}
