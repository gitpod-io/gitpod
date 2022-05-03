// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"testing"
)

func TestWorkspaceService_GetWorkspace(t *testing.T) {
	const (
		bearerToken      = "bearer-token-for-tests"
		foundWorkspaceID = "easycz-seer-xl8o1zacpyw"
	)

	srv := baseserver.NewForTests(t)

	connPool := &FakeServerConnPool{
		api: &FakeGitpodAPI{workspaces: map[string]*gitpod.WorkspaceInfo{
			foundWorkspaceID: {
				LatestInstance: &gitpod.WorkspaceInstance{},
				Workspace:      &gitpod.Workspace{},
			},
		}},
	}
	v1.RegisterWorkspacesServiceServer(srv.GRPC(), NewWorkspaceService(connPool))
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	client := v1.NewWorkspacesServiceClient(conn)
	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", bearerToken)

	scenarios := []struct {
		name string

		WorkspaceID string

		ErrorCode codes.Code
		Response  *v1.GetWorkspaceResponse
	}{
		{
			name:        "returns a workspace when workspace is found by ID",
			WorkspaceID: foundWorkspaceID,
			ErrorCode:   codes.OK,
			Response: &v1.GetWorkspaceResponse{
				Result: &v1.Workspace{
					WorkspaceId: foundWorkspaceID,
					OwnerId:     "mock_owner",
					ProjectId:   "mock_project_id",
					Context: &v1.WorkspaceContext{
						ContextUrl: "https://github.com/gitpod-io/gitpod",
						Details:    nil,
					},
					Description: "This is a mock response",
				},
			},
		},
		{
			name:        "not found when workspace is not found by ID",
			WorkspaceID: "some-not-found-workspace-id",
			ErrorCode:   codes.NotFound,
			Response:    nil,
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			resp, err := client.GetWorkspace(ctx, &v1.GetWorkspaceRequest{
				WorkspaceId: scenario.WorkspaceID,
			})
			require.Equal(t, scenario.ErrorCode, status.Code(err), "status code must match")
			require.True(t, proto.Equal(scenario.Response, resp))
		})

	}

}

type FakeServerConnPool struct {
	api gitpod.APIInterface
}

func (f *FakeServerConnPool) Get(ctx context.Context, token string) (gitpod.APIInterface, error) {
	return f.api, nil
}

type FakeGitpodAPI struct {
	workspaces map[string]*gitpod.WorkspaceInfo
}

func (f *FakeGitpodAPI) GetWorkspace(ctx context.Context, id string) (res *gitpod.WorkspaceInfo, err error) {
	w, ok := f.workspaces[id]
	if !ok {
		return nil, fmt.Errorf("workspace not found")
	}

	return w, nil
}

