// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/experimental/v1"
	"github.com/gitpod-io/gitpod/public-api/experimental/v1/v1connect"
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
	token := auth.TokenFromContext(ctx)

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

func (s *TeamService) ListTeams(ctx context.Context, req *connect.Request[v1.ListTeamsRequest]) (*connect.Response[v1.ListTeamsResponse], error) {
	token := auth.TokenFromContext(ctx)

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

	return &v1.Team{
		Id:      team.ID,
		Name:    team.Name,
		Slug:    team.Slug,
		Members: teamMembersToAPIResponse(members),
		TeamInvitation: &v1.TeamInvitation{
			Id: invite.ID,
		},
	}, nil
}

func teamMembersToAPIResponse(members []*protocol.TeamMemberInfo) []*v1.TeamMember {
	var result []*v1.TeamMember

	for _, m := range members {
		result = append(result, &v1.TeamMember{
			UserId:      m.UserId,
			Role:        teamRoleToAPIResponse(m.Role),
			MemberSince: parseTimeStamp(m.MemberSince),
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

func parseTimeStamp(s string) *timestamppb.Timestamp {
	parsed, err := iso8601.ParseString(s)
	if err != nil {
		return &timestamppb.Timestamp{}
	}

	return timestamppb.New(parsed)
}
