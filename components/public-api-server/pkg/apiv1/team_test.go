// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/testing/protocmp"
)

func TestTeamsService_CreateTeam(t *testing.T) {

	var (
		name = "Shiny New Team"
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

		serverMock.EXPECT().CreateTeam(gomock.Any(), name).Return(nil, &jsonrpc2.Error{
			Code:    400,
			Message: "invalid request",
		})

		_, err := client.CreateTeam(ctx, connect.NewRequest(&v1.CreateTeamRequest{Name: name}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("returns team with members and invite", func(t *testing.T) {
		teamMembers := []*protocol.TeamMemberInfo{
			newTeamMember(&protocol.TeamMemberInfo{
				FullName: "Alice Alice",
				Role:     protocol.TeamMember_Owner,
			}),
			newTeamMember(&protocol.TeamMemberInfo{
				FullName: "Bob Bob",
				Role:     protocol.TeamMember_Member,
			}),
		}
		inviteID := uuid.New().String()
		invite := &protocol.TeamMembershipInvite{
			ID:     inviteID,
			TeamID: id,
		}
		team := newTeam(&protocol.Team{
			ID: id,
		})

		serverMock, client := setupTeamService(t)

		serverMock.EXPECT().CreateTeam(gomock.Any(), name).Return(team, nil)
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), id).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), id).Return(&protocol.TeamMembershipInvite{
			ID:     inviteID,
			TeamID: id,
		}, nil)

		response, err := client.CreateTeam(context.Background(), connect.NewRequest(&v1.CreateTeamRequest{Name: name}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.CreateTeamResponse{
			Team: teamToAPIResponse(team, teamMembers, invite),
		}, response.Msg)
	})
}

func TestTeamsService_ListTeams(t *testing.T) {
	t.Run("returns teams with members and invite", func(t *testing.T) {
		ctx := context.Background()
		serverMock, client := setupTeamService(t)

		teamMembers := []*protocol.TeamMemberInfo{
			newTeamMember(&protocol.TeamMemberInfo{
				FullName: "Alice Alice",
				Role:     protocol.TeamMember_Owner,
			}),
			newTeamMember(&protocol.TeamMemberInfo{
				FullName: "Bob Bob",
				Role:     protocol.TeamMember_Member,
			}),
		}
		teams := []*protocol.Team{
			newTeam(&protocol.Team{
				Name: "Team A",
			}),
			newTeam(&protocol.Team{
				Name: "Team B",
			}),
		}
		inviteID := uuid.New().String()
		invite := &protocol.TeamMembershipInvite{
			ID:     inviteID,
			TeamID: teams[1].ID,
		}

		serverMock.EXPECT().GetTeams(gomock.Any()).Return(teams, nil)

		// Mocks for populating team A details
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), teams[0].ID).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), teams[0].ID).Return(&protocol.TeamMembershipInvite{
			ID:     inviteID,
			TeamID: teams[0].ID,
		}, nil)
		// Mock for populating team B details
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), teams[1].ID).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), teams[1].ID).Return(invite, nil)

		response, err := client.ListTeams(ctx, connect.NewRequest(&v1.ListTeamsRequest{}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListTeamsResponse{
			Teams: []*v1.Team{
				teamToAPIResponse(teams[0], teamMembers, invite),
				teamToAPIResponse(teams[1], teamMembers, invite),
			},
		}, response.Msg)
	})
}

