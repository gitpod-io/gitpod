// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/relvacode/iso8601"
	"google.golang.org/protobuf/types/known/timestamppb"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/experimental/v1"
	"github.com/gitpod-io/gitpod/public-api/experimental/v1/v1connect"
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

	server, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	team, err := server.CreateTeam(ctx, req.Msg.GetName())
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	members, err := server.GetTeamMembers(ctx, team.ID)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	invite, err := server.GetGenericInvite(ctx, team.ID)
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.CreateTeamResponse{
		Team: &v1.Team{
			Id:      team.ID,
			Name:    team.Name,
			Slug:    team.Slug,
			Members: teamMembersToAPIResponse(members),
			TeamInvitation: &v1.TeamInvitation{
				Id: invite.ID,
			},
		},
	}), nil
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
