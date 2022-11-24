// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"testing"

	connect "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/golang/mock/gomock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestProjectsService_CreateProject(t *testing.T) {

	t.Run("returns invalid argument when request validation fails", func(t *testing.T) {
		for _, s := range []struct {
			Name          string
			Spec          *v1.Project
			ExpectedError string
		}{
			{
				Name:          "name is required",
				Spec:          &v1.Project{},
				ExpectedError: "Name is a required argument.",
			},
			{
				Name: "whitespace name is rejected",
				Spec: &v1.Project{
					Name: " ",
				},
				ExpectedError: "Name is a required argument.",
			},
			{
				Name: "slug is required",
				Spec: &v1.Project{
					Name: "name",
				},
				ExpectedError: "Slug is a required argument.",
			},
			{
				Name: "whitespace slug is rejected",
				Spec: &v1.Project{
					Name: "name",
					Slug: " ",
				},
				ExpectedError: "Slug is a required argument.",
			},
			{
				Name: "clone url is required",
				Spec: &v1.Project{
					Name: "name",
					Slug: "slug",
				},
				ExpectedError: "Clone URL is a required argument.",
			},
			{
				Name: "whitespace clone url is rejected",
				Spec: &v1.Project{
					Name:     "name",
					Slug:     "slug",
					CloneUrl: " ",
				},
				ExpectedError: "Clone URL is a required argument.",
			},
			{
				Name: "user ID must be a valid UUID",
				Spec: &v1.Project{
					Name:     "name",
					Slug:     "slug",
					CloneUrl: "some.clone.url",
					UserId:   "my-user",
				},
				ExpectedError: "User ID is not a valid UUID.",
			},
			{
				Name: "team ID must be a valid UUID",
				Spec: &v1.Project{
					Name:     "name",
					Slug:     "slug",
					CloneUrl: "some.clone.url",
					TeamId:   "my-user",
				},
				ExpectedError: "Team ID is not a valid UUID.",
			},
			{
				Name: "specifying both user and team id is invalid",
				Spec: &v1.Project{
					Name:     "name",
					Slug:     "slug",
					CloneUrl: "some.clone.url",
					TeamId:   uuid.New().String(),
					UserId:   uuid.New().String(),
				},
				ExpectedError: "Specifying both User ID and Team ID is not allowed.",
			},
		} {
			t.Run(s.Name, func(t *testing.T) {
				_, client := setupProjectsService(t)

				_, err := client.CreateProject(context.Background(), connect.NewRequest(&v1.CreateProjectRequest{
					Project: s.Spec,
				}))
				require.Error(t, err)
				require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
				require.Equal(t, s.ExpectedError, err.(*connect.Error).Message())
			})
		}
	})

	t.Run("proxies request to server", func(t *testing.T) {
		projectsMock, client := setupProjectsService(t)

		project := newProject(&protocol.Project{
			Settings: &protocol.ProjectSettings{},
		})

		projectsMock.EXPECT().CreateProject(gomock.Any(), &protocol.CreateProjectOptions{
			UserID:            project.UserID,
			Name:              project.Name,
			Slug:              project.Slug,
			CloneURL:          project.CloneURL,
			AppInstallationID: "undefined",
		}).Return(project, nil)

		response, err := client.CreateProject(context.Background(), connect.NewRequest(&v1.CreateProjectRequest{
			Project: &v1.Project{
				UserId:   project.UserID,
				Name:     project.Name,
				Slug:     project.Slug,
				CloneUrl: project.CloneURL,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.CreateProjectResponse{
			Project: projectToAPIResponse(project),
		}, response.Msg)

	})
}

func TestProjectsService_ListProjects(t *testing.T) {

	t.Run("invalid argument when both team id and project id are missing", func(t *testing.T) {
		_, client := setupProjectsService(t)

		_, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when both team id and project id are set", func(t *testing.T) {
		_, client := setupProjectsService(t)

		_, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			UserId: "user-id",
			TeamId: "team-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when user ID is not a valid UUID", func(t *testing.T) {
		_, client := setupProjectsService(t)

		_, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			UserId: "some-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when team ID is not a valid UUID", func(t *testing.T) {
		_, client := setupProjectsService(t)

		_, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			TeamId: "some-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("no projects from server return empty list", func(t *testing.T) {
		serverMock, client := setupProjectsService(t)

		serverMock.EXPECT().GetUserProjects(gomock.Any()).Return(nil, nil)

		response, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			UserId: uuid.New().String(),
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     nil,
			TotalResults: 0,
		}, response.Msg)
	})

	t.Run("retrieves projects for user, when user ID is specified and paginates", func(t *testing.T) {
		serverMock, client := setupProjectsService(t)

		projects := []*protocol.Project{
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
		}

		serverMock.EXPECT().GetUserProjects(gomock.Any()).Return(projects, nil).Times(3)

		firstPage, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			UserId: uuid.New().String(),
			Pagination: &v1.Pagination{
				PageSize: 2,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     projectsToAPIResponse(projects[0:2]),
			TotalResults: int32(len(projects)),
		}, firstPage.Msg)

		secondPage, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			UserId: uuid.New().String(),
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     2,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     projectsToAPIResponse(projects[2:4]),
			TotalResults: int32(len(projects)),
		}, secondPage.Msg)

		thirdPage, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			UserId: uuid.New().String(),
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     3,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     projectsToAPIResponse(projects[4:]),
			TotalResults: int32(len(projects)),
		}, thirdPage.Msg)
	})

	t.Run("retrieves projects for team, when team ID is specified and paginates", func(t *testing.T) {
		serverMock, client := setupProjectsService(t)

		teamID := uuid.New().String()

		projects := []*protocol.Project{
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
			newProject(&protocol.Project{}),
		}

		serverMock.EXPECT().GetTeamProjects(gomock.Any(), teamID).Return(projects, nil).Times(3)

		firstPage, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			TeamId: teamID,
			Pagination: &v1.Pagination{
				PageSize: 2,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     projectsToAPIResponse(projects[0:2]),
			TotalResults: int32(len(projects)),
		}, firstPage.Msg)

		secondPage, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			TeamId: teamID,
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     2,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     projectsToAPIResponse(projects[2:4]),
			TotalResults: int32(len(projects)),
		}, secondPage.Msg)

		thirdPage, err := client.ListProjects(context.Background(), connect.NewRequest(&v1.ListProjectsRequest{
			TeamId: teamID,
			Pagination: &v1.Pagination{
				PageSize: 2,
				Page:     3,
			},
		}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListProjectsResponse{
			Projects:     projectsToAPIResponse(projects[4:]),
			TotalResults: int32(len(projects)),
		}, thirdPage.Msg)
	})
}