func TestTeamService_GetTeam(t *testing.T) {
	var (
		teamID = uuid.New().String()
	)

	t.Run("returns invalid argument when empty ID provided", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.GetTeam(context.Background(), connect.NewRequest(&v1.GetTeamRequest{
			TeamId: "",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("proxies request to server", func(t *testing.T) {
		serverMock, client := setupTeamService(t)

		team := newTeam(&protocol.Team{
			ID: teamID,
		})
		members := []*protocol.TeamMemberInfo{newTeamMember(&protocol.TeamMemberInfo{}), newTeamMember(&protocol.TeamMemberInfo{})}
		invite := &protocol.TeamMembershipInvite{ID: uuid.New().String()}

		serverMock.EXPECT().GetTeam(gomock.Any(), teamID).Return(team, nil)
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), teamID).Return(members, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), teamID).Return(invite, nil)

		retrieved, err := client.GetTeam(context.Background(), connect.NewRequest(&v1.GetTeamRequest{
			TeamId: teamID,
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.GetTeamResponse{
			Team: teamToAPIResponse(team, members, invite),
		}, retrieved.Msg)
	})
}

func TestTeamsService_JoinTeam(t *testing.T) {

	var (
		teamID   = uuid.New().String()
		inviteID = uuid.New().String()
	)

	t.Run("fails with invalid argument when no join ID is specified", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.JoinTeam(context.Background(), connect.NewRequest(&v1.JoinTeamRequest{
			InvitationId: "",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("delegates joining to server, and populates team response", func(t *testing.T) {
		serverMock, client := setupTeamService(t)

		team := newTeam(&protocol.Team{ID: teamID})
		teamMembers := []*protocol.TeamMemberInfo{newTeamMember(&protocol.TeamMemberInfo{})}
		invite := &protocol.TeamMembershipInvite{
			ID: uuid.New().String(),
		}

		serverMock.EXPECT().JoinTeam(gomock.Any(), inviteID).Return(team, nil)
		serverMock.EXPECT().GetTeamMembers(gomock.Any(), teamID).Return(teamMembers, nil)
		serverMock.EXPECT().GetGenericInvite(gomock.Any(), teamID).Return(invite, nil)

		response, err := client.JoinTeam(context.Background(), connect.NewRequest(&v1.JoinTeamRequest{
			InvitationId: inviteID,
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.JoinTeamResponse{
			Team: teamToAPIResponse(team, teamMembers, invite),
		}, response.Msg)
	})
}

func TestTeamToAPIResponse(t *testing.T) {
	// Here, we're deliberately not using our helpers newTeam, newTeamMembers because
	// we want to assert from first principles
	team := &protocol.Team{
		ID:           uuid.New().String(),
		Name:         "New Team",
		Slug:         "new_team",
		CreationTime: "2022-09-09T09:09:09.000Z",
	}
	members := []*protocol.TeamMemberInfo{
		{
			UserId:       uuid.New().String(),
			FullName:     "First Last",
			PrimaryEmail: "email1@gitpod.io",
			AvatarUrl:    "https://avatars.com/foo",
			Role:         protocol.TeamMember_Member,
			MemberSince:  "2022-09-09T09:09:09.000Z",
		},
		{
			UserId:       uuid.New().String(),
			FullName:     "Second Last",
			PrimaryEmail: "email2@gitpod.io",
			AvatarUrl:    "https://avatars.com/bar",
			Role:         protocol.TeamMember_Owner,
			MemberSince:  "2022-09-09T09:09:09.000Z",
		},
	}
	invite := &protocol.TeamMembershipInvite{
		ID:               uuid.New().String(),
		TeamID:           uuid.New().String(),
		Role:             protocol.TeamMember_Member,
		CreationTime:     "2022-08-08T08:08:08.000Z",
		InvalidationTime: "2022-11-11T11:11:11.000Z",
		InvitedEmail:     "nope@gitpod.io",
	}

	response := teamToAPIResponse(team, members, invite)
	requireEqualProto(t, &v1.Team{
		Id:   team.ID,
		Name: team.Name,
		Slug: team.Slug,
		Members: []*v1.TeamMember{
			{
				UserId:       members[0].UserId,
				Role:         teamRoleToAPIResponse(members[0].Role),
				MemberSince:  parseTimeStamp(members[0].MemberSince),
				AvatarUrl:    members[0].AvatarUrl,
				FullName:     members[0].FullName,
				PrimaryEmail: members[0].PrimaryEmail,
			},
			{
				UserId:       members[1].UserId,
				Role:         teamRoleToAPIResponse(members[1].Role),
				MemberSince:  parseTimeStamp(members[1].MemberSince),
				AvatarUrl:    members[1].AvatarUrl,
				FullName:     members[1].FullName,
				PrimaryEmail: members[1].PrimaryEmail,
			},
		},
		TeamInvitation: &v1.TeamInvitation{
			Id: invite.ID,
		},
	}, response)
}

func TestTeamsService_UpdateTeamMember(t *testing.T) {
	var (
		teamID       = uuid.New().String()
		teamMemberID = uuid.New().String()
	)

	t.Run("invalid argument when team ID is missing", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.UpdateTeamMember(context.Background(), connect.NewRequest(&v1.UpdateTeamMemberRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when team member ID is missing", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.UpdateTeamMember(context.Background(), connect.NewRequest(&v1.UpdateTeamMemberRequest{
			TeamId:     teamID,
			TeamMember: &v1.TeamMember{},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when team member role is missing", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.UpdateTeamMember(context.Background(), connect.NewRequest(&v1.UpdateTeamMemberRequest{
			TeamId: teamID,
			TeamMember: &v1.TeamMember{
				UserId: teamMemberID,
			},
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("proxies request to server", func(t *testing.T) {
		serverMock, client := setupTeamService(t)

		serverMock.EXPECT().SetTeamMemberRole(gomock.Any(), teamID, teamMemberID, protocol.TeamMember_Owner).Return(nil)

		response, err := client.UpdateTeamMember(context.Background(), connect.NewRequest(&v1.UpdateTeamMemberRequest{
			TeamId: teamID,
			TeamMember: &v1.TeamMember{
				UserId: teamMemberID,
				Role:   v1.TeamRole_TEAM_ROLE_OWNER,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.UpdateTeamMemberResponse{
			TeamMember: &v1.TeamMember{
				UserId: teamMemberID,
				Role:   v1.TeamRole_TEAM_ROLE_OWNER,
			},
		}, response.Msg)
	})
}

func TestTeamsService_DeleteTeamMember(t *testing.T) {
	var (
		teamID       = uuid.New().String()
		teamMemberID = uuid.New().String()
	)

	t.Run("invalid argument when team ID is missing", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.DeleteTeamMember(context.Background(), connect.NewRequest(&v1.DeleteTeamMemberRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when team member ID is missing", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.DeleteTeamMember(context.Background(), connect.NewRequest(&v1.DeleteTeamMemberRequest{
			TeamId: teamID,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("proxies to server", func(t *testing.T) {
		serverMock, client := setupTeamService(t)

		serverMock.EXPECT().RemoveTeamMember(gomock.Any(), teamID, teamMemberID).Return(nil)

		response, err := client.DeleteTeamMember(context.Background(), connect.NewRequest(&v1.DeleteTeamMemberRequest{
			TeamId:       teamID,
			TeamMemberId: teamMemberID,
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.DeleteTeamMemberResponse{}, response.Msg)
	})
}

func TestTeamService_ResetTeamInvitation(t *testing.T) {
	t.Run("missing team ID returns invalid argument", func(t *testing.T) {
		_, client := setupTeamService(t)

		_, err := client.ResetTeamInvitation(context.Background(), connect.NewRequest(&v1.ResetTeamInvitationRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("proxies request to server", func(t *testing.T) {
		teamID := uuid.New().String()

		serverMock, client := setupTeamService(t)

		invite := &protocol.TeamMembershipInvite{
			ID: uuid.New().String(),
		}

		serverMock.EXPECT().ResetGenericInvite(gomock.Any(), teamID).Return(invite, nil)

		response, err := client.ResetTeamInvitation(context.Background(), connect.NewRequest(&v1.ResetTeamInvitationRequest{
			TeamId: teamID,
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ResetTeamInvitationResponse{
			TeamInvitation: teamInviteToAPIResponse(invite),
		}, response.Msg)
	})
}

func newTeam(t *protocol.Team) *protocol.Team {
	result := &protocol.Team{
		ID:           uuid.New().String(),
		Name:         "Team Name",
		Slug:         "team_name",
		CreationTime: "2022-10-10T10:10:10.000Z",
	}

	if t.ID != "" {
		result.ID = t.ID
	}

	if t.Name != "" {
		result.Name = t.Name
	}

	if t.Slug != "" {
		result.Slug = t.Slug
	}

	if t.CreationTime != "" {
		result.CreationTime = t.CreationTime
	}

	return result
}

func newTeamMember(m *protocol.TeamMemberInfo) *protocol.TeamMemberInfo {
	result := &protocol.TeamMemberInfo{
		UserId:       uuid.New().String(),
		FullName:     "First Last",
		PrimaryEmail: "email@gitpod.io",
		AvatarUrl:    "https://avatars.yolo/first.png",
		Role:         protocol.TeamMember_Member,
		MemberSince:  "2022-09-09T09:09:09.000Z",
	}

	if m.UserId != "" {
		result.UserId = m.UserId
	}
	if m.FullName != "" {
		result.FullName = m.FullName
	}
	if m.PrimaryEmail != "" {
		result.PrimaryEmail = m.PrimaryEmail
	}
	if m.AvatarUrl != "" {
		result.AvatarUrl = m.AvatarUrl
	}
	if m.Role != "" {
		result.Role = m.Role
	}
	if m.MemberSince != "" {
		result.MemberSince = m.MemberSince
	}

	return result
}

func setupTeamService(t *testing.T) (*protocol.MockAPIInterface, v1connect.TeamsServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewTeamsService(&FakeServerConnPool{
		api: serverMock,
	})

	_, handler := v1connect.NewTeamsServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

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
