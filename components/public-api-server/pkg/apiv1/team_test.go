// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bufbuild/connect-go"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	v1 "github.com/gitpod-io/gitpod/public-api/experimental/v1"
	"github.com/gitpod-io/gitpod/public-api/experimental/v1/v1connect"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/testing/protocmp"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	memberSince = "2022-10-10T10:10:10.000Z"
)

func TestTeamsService_CreateTeam(t *testing.T) {

	var (
		name = "Shiny New Team"
		slug = "shiny-new-team"
		id   = uuid.New().String()
	)

	t.Run("returns invalid argument when name is empty", func(t *testing.T) {
		ctx := context.Background()
		_, client := setupTeamService(t)

		_, err := client.CreateTeam(ctx, connect.NewRequest(&v1.CreateTeamRequest{Name: ""}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns invalid request when server returns invalid request", func(t *testing.T) {
		ctx := context.Background()
		serverMock, client := setupTeamService(t)

		serverMock.EXPECT().CreateTeam(gomock.Any(), name).Return(nil, errors.New("code 400"))

		_, err := client.CreateTeam(ctx, connect.NewRequest(&v1.CreateTeamRequest{Name: name}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns team with members and invite", func(t *testing.T) {
		ts := time.Now().UTC()
		teamMembers := []*protocol.TeamMemberInfo{
			{
				UserId:       uuid.New().String(),
				FullName:     "Alice Alice",
				PrimaryEmail: "alice@alice.com",
				AvatarUrl:    "",
				Role:         protocol.TeamMember_Owner,
				MemberSince:  memberSince,
			}, {
				UserId:       uuid.New().String(),
				FullName:     "Bob Bob",
				PrimaryEmail: "bob@bob.com",
				AvatarUrl:    "",
				Role:         protocol.TeamMember_Member,
				MemberSince:  memberSince,
			},
		}
		inviteID := uuid.New().String()

		serverMock, client := setupTeamService(t)

		serverMock.EXPECT().CreateTeam(gomock.Any(), name).Return(&protocol.Team{
			ID:           id,
			Name:         name,
			Slug:         slug,
			CreationTime: ts.String(),
		}, nil)
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), id).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), id).Return(&protocol.TeamMembershipInvite{
			ID:               inviteID,
			TeamID:           id,
			Role:             "",
			CreationTime:     "",
			InvalidationTime: "",
			InvitedEmail:     "",
		}, nil)

		response, err := client.CreateTeam(context.Background(), connect.NewRequest(&v1.CreateTeamRequest{Name: name}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.CreateTeamResponse{
			Team: &v1.Team{
				Id:   id,
				Name: name,
				Slug: slug,
				Members: []*v1.TeamMember{
					{
						UserId:      teamMembers[0].UserId,
						Role:        teamRoleToAPIResponse(teamMembers[0].Role),
						MemberSince: timestamppb.New(time.Date(2022, 10, 10, 10, 10, 10, 0, time.UTC)),
					},
					{
						UserId:      teamMembers[1].UserId,
						Role:        teamRoleToAPIResponse(teamMembers[1].Role),
						MemberSince: timestamppb.New(time.Date(2022, 10, 10, 10, 10, 10, 0, time.UTC)),
					},
				},
				TeamInvitation: &v1.TeamInvitation{
					Id: inviteID,
				},
			},
		}, response.Msg)
	})
}

func TestTeamsService_ListTeams(t *testing.T) {
	t.Run("returns teams with members and invite", func(t *testing.T) {
		ctx := context.Background()
		serverMock, client := setupTeamService(t)

		teamMembers := []*protocol.TeamMemberInfo{
			{
				UserId:       uuid.New().String(),
				FullName:     "Alice Alice",
				PrimaryEmail: "alice@alice.com",
				AvatarUrl:    "",
				Role:         protocol.TeamMember_Owner,
				MemberSince:  memberSince,
			}, {
				UserId:       uuid.New().String(),
				FullName:     "Bob Bob",
				PrimaryEmail: "bob@bob.com",
				AvatarUrl:    "",
				Role:         protocol.TeamMember_Member,
				MemberSince:  memberSince,
			},
		}
		teams := []*protocol.Team{
			{
				ID:   uuid.New().String(),
				Name: "Team A",
				Slug: "team_a",
			}, {
				ID:   uuid.New().String(),
				Name: "Team B",
				Slug: "team_ba",
			},
		}
		inviteID := uuid.New().String()

		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		// Mocks for populating team A details
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), teams[0].ID).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), teams[0].ID).Return(&protocol.TeamMembershipInvite{
			ID:     inviteID,
			TeamID: teams[0].ID,
		}, nil)
		// Mock for populating team B details
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), teams[1].ID).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), teams[1].ID).Return(&protocol.TeamMembershipInvite{
			ID:     inviteID,
			TeamID: teams[1].ID,
		}, nil)

		response, err := client.ListTeams(ctx, connect.NewRequest(&v1.ListTeamsRequest{}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListTeamsResponse{
			Teams: []*v1.Team{
				{
					Id:   teams[0].ID,
					Name: teams[0].Name,
					Slug: teams[0].Slug,
					Members: []*v1.TeamMember{
						{
							UserId:      teamMembers[0].UserId,
							Role:        teamRoleToAPIResponse(teamMembers[0].Role),
							MemberSince: parseTimeStamp(memberSince),
						},
						{
							UserId:      teamMembers[1].UserId,
							Role:        teamRoleToAPIResponse(teamMembers[1].Role),
							MemberSince: parseTimeStamp(memberSince),
						},
					},
					TeamInvitation: &v1.TeamInvitation{
						Id: inviteID,
					},
				},
				{
					Id:   teams[1].ID,
					Name: teams[1].Name,
					Slug: teams[1].Slug,
					Members: []*v1.TeamMember{
						{
							UserId:      teamMembers[0].UserId,
							Role:        teamRoleToAPIResponse(teamMembers[0].Role),
							MemberSince: parseTimeStamp(memberSince),
						},
						{
							UserId:      teamMembers[1].UserId,
							Role:        teamRoleToAPIResponse(teamMembers[1].Role),
							MemberSince: parseTimeStamp(memberSince),
						},
					},
					TeamInvitation: &v1.TeamInvitation{
						Id: inviteID,
					},
				},
			},
		}, response.Msg)
	})
}

func setupTeamService(t *testing.T) (*protocol.MockAPIInterface, v1connect.TeamsServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewTeamsService(&FakeServerConnPool{
		api: serverMock,
	})

	_, handler := v1connect.NewTeamsServiceHandler(svc)

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewTeamsServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}

func requireEqualProto(t *testing.T, expected interface{}, actual interface{}) {
	t.Helper()

	diff := cmp.Diff(expected, actual, protocmp.Transform())
	if diff != "" {
		require.Fail(t, diff)
	}
}
