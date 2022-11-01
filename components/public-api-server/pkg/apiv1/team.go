// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/relvacode/iso8601"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewTeamsService(pool proxy.ServerConnectionPool) *TeamService {
	return &TeamService{
		connectionPool: pool,
	}
}

var _ v1connect.TeamsServiceHandler = (*TeamService)(nil)

type TeamService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedTeamsServiceHandler
}

func (s *TeamService) CreateTeam(ctx context.Context, req *connect.Request[v1.CreateTeamRequest]) (*connect.Response[v1.CreateTeamResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	if req.Msg.GetName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Name is a required argument when creating a team."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	created, err := conn.CreateTeam(ctx, req.Msg.GetName())
	if err != nil {
		log.WithError(err).Error("Failed to create team.")
		return nil, proxy.ConvertError(err)
	}

	team, err := s.toTeamAPIResponse(ctx, conn, created)
	if err != nil {
		log.WithError(err).Error("Failed to populate team with details.")
		return nil, err
	}

	return connect.NewResponse(&v1.CreateTeamResponse{
		Team: team,
	}), nil
}

func (s *TeamService) GetTeam(ctx context.Context, req *connect.Request[v1.GetTeamRequest]) (*connect.Response[v1.GetTeamResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	if req.Msg.GetTeamId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("team ID is a required argument for retrieving a team."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	team, err := conn.GetTeam(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	response, err := s.toTeamAPIResponse(ctx, conn, team)
	if err != nil {
		return nil, err
	}

	return connect.NewResponse(&v1.GetTeamResponse{
		Team: response,
	}), nil
}

func (s *TeamService) ListTeams(ctx context.Context, req *connect.Request[v1.ListTeamsRequest]) (*connect.Response[v1.ListTeamsResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	teams, err := conn.GetTeams(ctx)
	if err != nil {
		log.WithError(err).Error("Failed to list teams from server.")
		return nil, proxy.ConvertError(err)
	}

	var response []*v1.Team
	for _, t := range teams {
		team, err := s.toTeamAPIResponse(ctx, conn, t)
		if err != nil {
			log.WithError(err).Error("Failed to populate team with details.")
			return nil, err
		}

		response = append(response, team)
	}

	return connect.NewResponse(&v1.ListTeamsResponse{
		Teams: response,
	}), nil
}

func (s *TeamService) JoinTeam(ctx context.Context, req *connect.Request[v1.JoinTeamRequest]) (*connect.Response[v1.JoinTeamResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	if req.Msg.GetInvitationId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invitation id is a required argument to join a team"))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("failed to establish connection to downstream services"))
	}

	team, err := conn.JoinTeam(ctx, req.Msg.GetInvitationId())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	response, err := s.toTeamAPIResponse(ctx, conn, team)
	if err != nil {
		log.WithError(err).Error("Failed to populate team with details.")
		return nil, err
	}

	return connect.NewResponse(&v1.JoinTeamResponse{
		Team: response,
	}), nil
}

func (s *TeamService) ResetTeamInvitation(ctx context.Context, req *connect.Request[v1.ResetTeamInvitationRequest]) (*connect.Response[v1.ResetTeamInvitationResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	if req.Msg.GetTeamId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID is a required argument to reset team invitiation."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("failed to establish connection to downstream services"))
	}

	invite, err := conn.ResetGenericInvite(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to reset team invitation"))
	}

	return connect.NewResponse(&v1.ResetTeamInvitationResponse{
		TeamInvitation: teamInviteToAPIResponse(invite),
	}), nil
}

func (s *TeamService) UpdateTeamMember(ctx context.Context, req *connect.Request[v1.UpdateTeamMemberRequest]) (*connect.Response[v1.UpdateTeamMemberResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	teamID := req.Msg.GetTeamId()
	if teamID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID is a required parameter to update team member."))
	}

	userID := req.Msg.GetTeamMember().GetUserId()
	if userID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("TeamMember.UserID is a required parameter to update team member."))
	}

	var role protocol.TeamMemberRole
	switch req.Msg.GetTeamMember().GetRole() {
	case v1.TeamRole_TEAM_ROLE_MEMBER:
		role = protocol.TeamMember_Member
	case v1.TeamRole_TEAM_ROLE_OWNER:
		role = protocol.TeamMember_Owner
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Unknown TeamMember.Role specified."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("failed to establish connection to downstream services"))
	}

	err = conn.SetTeamMemberRole(ctx, teamID, userID, role)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.UpdateTeamMemberResponse{
		TeamMember: req.Msg.GetTeamMember(),
	}), nil

}

func (s *TeamService) DeleteTeamMember(ctx context.Context, req *connect.Request[v1.DeleteTeamMemberRequest]) (*connect.Response[v1.DeleteTeamMemberResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	teamID := req.Msg.GetTeamId()
	if teamID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID is a required parameter to delete team member."))
	}

	memberID := req.Msg.GetTeamMemberId()
	if memberID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team Member ID is a required parameter to delete team member."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("failed to establish connection to downstream services"))
	}

	err = conn.RemoveTeamMember(ctx, teamID, memberID)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.DeleteTeamMemberResponse{}), nil
}

func (s *TeamService) toTeamAPIResponse(ctx context.Context, conn protocol.APIInterface, team *protocol.Team) (*v1.Team, error) {
	members, err := conn.GetTeamMembers(ctx, team.ID)
	if err != nil {
		log.WithError(err).Error("Failed to get team members.")
		return nil, proxy.ConvertError(err)
	}

	invite, err := conn.GetGenericInvite(ctx, team.ID)
	if err != nil {
		log.WithError(err).Error("Failed to get generic invite.")
		return nil, proxy.ConvertError(err)
	}

	return teamToAPIResponse(team, members, invite), nil
}

func teamToAPIResponse(team *protocol.Team, members []*protocol.TeamMemberInfo, invite *protocol.TeamMembershipInvite) *v1.Team {
	return &v1.Team{
		Id:             team.ID,
		Name:           team.Name,
		Slug:           team.Slug,
		Members:        teamMembersToAPIResponse(members),
		TeamInvitation: teamInviteToAPIResponse(invite),
	}
}

func teamMembersToAPIResponse(members []*protocol.TeamMemberInfo) []*v1.TeamMember {
	var result []*v1.TeamMember

	for _, m := range members {
		result = append(result, &v1.TeamMember{
			UserId:       m.UserId,
			Role:         teamRoleToAPIResponse(m.Role),
			MemberSince:  parseTimeStamp(m.MemberSince),
			AvatarUrl:    m.AvatarUrl,
			FullName:     m.FullName,
			PrimaryEmail: m.PrimaryEmail,
		})
	}

	return result
}

func teamRoleToAPIResponse(role protocol.TeamMemberRole) v1.TeamRole {
	switch role {
	case protocol.TeamMember_Owner:
		return v1.TeamRole_TEAM_ROLE_OWNER
	case protocol.TeamMember_Member:
		return v1.TeamRole_TEAM_ROLE_MEMBER
	default:
		return v1.TeamRole_TEAM_ROLE_UNSPECIFIED
	}
}

func teamInviteToAPIResponse(invite *protocol.TeamMembershipInvite) *v1.TeamInvitation {
	return &v1.TeamInvitation{
		Id: invite.ID,
	}
}

func parseTimeStamp(s string) *timestamppb.Timestamp {
	parsed, err := iso8601.ParseString(s)
	if err != nil {
		return &timestamppb.Timestamp{}
	}

	return timestamppb.New(parsed)
}
