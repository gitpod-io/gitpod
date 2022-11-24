// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"
	"strings"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/google/uuid"
)

func NewProjectsService(pool proxy.ServerConnectionPool) *ProjectsService {
	return &ProjectsService{
		connectionPool: pool,
	}
}

type ProjectsService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedProjectsServiceHandler
}

func (s *ProjectsService) CreateProject(ctx context.Context, req *connect.Request[v1.CreateProjectRequest]) (*connect.Response[v1.CreateProjectResponse], error) {
	spec := req.Msg.GetProject()

	name := strings.TrimSpace(spec.GetName())
	if name == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Name is a required argument."))
	}

	slug := strings.TrimSpace(spec.GetSlug())
	if slug == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Slug is a required argument."))
	}

	cloneURL := strings.TrimSpace(spec.GetCloneUrl())
	if cloneURL == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Clone URL is a required argument."))
	}

	userID, teamID := spec.GetUserId(), spec.GetTeamId()
	if userID != "" && teamID != "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Specifying both User ID and Team ID is not allowed."))
	}

	if userID != "" {
		_, err := uuid.Parse(userID)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("User ID is not a valid UUID."))
		}
	}

	if teamID != "" {
		_, err := uuid.Parse(teamID)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID is not a valid UUID."))
		}
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	project, err := conn.CreateProject(ctx, &protocol.CreateProjectOptions{
		Name:              name,
		Slug:              slug,
		UserID:            userID,
		TeamID:            teamID,
		CloneURL:          cloneURL,
		AppInstallationID: "undefined", // sadly that's how we store cases where there is no AppInstallationID
	})
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.CreateProjectResponse{
		Project: projectToAPIResponse(project),
	}), nil
}

func (s *ProjectsService) ListProjects(ctx context.Context, req *connect.Request[v1.ListProjectsRequest]) (*connect.Response[v1.ListProjectsResponse], error) {
	userID, teamID := req.Msg.GetUserId(), req.Msg.GetTeamId()
	if userID == "" && teamID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Neither User ID nor Team ID specified. Specify one of them."))
	}

	if userID != "" && teamID != "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Specifying both User ID and Team ID is not allowed."))
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	var projects []*protocol.Project

	if userID != "" {
		_, err := uuid.Parse(userID)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("User ID is not a valid UUID."))
		}

		projects, err = conn.GetUserProjects(ctx)
		if err != nil {
			return nil, proxy.ConvertError(err)
		}
	}

	if teamID != "" {
		_, err := uuid.Parse(teamID)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID is not a valid UUID."))
		}

		projects, err = conn.GetTeamProjects(ctx, teamID)
		if err != nil {
			return nil, proxy.ConvertError(err)
		}
	}

	// We're extracting a particular page of results from the full set of results.
	// This is wasteful, but necessary, until we either:
	// 	* Add new APIs to server which support pagination
	// 	* Port the query logic to Public API
	results := pageFromResults(projects, req.Msg.GetPagination())

	return connect.NewResponse(&v1.ListProjectsResponse{
		Projects:     projectsToAPIResponse(results),
		TotalResults: int32(len(projects)),
	}), nil
}

func (s *ProjectsService) getConnection(ctx context.Context) (protocol.APIInterface, error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to establish connection to downstream services. If this issue persists, please contact Gitpod Support."))
	}

	return conn, nil
}

func projectsToAPIResponse(ps []*protocol.Project) []*v1.Project {
	var projects []*v1.Project
	for _, p := range ps {
		projects = append(projects, projectToAPIResponse(p))
	}

	return projects
}

func projectToAPIResponse(p *protocol.Project) *v1.Project {
	return &v1.Project{
		Id:           p.ID,
		TeamId:       p.TeamID,
		UserId:       p.UserID,
		Name:         p.Name,
		Slug:         p.Slug,
		CloneUrl:     p.CloneURL,
		CreationTime: parseTimeStamp(p.CreationTime),
		Settings:     projectSettingsToAPIResponse(p.Settings),
	}
}

func projectSettingsToAPIResponse(s *protocol.ProjectSettings) *v1.ProjectSettings {
	if s == nil {
		return &v1.ProjectSettings{}
	}

	return &v1.ProjectSettings{
		Prebuild: &v1.PrebuildSettings{
			EnableIncrementalPrebuilds:   s.UseIncrementalPrebuilds,
			KeepOutdatedPrebuildsRunning: s.KeepOutdatedPrebuildsRunning,
			UsePreviousPrebuilds:         s.AllowUsingPreviousPrebuilds,
			PrebuildEveryNth:             int32(s.PrebuildEveryNthCommit),
		},
		Workspace: &v1.WorkspaceSettings{
			EnablePersistentVolumeClaim: s.UsePersistentVolumeClaim,
			WorkspaceClass:              workspaceClassesToAPIResponse(s.WorkspaceClasses),
		},
	}
}

func workspaceClassesToAPIResponse(s *protocol.WorkspaceClassesSettings) *v1.WorkspaceClassSettings {
	if s == nil {
		return &v1.WorkspaceClassSettings{}
	}

	return &v1.WorkspaceClassSettings{
		Regular:  s.Regular,
		Prebuild: s.Prebuild,
	}
}
