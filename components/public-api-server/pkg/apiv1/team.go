// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"sync"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
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
	if req.Msg.GetName() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Name is a required argument when creating a team."))
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	created, err := conn.CreateTeam(ctx, req.Msg.GetName())
	if err != nil {
		log.Extract(ctx).Error("Failed to create team.")
		return nil, proxy.ConvertError(err)
	}

	team, err := s.toTeamAPIResponse(ctx, conn, created)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to populate team with details.")
		return nil, err
	}

	return connect.NewResponse(&v1.CreateTeamResponse{
		Team: team,
	}), nil
}

func (s *TeamService) GetTeam(ctx context.Context, req *connect.Request[v1.GetTeamRequest]) (*connect.Response[v1.GetTeamResponse], error) {
	teamID, err := validateTeamID(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	team, err := conn.GetTeam(ctx, teamID.String())
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
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	teams, err := conn.GetTeams(ctx)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to list teams from server.")
		return nil, proxy.ConvertError(err)
	}

	type result struct {
		team *v1.Team
		err  error
	}

	wg := sync.WaitGroup{}
	resultsChan := make(chan result, len(teams))
	for _, t := range teams {
		wg.Add(1)
		go func(t *protocol.Team) {
			team, err := s.toTeamAPIResponse(ctx, conn, t)
			resultsChan <- result{
				team: team,
				err:  err,
			}
			defer wg.Done()
		}(t)
	}

	// Block until we've fetched all teams
	wg.Wait()
	close(resultsChan)

	// We want to maintain the order of results that we got from server
	// So we convert our concurrent results to a map, so we can index into it
	resultMap := map[string]*v1.Team{}
	for res := range resultsChan {
		if res.err != nil {
			log.Extract(ctx).WithError(err).Error("Failed to populate team with details.")
			return nil, res.err
		}

		resultMap[res.team.GetId()] = res.team
	}

	// Map the original order of teams against the populated results
	var response []*v1.Team
	for _, t := range teams {
		response = append(response, resultMap[t.ID])
	}

	return connect.NewResponse(&v1.ListTeamsResponse{
		Teams: response,
	}), nil
}

func (s *TeamService) DeleteTeam(ctx context.Context, req *connect.Request[v1.DeleteTeamRequest]) (*connect.Response[v1.DeleteTeamResponse], error) {
	teamID, err := validateTeamID(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	err = conn.DeleteTeam(ctx, teamID.String())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.DeleteTeamResponse{}), nil
}

func (s *TeamService) GetTeamInvitation(ctx context.Context, req *connect.Request[v1.GetTeamInvitationRequest]) (*connect.Response[v1.GetTeamInvitationResponse], error) {
	teamID, err := validateTeamID(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	invite, err := conn.GetGenericInvite(ctx, teamID.String())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.GetTeamInvitationResponse{
		TeamInvitation: teamInviteToAPIResponse(invite),
	}), nil
}

func (s *TeamService) JoinTeam(ctx context.Context, req *connect.Request[v1.JoinTeamRequest]) (*connect.Response[v1.JoinTeamResponse], error) {
	if req.Msg.GetInvitationId() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invitation id is a required argument to join a team"))
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	team, err := conn.JoinTeam(ctx, req.Msg.GetInvitationId())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	response, err := s.toTeamAPIResponse(ctx, conn, team)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to populate team with details.")
		return nil, err
	}

	return connect.NewResponse(&v1.JoinTeamResponse{
		Team: response,
	}), nil
}

func (s *TeamService) ResetTeamInvitation(ctx context.Context, req *connect.Request[v1.ResetTeamInvitationRequest]) (*connect.Response[v1.ResetTeamInvitationResponse], error) {
	teamID, err := validateTeamID(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	invite, err := conn.ResetGenericInvite(ctx, teamID.String())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to reset team invitation"))
	}

	return connect.NewResponse(&v1.ResetTeamInvitationResponse{
		TeamInvitation: teamInviteToAPIResponse(invite),
	}), nil
}

func (s *TeamService) ListTeamMembers(ctx context.Context, req *connect.Request[v1.ListTeamMembersRequest]) (*connect.Response[v1.ListTeamMembersResponse], error) {
	teamID, err := validateTeamID(ctx, req.Msg.GetTeamId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	members, err := conn.GetTeamMembers(ctx, teamID.String())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.ListTeamMembersResponse{
		Members: teamMembersToAPIResponse(members),
	}), nil
}

func (s *TeamService) UpdateTeamMember(ctx context.Context, req *connect.Request[v1.UpdateTeamMemberRequest]) (*connect.Response[v1.UpdateTeamMemberResponse], error) {
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

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
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
	teamID := req.Msg.GetTeamId()
	if teamID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID is a required parameter to delete team member."))
	}

	memberID := req.Msg.GetTeamMemberId()
	if memberID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team Member ID is a required parameter to delete team member."))
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	err = conn.RemoveTeamMember(ctx, teamID, memberID)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.DeleteTeamMemberResponse{}), nil
}

func (s *TeamService) toTeamAPIResponse(ctx context.Context, conn protocol.APIInterface, team *protocol.Team) (*v1.Team, error) {
	return &v1.Team{
		Id:   team.ID,
		Name: team.Name,
	}, nil
}

func teamMembersToAPIResponse(members []*protocol.TeamMemberInfo) []*v1.TeamMember {
	var result []*v1.TeamMember

	for _, m := range members {
		result = append(result, &v1.TeamMember{
			UserId:              m.UserId,
			Role:                teamRoleToAPIResponse(m.Role),
			MemberSince:         parseGitpodTimeStampOrDefault(m.MemberSince),
			AvatarUrl:           m.AvatarUrl,
			FullName:            m.FullName,
			PrimaryEmail:        m.PrimaryEmail,
			OwnedByOrganization: m.OwnedByOrganization,
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
	if invite == nil {
		return nil
	}
	return &v1.TeamInvitation{
		Id: invite.ID,
	}
}