func setupProjectsService(t *testing.T) (*protocol.MockAPIInterface, v1connect.ProjectsServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewProjectsService(&FakeServerConnPool{
		api: serverMock,
	})

	_, handler := v1connect.NewProjectsServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewProjectsServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}

func newProject(p *protocol.Project) *protocol.Project {
	r := rand.Int()
	result := &protocol.Project{
		ID:                uuid.New().String(),
		Name:              fmt.Sprintf("team-%d", r),
		Slug:              fmt.Sprintf("team-%d", r),
		UserID:            uuid.New().String(),
		CloneURL:          "https://github.com/easyCZ/foobar",
		AppInstallationID: "1337",
		Settings: &protocol.ProjectSettings{
			UseIncrementalPrebuilds:      true,
			UsePersistentVolumeClaim:     true,
			KeepOutdatedPrebuildsRunning: true,
			AllowUsingPreviousPrebuilds:  true,
			PrebuildEveryNthCommit:       5,
			WorkspaceClasses: &protocol.WorkspaceClassesSettings{
				Regular:  "default",
				Prebuild: "default",
			},
		},
		CreationTime: "2022-09-09T09:09:09.000Z",
	}

	if p.ID != "" {
		result.ID = p.ID
	}
	if p.Name != "" {
		result.Name = p.Name
	}
	if p.Slug != "" {
		result.Slug = p.Slug
	}
	if p.UserID != "" {
		result.UserID = p.UserID
	}
	if p.TeamID != "" {
		result.TeamID = p.TeamID
	}
	if p.CloneURL != "" {
		result.CloneURL = p.CloneURL
	}
	if p.AppInstallationID != "" {
		result.AppInstallationID = p.AppInstallationID
	}
	if p.Settings != nil {
		result.Settings = p.Settings
	}

	return result
}
