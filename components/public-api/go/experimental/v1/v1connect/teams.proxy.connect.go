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

var _ TeamsServiceHandler = (*ProxyTeamsServiceHandler)(nil)

type ProxyTeamsServiceHandler struct {
	Client v1.TeamsServiceClient
	UnimplementedTeamsServiceHandler
}

func (s *ProxyTeamsServiceHandler) CreateTeam(ctx context.Context, req *connect_go.Request[v1.CreateTeamRequest]) (*connect_go.Response[v1.CreateTeamResponse], error) {
	resp, err := s.Client.CreateTeam(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) GetTeam(ctx context.Context, req *connect_go.Request[v1.GetTeamRequest]) (*connect_go.Response[v1.GetTeamResponse], error) {
	resp, err := s.Client.GetTeam(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) ListTeams(ctx context.Context, req *connect_go.Request[v1.ListTeamsRequest]) (*connect_go.Response[v1.ListTeamsResponse], error) {
	resp, err := s.Client.ListTeams(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) DeleteTeam(ctx context.Context, req *connect_go.Request[v1.DeleteTeamRequest]) (*connect_go.Response[v1.DeleteTeamResponse], error) {
	resp, err := s.Client.DeleteTeam(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) JoinTeam(ctx context.Context, req *connect_go.Request[v1.JoinTeamRequest]) (*connect_go.Response[v1.JoinTeamResponse], error) {
	resp, err := s.Client.JoinTeam(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) ResetTeamInvitation(ctx context.Context, req *connect_go.Request[v1.ResetTeamInvitationRequest]) (*connect_go.Response[v1.ResetTeamInvitationResponse], error) {
	resp, err := s.Client.ResetTeamInvitation(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) UpdateTeamMember(ctx context.Context, req *connect_go.Request[v1.UpdateTeamMemberRequest]) (*connect_go.Response[v1.UpdateTeamMemberResponse], error) {
	resp, err := s.Client.UpdateTeamMember(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}

func (s *ProxyTeamsServiceHandler) DeleteTeamMember(ctx context.Context, req *connect_go.Request[v1.DeleteTeamMemberRequest]) (*connect_go.Response[v1.DeleteTeamMemberResponse], error) {
	resp, err := s.Client.DeleteTeamMember(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil
}
