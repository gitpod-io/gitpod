// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/namegen"

	fuzz "github.com/AdaLogics/go-fuzz-headers"
	connect "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/testing/protocmp"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestWorkspaceService_GetWorkspace(t *testing.T) {

	workspaceID := workspaceTestData[0].Protocol.Workspace.ID

	t.Run("invalid argument when workspace ID is missing", func(t *testing.T) {
		_, client := setupWorkspacesService(t)

		_, err := client.GetWorkspace(context.Background(), connect.NewRequest(&v1.GetWorkspaceRequest{
			WorkspaceId: "",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when workspace ID does not validate", func(t *testing.T) {
		_, client := setupWorkspacesService(t)

		_, err := client.GetWorkspace(context.Background(), connect.NewRequest(&v1.GetWorkspaceRequest{
			WorkspaceId: "some-random-not-valid-workspace-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("not found when workspace does not exist", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().GetWorkspace(gomock.Any(), workspaceID).Return(nil, &jsonrpc2.Error{
			Code:    404,
			Message: "not found",
		})

		_, err := client.GetWorkspace(context.Background(), connect.NewRequest(&v1.GetWorkspaceRequest{
			WorkspaceId: workspaceID,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("returns a workspace when it exists", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().GetWorkspace(gomock.Any(), workspaceID).Return(&workspaceTestData[0].Protocol, nil)

		resp, err := client.GetWorkspace(context.Background(), connect.NewRequest(&v1.GetWorkspaceRequest{
			WorkspaceId: workspaceID,
		}))
		require.NoError(t, err)

		requireEqualProto(t, workspaceTestData[0].API, resp.Msg.GetResult())
	})
}

func TestWorkspaceService_StopWorkspace(t *testing.T) {

	workspaceID := workspaceTestData[0].Protocol.Workspace.ID

	t.Run("invalid argument when workspace ID is missing", func(t *testing.T) {
		_, client := setupWorkspacesService(t)

		_, err := client.StopWorkspace(context.Background(), connect.NewRequest(&v1.StopWorkspaceRequest{
			WorkspaceId: "",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when workspace ID does not validate", func(t *testing.T) {
		_, client := setupWorkspacesService(t)

		_, err := client.StopWorkspace(context.Background(), connect.NewRequest(&v1.StopWorkspaceRequest{
			WorkspaceId: "some-random-not-valid-workspace-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("not found when workspace does not exist", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().StopWorkspace(gomock.Any(), workspaceID).Return(&jsonrpc2.Error{
			Code:    404,
			Message: "not found",
		})

		_, err := client.StopWorkspace(context.Background(), connect.NewRequest(&v1.StopWorkspaceRequest{
			WorkspaceId: workspaceID,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("delegates to server", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().StopWorkspace(gomock.Any(), workspaceID).Return(nil)

		resp, err := client.StopWorkspace(context.Background(), connect.NewRequest(&v1.StopWorkspaceRequest{
			WorkspaceId: workspaceID,
		}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.StopWorkspaceResponse{}, resp.Msg)
	})
}

func TestWorkspaceService_DeleteWorkspace(t *testing.T) {

	workspaceID := workspaceTestData[0].Protocol.Workspace.ID

	t.Run("invalid argument when workspace ID is missing", func(t *testing.T) {
		_, client := setupWorkspacesService(t)

		_, err := client.DeleteWorkspace(context.Background(), connect.NewRequest(&v1.DeleteWorkspaceRequest{
			WorkspaceId: "",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("invalid argument when workspace ID does not validate", func(t *testing.T) {
		_, client := setupWorkspacesService(t)

		_, err := client.DeleteWorkspace(context.Background(), connect.NewRequest(&v1.DeleteWorkspaceRequest{
			WorkspaceId: "some-random-not-valid-workspace-id",
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeInvalidArgument, connect.CodeOf(err))
	})

	t.Run("not found when workspace does not exist", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().DeleteWorkspace(gomock.Any(), workspaceID).Return(&jsonrpc2.Error{
			Code:    404,
			Message: "not found",
		})

		_, err := client.DeleteWorkspace(context.Background(), connect.NewRequest(&v1.DeleteWorkspaceRequest{
			WorkspaceId: workspaceID,
		}))
		require.Error(t, err)
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(err))
	})

	t.Run("delegates to server", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().DeleteWorkspace(gomock.Any(), workspaceID).Return(nil)

		resp, err := client.DeleteWorkspace(context.Background(), connect.NewRequest(&v1.DeleteWorkspaceRequest{
			WorkspaceId: workspaceID,
		}))
		require.NoError(t, err)

		requireEqualProto(t, &v1.DeleteWorkspaceResponse{}, resp.Msg)
	})
}

func TestWorkspaceService_GetOwnerToken(t *testing.T) {
	const (
		foundWorkspaceID = "easycz-seer-xl8o1zacpyw"
		ownerToken       = "some-owner-token"
	)

	type Expectation struct {
		Code     connect.Code
		Response *v1.GetOwnerTokenResponse
	}
	tests := []struct {
		name        string
		WorkspaceID string
		Tokens      map[string]string
		Expect      Expectation
	}{
		{
			name:        "returns an owner token when workspace is found by ID",
			WorkspaceID: foundWorkspaceID,
			Tokens:      map[string]string{foundWorkspaceID: ownerToken},
			Expect: Expectation{
				Response: &v1.GetOwnerTokenResponse{
					Token: ownerToken,
				},
			},
		},
		{
			name:        "not found when workspace is not found by ID",
			WorkspaceID: mustGenerateWorkspaceID(t),
			Expect: Expectation{
				Code: connect.CodeNotFound,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			serverMock, client := setupWorkspacesService(t)

			serverMock.EXPECT().GetOwnerToken(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, workspaceID string) (res string, err error) {
				w, ok := test.Tokens[workspaceID]
				if !ok {
					return "", &jsonrpc2.Error{
						Code:    404,
						Message: "not found",
					}
				}
				return w, nil
			})

			resp, err := client.GetOwnerToken(context.Background(), connect.NewRequest(&v1.GetOwnerTokenRequest{
				WorkspaceId: test.WorkspaceID,
			}))
			requireErrorCode(t, test.Expect.Code, err)
			if test.Expect.Response != nil {
				requireEqualProto(t, test.Expect.Response, resp.Msg)
			}
		})
	}
}

func TestWorkspaceService_ListWorkspaces(t *testing.T) {
	ctx := context.Background()

	type Expectation struct {
		Code     connect.Code
		Response *v1.ListWorkspacesResponse
	}

	tests := []struct {
		Name        string
		Workspaces  []*protocol.WorkspaceInfo
		PageSize    int32
		Setup       func(t *testing.T, srv *protocol.MockAPIInterface)
		Expectation Expectation
	}{
		{
			Name:       "empty list",
			Workspaces: []*protocol.WorkspaceInfo{},
			Expectation: Expectation{
				Response: &v1.ListWorkspacesResponse{},
			},
		},
		{
			Name: "valid workspaces",
			Workspaces: []*protocol.WorkspaceInfo{
				&workspaceTestData[0].Protocol,
			},
			Expectation: Expectation{
				Response: &v1.ListWorkspacesResponse{
					Result: []*v1.Workspace{
						workspaceTestData[0].API,
					},
				},
			},
		},
		{
			Name: "invalid workspaces",
			Workspaces: func() []*protocol.WorkspaceInfo {
				ws := workspaceTestData[0].Protocol
				wsi := *workspaceTestData[0].Protocol.LatestInstance
				wsi.CreationTime = "invalid date"
				ws.LatestInstance = &wsi
				return []*protocol.WorkspaceInfo{&ws}
			}(),
			Expectation: Expectation{
				Code: connect.CodeFailedPrecondition,
			},
		},
		{
			Name: "valid page size",
			Setup: func(t *testing.T, srv *protocol.MockAPIInterface) {
				srv.EXPECT().GetWorkspaces(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, options *protocol.GetWorkspacesOptions) (res []*protocol.WorkspaceInfo, err error) {
					// Note: using to gomock argument matcher causes the test to block indefinitely instead of failing.
					if int(options.Limit) != 42 {
						t.Errorf("public-api passed from limit: %f instead of 42", options.Limit)
					}
					return nil, nil
				})
			},
			PageSize: 42,
			Expectation: Expectation{
				Response: &v1.ListWorkspacesResponse{},
			},
		},
		{
			Name:     "excessive page size",
			PageSize: 1000,
			Expectation: Expectation{
				Code: connect.CodeInvalidArgument,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var pagination *v1.Pagination
			if test.PageSize != 0 {
				pagination = &v1.Pagination{PageSize: test.PageSize}
			}

			serverMock, client := setupWorkspacesService(t)

			if test.Workspaces != nil {
				serverMock.EXPECT().GetWorkspaces(gomock.Any(), gomock.Any()).Return(test.Workspaces, nil)
			} else if test.Setup != nil {
				test.Setup(t, serverMock)
			}

			resp, err := client.ListWorkspaces(ctx, connect.NewRequest(&v1.ListWorkspacesRequest{
				Pagination: pagination,
			}))
			requireErrorCode(t, test.Expectation.Code, err)

			if test.Expectation.Response != nil {
				if diff := cmp.Diff(test.Expectation.Response, resp.Msg, protocmp.Transform()); diff != "" {
					t.Errorf("unexpected difference:\n%v", diff)
				}
			}
		})
	}
}

func TestWorkspaceService_StreamWorkspaceStatus(t *testing.T) {
	const (
		workspaceID = "easycz-seer-xl8o1zacpyw"
		instanceID  = "f2effcfd-3ddb-4187-b584-256e88a42442"
		ownerToken  = "some-owner-token"
	)

	t.Run("not found when workspace does not exist", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().GetWorkspace(gomock.Any(), workspaceID).Return(nil, &jsonrpc2.Error{
			Code:    404,
			Message: "not found",
		})

		resp, _ := client.StreamWorkspaceStatus(context.Background(), connect.NewRequest(&v1.StreamWorkspaceStatusRequest{
			WorkspaceId: workspaceID,
		}))

		resp.Receive()

		require.Error(t, resp.Err())
		require.Equal(t, connect.CodeNotFound, connect.CodeOf(resp.Err()))
	})

	t.Run("returns a workspace status", func(t *testing.T) {
		serverMock, client := setupWorkspacesService(t)

		serverMock.EXPECT().GetWorkspace(gomock.Any(), workspaceID).Return(&workspaceTestData[0].Protocol, nil)
		serverMock.EXPECT().InstanceUpdates(gomock.Any(), instanceID).DoAndReturn(func(ctx context.Context, instanceID string) (<-chan *protocol.WorkspaceInstance, error) {
			ch := make(chan *protocol.WorkspaceInstance)
			go func() {
				ch <- workspaceTestData[0].Protocol.LatestInstance
			}()
			go func() {
				<-ctx.Done()
				close(ch)
			}()
			return ch, nil
		})

		ctx, cancel := context.WithCancel(context.Background())
		resp, err := client.StreamWorkspaceStatus(ctx, connect.NewRequest(&v1.StreamWorkspaceStatusRequest{
			WorkspaceId: workspaceID,
		}))

		require.NoError(t, err)

		resp.Receive()
		cancel()

		requireEqualProto(t, workspaceTestData[0].API.Status, resp.Msg().Result)
	})
}

func TestClientServerStreamInterceptor(t *testing.T) {
	testInterceptor := &TestInterceptor{
		expectedToken: "auth-token",
		t:             t,
	}

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewWorkspaceService(&FakeServerConnPool{
		api: serverMock,
	})

	_, handler := v1connect.NewWorkspacesServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor(), testInterceptor))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewWorkspacesServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
		testInterceptor,
	))

	resp, _ := client.StreamWorkspaceStatus(context.Background(), connect.NewRequest(&v1.StreamWorkspaceStatusRequest{
		WorkspaceId: "",
	}))

	resp.Close()
}

type TestInterceptor struct {
	expectedToken string
	t             *testing.T
}

func (ti *TestInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		return next(ctx, req)
	}
}

func (ti *TestInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		token, _ := auth.TokenFromContext(ctx)
		require.Equal(ti.t, ti.expectedToken, token.Value)
		return next(ctx, spec)
	}
}

func (ti *TestInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		token, _ := auth.TokenFromContext(ctx)
		require.Equal(ti.t, ti.expectedToken, token.Value)
		return next(ctx, conn)
	}
}

type workspaceTestDataEntry struct {
	Name     string
	Protocol protocol.WorkspaceInfo
	API      *v1.Workspace
}

var workspaceTestData = []workspaceTestDataEntry{
	{
		Name: "comprehensive",
		Protocol: protocol.WorkspaceInfo{
			Workspace: &protocol.Workspace{
				BaseImageNameResolved: "foo:bar",
				ID:                    "gitpodio-gitpod-isq6xj458lj",
				OwnerID:               "fake-owner-id",
				ContextURL:            "https://github.com/gitpod-io/gitpod",
				Context: &protocol.WorkspaceContext{
					NormalizedContextURL: "https://github.com/gitpod-io/protocol.git",
					Title:                "tes ttitle",
				},
				Description: "test description",
			},
			LatestInstance: &protocol.WorkspaceInstance{
				ID:           "f2effcfd-3ddb-4187-b584-256e88a42442",
				IdeURL:       "https://gitpodio-gitpod-isq6xj458lj.ws-eu53.protocol.io/",
				CreationTime: "2022-07-12T10:04:49+0000",
				WorkspaceID:  "gitpodio-gitpod-isq6xj458lj",
				Status: &protocol.WorkspaceInstanceStatus{
					Conditions: &protocol.WorkspaceInstanceConditions{
						Failed:            "nope",
						FirstUserActivity: "2022-07-12T10:04:49+0000",
						Timeout:           "nada",
					},
					Message: "has no message",
					Phase:   "running",
					Version: 42,
					ExposedPorts: []*protocol.WorkspaceInstancePort{
						{
							Port:       9000,
							URL:        "https://9000-gitpodio-gitpod-isq6xj458lj.ws-eu53.protocol.io",
							Visibility: protocol.PortVisibilityPublic,
							Protocol:   protocol.PortProtocolHTTP,
						},
						{
							Port:       9001,
							URL:        "https://9001-gitpodio-gitpod-isq6xj458lj.ws-eu53.protocol.io",
							Visibility: protocol.PortVisibilityPrivate,
							Protocol:   protocol.PortProtocolHTTPS,
						},
					},
				},
			},
		},
		API: &v1.Workspace{
			WorkspaceId: "gitpodio-gitpod-isq6xj458lj",
			OwnerId:     "fake-owner-id",
			Context: &v1.WorkspaceContext{
				ContextUrl: "https://github.com/gitpod-io/gitpod",
				Details: &v1.WorkspaceContext_Git_{
					Git: &v1.WorkspaceContext_Git{
						NormalizedContextUrl: "https://github.com/gitpod-io/gitpod",
					},
				},
			},
			Description: "test description",
			Status: &v1.WorkspaceStatus{
				Instance: &v1.WorkspaceInstance{
					InstanceId:  "f2effcfd-3ddb-4187-b584-256e88a42442",
					WorkspaceId: "gitpodio-gitpod-isq6xj458lj",
					CreatedAt:   timestamppb.New(must(time.Parse(time.RFC3339, "2022-07-12T10:04:49Z"))),
					Status: &v1.WorkspaceInstanceStatus{
						StatusVersion: 42,
						Phase:         v1.WorkspaceInstanceStatus_PHASE_RUNNING,
						Conditions: &v1.WorkspaceInstanceStatus_Conditions{
							Failed:            "nope",
							Timeout:           "nada",
							FirstUserActivity: timestamppb.New(must(time.Parse(time.RFC3339, "2022-07-12T10:04:49Z"))),
						},
						Message:   "has no message",
						Url:       "https://gitpodio-gitpod-isq6xj458lj.ws-eu53.protocol.io/",
						Admission: v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY,
						Ports: []*v1.Port{
							{
								Port:     9000,
								Policy:   v1.PortPolicy_PORT_POLICY_PUBLIC,
								Url:      "https://9000-gitpodio-gitpod-isq6xj458lj.ws-eu53.protocol.io",
								Protocol: v1.PortProtocol_PORT_PROTOCOL_HTTP,
							},
							{
								Port:     9001,
								Policy:   v1.PortPolicy_PORT_POLICY_PRIVATE,
								Url:      "https://9001-gitpodio-gitpod-isq6xj458lj.ws-eu53.protocol.io",
								Protocol: v1.PortProtocol_PORT_PROTOCOL_HTTPS,
							},
						},
					},
				},
			},
		},
	},
}

func TestConvertWorkspaceInfo(t *testing.T) {
	type Expectation struct {
		Result *v1.Workspace
		Error  string
	}
	tests := []struct {
		Name        string
		Input       protocol.WorkspaceInfo
		Expectation Expectation
	}{
		{
			Name:        "happy path",
			Input:       workspaceTestData[0].Protocol,
			Expectation: Expectation{Result: workspaceTestData[0].API},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var (
				act Expectation
				err error
			)
			act.Result, err = convertWorkspaceInfo(&test.Input)
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act, protocmp.Transform()); diff != "" {
				t.Errorf("unexpected convertWorkspaceInfo (-want +got):\n%s", diff)
			}
		})
	}
}

func FuzzConvertWorkspaceInfo(f *testing.F) {
	f.Fuzz(func(t *testing.T, data []byte) {
		var nfo protocol.WorkspaceInfo
		err := fuzz.NewConsumer(data).GenerateStruct(&nfo)
		if err != nil {
			return
		}

		// we really just care for panics
		_, _ = convertWorkspaceInfo(&nfo)
	})
}

func must[T any](t T, err error) T {
	if err != nil {
		panic(err)
	}
	return t
}

func setupWorkspacesService(t *testing.T) (*protocol.MockAPIInterface, v1connect.WorkspacesServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewWorkspaceService(&FakeServerConnPool{
		api: serverMock,
	})

	_, handler := v1connect.NewWorkspacesServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor()))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewWorkspacesServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}

type FakeServerConnPool struct {
	api protocol.APIInterface
}

func (f *FakeServerConnPool) Get(ctx context.Context, token auth.Token) (protocol.APIInterface, error) {
	return f.api, nil
}

func requireErrorCode(t *testing.T, expected connect.Code, err error) {
	t.Helper()
	if expected == 0 && err == nil {
		return
	}

	actual := connect.CodeOf(err)
	require.Equal(t, expected, actual, "expected code %s, but got %s from error %v", expected.String(), actual.String(), err)
}

func mustGenerateWorkspaceID(t *testing.T) string {
	t.Helper()

	wsid, err := namegen.GenerateWorkspaceID()
	require.NoError(t, err)

	return wsid
}