func (f *FakeGitpodAPI) AdminBlockUser(ctx context.Context, req *gitpod.AdminBlockUserRequest) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetLoggedInUser(ctx context.Context) (res *gitpod.User, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) UpdateLoggedInUser(ctx context.Context, user *gitpod.User) (res *gitpod.User, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetAuthProviders(ctx context.Context) (res []*gitpod.AuthProviderInfo, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetOwnAuthProviders(ctx context.Context) (res []*gitpod.AuthProviderEntry, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) UpdateOwnAuthProvider(ctx context.Context, params *gitpod.UpdateOwnAuthProviderParams) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) DeleteOwnAuthProvider(ctx context.Context, params *gitpod.DeleteOwnAuthProviderParams) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetConfiguration(ctx context.Context) (res *gitpod.Configuration, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetGitpodTokenScopes(ctx context.Context, tokenHash string) (res []string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetToken(ctx context.Context, query *gitpod.GetTokenSearchOptions) (res *gitpod.Token, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetPortAuthenticationToken(ctx context.Context, workspaceID string) (res *gitpod.Token, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) DeleteAccount(ctx context.Context) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetClientRegion(ctx context.Context) (res string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) HasPermission(ctx context.Context, permission *gitpod.PermissionName) (res bool, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetWorkspaces(ctx context.Context, options *gitpod.GetWorkspacesOptions) (res []*gitpod.WorkspaceInfo, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetWorkspaceOwner(ctx context.Context, workspaceID string) (res *gitpod.UserInfo, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetWorkspaceUsers(ctx context.Context, workspaceID string) (res []*gitpod.WorkspaceInstanceUser, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetFeaturedRepositories(ctx context.Context) (res []*gitpod.WhitelistedRepository, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) IsWorkspaceOwner(ctx context.Context, workspaceID string) (res bool, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) CreateWorkspace(ctx context.Context, options *gitpod.CreateWorkspaceOptions) (res *gitpod.WorkspaceCreationResult, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) StartWorkspace(ctx context.Context, id string, options *gitpod.StartWorkspaceOptions) (res *gitpod.StartWorkspaceResult, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) StopWorkspace(ctx context.Context, id string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) DeleteWorkspace(ctx context.Context, id string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) SetWorkspaceDescription(ctx context.Context, id string, desc string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) ControlAdmission(ctx context.Context, id string, level *gitpod.AdmissionLevel) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) UpdateWorkspaceUserPin(ctx context.Context, id string, action *gitpod.PinAction) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) SendHeartBeat(ctx context.Context, options *gitpod.SendHeartBeatOptions) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) WatchWorkspaceImageBuildLogs(ctx context.Context, workspaceID string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) IsPrebuildDone(ctx context.Context, pwsid string) (res bool, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) SetWorkspaceTimeout(ctx context.Context, workspaceID string, duration *gitpod.WorkspaceTimeoutDuration) (res *gitpod.SetWorkspaceTimeoutResult, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetWorkspaceTimeout(ctx context.Context, workspaceID string) (res *gitpod.GetWorkspaceTimeoutResult, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetOpenPorts(ctx context.Context, workspaceID string) (res []*gitpod.WorkspaceInstancePort, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) OpenPort(ctx context.Context, workspaceID string, port *gitpod.WorkspaceInstancePort) (res *gitpod.WorkspaceInstancePort, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) ClosePort(ctx context.Context, workspaceID string, port float32) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetUserStorageResource(ctx context.Context, options *gitpod.GetUserStorageResourceOptions) (res string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) UpdateUserStorageResource(ctx context.Context, options *gitpod.UpdateUserStorageResourceOptions) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetEnvVars(ctx context.Context) (res []*gitpod.UserEnvVarValue, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) SetEnvVar(ctx context.Context, variable *gitpod.UserEnvVarValue) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) DeleteEnvVar(ctx context.Context, variable *gitpod.UserEnvVarValue) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetContentBlobUploadURL(ctx context.Context, name string) (url string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetContentBlobDownloadURL(ctx context.Context, name string) (url string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetGitpodTokens(ctx context.Context) (res []*gitpod.APIToken, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GenerateNewGitpodToken(ctx context.Context, options *gitpod.GenerateNewGitpodTokenOptions) (res string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) DeleteGitpodToken(ctx context.Context, tokenHash string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) SendFeedback(ctx context.Context, feedback string) (res string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) RegisterGithubApp(ctx context.Context, installationID string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) TakeSnapshot(ctx context.Context, options *gitpod.TakeSnapshotOptions) (res string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) WaitForSnapshot(ctx context.Context, snapshotId string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetSnapshots(ctx context.Context, workspaceID string) (res []*string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) StoreLayout(ctx context.Context, workspaceID string, layoutData string) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GetLayout(ctx context.Context, workspaceID string) (res string, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) GuessGitTokenScopes(ctx context.Context, params *gitpod.GuessGitTokenScopesParams) (res *gitpod.GuessedGitTokenScopes, err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) TrackEvent(ctx context.Context, event *gitpod.RemoteTrackMessage) (err error) {
	panic("implement me")
}

func (f *FakeGitpodAPI) InstanceUpdates(ctx context.Context, instanceID string) (<-chan *gitpod.WorkspaceInstance, error) {
	panic("implement me")
}
