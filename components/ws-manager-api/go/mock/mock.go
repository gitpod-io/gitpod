// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/gitpod-io/gitpod/ws-manager/api (interfaces: WorkspaceManager_SubscribeServer,WorkspaceManagerServer,WorkspaceManager_SubscribeClient,WorkspaceManagerClient)

// Package mock is a generated GoMock package.
package mock

import (
	context "context"
	reflect "reflect"

	api "github.com/gitpod-io/gitpod/ws-manager/api"
	gomock "github.com/golang/mock/gomock"
	grpc "google.golang.org/grpc"
	metadata "google.golang.org/grpc/metadata"
)

// MockWorkspaceManager_SubscribeServer is a mock of WorkspaceManager_SubscribeServer interface.
type MockWorkspaceManager_SubscribeServer struct {
	ctrl     *gomock.Controller
	recorder *MockWorkspaceManager_SubscribeServerMockRecorder
}

// MockWorkspaceManager_SubscribeServerMockRecorder is the mock recorder for MockWorkspaceManager_SubscribeServer.
type MockWorkspaceManager_SubscribeServerMockRecorder struct {
	mock *MockWorkspaceManager_SubscribeServer
}

// NewMockWorkspaceManager_SubscribeServer creates a new mock instance.
func NewMockWorkspaceManager_SubscribeServer(ctrl *gomock.Controller) *MockWorkspaceManager_SubscribeServer {
	mock := &MockWorkspaceManager_SubscribeServer{ctrl: ctrl}
	mock.recorder = &MockWorkspaceManager_SubscribeServerMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockWorkspaceManager_SubscribeServer) EXPECT() *MockWorkspaceManager_SubscribeServerMockRecorder {
	return m.recorder
}

// Context mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) Context() context.Context {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Context")
	ret0, _ := ret[0].(context.Context)
	return ret0
}

// Context indicates an expected call of Context.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) Context() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Context", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).Context))
}

// RecvMsg mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) RecvMsg(arg0 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RecvMsg", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// RecvMsg indicates an expected call of RecvMsg.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) RecvMsg(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RecvMsg", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).RecvMsg), arg0)
}

// Send mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) Send(arg0 *api.SubscribeResponse) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Send", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// Send indicates an expected call of Send.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) Send(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Send", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).Send), arg0)
}

// SendHeader mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) SendHeader(arg0 metadata.MD) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SendHeader", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// SendHeader indicates an expected call of SendHeader.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) SendHeader(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SendHeader", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).SendHeader), arg0)
}

// SendMsg mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) SendMsg(arg0 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SendMsg", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// SendMsg indicates an expected call of SendMsg.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) SendMsg(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SendMsg", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).SendMsg), arg0)
}

// SetHeader mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) SetHeader(arg0 metadata.MD) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetHeader", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// SetHeader indicates an expected call of SetHeader.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) SetHeader(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetHeader", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).SetHeader), arg0)
}

// SetTrailer mocks base method.
func (m *MockWorkspaceManager_SubscribeServer) SetTrailer(arg0 metadata.MD) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "SetTrailer", arg0)
}

// SetTrailer indicates an expected call of SetTrailer.
func (mr *MockWorkspaceManager_SubscribeServerMockRecorder) SetTrailer(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetTrailer", reflect.TypeOf((*MockWorkspaceManager_SubscribeServer)(nil).SetTrailer), arg0)
}

// MockWorkspaceManagerServer is a mock of WorkspaceManagerServer interface.
type MockWorkspaceManagerServer struct {
	ctrl     *gomock.Controller
	recorder *MockWorkspaceManagerServerMockRecorder
}

// MockWorkspaceManagerServerMockRecorder is the mock recorder for MockWorkspaceManagerServer.
type MockWorkspaceManagerServerMockRecorder struct {
	mock *MockWorkspaceManagerServer
}

// NewMockWorkspaceManagerServer creates a new mock instance.
func NewMockWorkspaceManagerServer(ctrl *gomock.Controller) *MockWorkspaceManagerServer {
	mock := &MockWorkspaceManagerServer{ctrl: ctrl}
	mock.recorder = &MockWorkspaceManagerServerMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockWorkspaceManagerServer) EXPECT() *MockWorkspaceManagerServerMockRecorder {
	return m.recorder
}

// ControlAdmission mocks base method.
func (m *MockWorkspaceManagerServer) ControlAdmission(arg0 context.Context, arg1 *api.ControlAdmissionRequest) (*api.ControlAdmissionResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ControlAdmission", arg0, arg1)
	ret0, _ := ret[0].(*api.ControlAdmissionResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// ControlAdmission indicates an expected call of ControlAdmission.
func (mr *MockWorkspaceManagerServerMockRecorder) ControlAdmission(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ControlAdmission", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).ControlAdmission), arg0, arg1)
}

// ControlPort mocks base method.
func (m *MockWorkspaceManagerServer) ControlPort(arg0 context.Context, arg1 *api.ControlPortRequest) (*api.ControlPortResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ControlPort", arg0, arg1)
	ret0, _ := ret[0].(*api.ControlPortResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// ControlPort indicates an expected call of ControlPort.
func (mr *MockWorkspaceManagerServerMockRecorder) ControlPort(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ControlPort", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).ControlPort), arg0, arg1)
}

// DescribeWorkspace mocks base method.
func (m *MockWorkspaceManagerServer) DescribeWorkspace(arg0 context.Context, arg1 *api.DescribeWorkspaceRequest) (*api.DescribeWorkspaceResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DescribeWorkspace", arg0, arg1)
	ret0, _ := ret[0].(*api.DescribeWorkspaceResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// DescribeWorkspace indicates an expected call of DescribeWorkspace.
func (mr *MockWorkspaceManagerServerMockRecorder) DescribeWorkspace(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DescribeWorkspace", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).DescribeWorkspace), arg0, arg1)
}

// GetWorkspaces mocks base method.
func (m *MockWorkspaceManagerServer) GetWorkspaces(arg0 context.Context, arg1 *api.GetWorkspacesRequest) (*api.GetWorkspacesResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetWorkspaces", arg0, arg1)
	ret0, _ := ret[0].(*api.GetWorkspacesResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspaces indicates an expected call of GetWorkspaces.
func (mr *MockWorkspaceManagerServerMockRecorder) GetWorkspaces(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspaces", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).GetWorkspaces), arg0, arg1)
}

// MarkActive mocks base method.
func (m *MockWorkspaceManagerServer) MarkActive(arg0 context.Context, arg1 *api.MarkActiveRequest) (*api.MarkActiveResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "MarkActive", arg0, arg1)
	ret0, _ := ret[0].(*api.MarkActiveResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// MarkActive indicates an expected call of MarkActive.
func (mr *MockWorkspaceManagerServerMockRecorder) MarkActive(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "MarkActive", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).MarkActive), arg0, arg1)
}

// SetTimeout mocks base method.
func (m *MockWorkspaceManagerServer) SetTimeout(arg0 context.Context, arg1 *api.SetTimeoutRequest) (*api.SetTimeoutResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetTimeout", arg0, arg1)
	ret0, _ := ret[0].(*api.SetTimeoutResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// SetTimeout indicates an expected call of SetTimeout.
func (mr *MockWorkspaceManagerServerMockRecorder) SetTimeout(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetTimeout", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).SetTimeout), arg0, arg1)
}

// StartWorkspace mocks base method.
func (m *MockWorkspaceManagerServer) StartWorkspace(arg0 context.Context, arg1 *api.StartWorkspaceRequest) (*api.StartWorkspaceResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "StartWorkspace", arg0, arg1)
	ret0, _ := ret[0].(*api.StartWorkspaceResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// StartWorkspace indicates an expected call of StartWorkspace.
func (mr *MockWorkspaceManagerServerMockRecorder) StartWorkspace(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StartWorkspace", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).StartWorkspace), arg0, arg1)
}

// StopWorkspace mocks base method.
func (m *MockWorkspaceManagerServer) StopWorkspace(arg0 context.Context, arg1 *api.StopWorkspaceRequest) (*api.StopWorkspaceResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "StopWorkspace", arg0, arg1)
	ret0, _ := ret[0].(*api.StopWorkspaceResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// StopWorkspace indicates an expected call of StopWorkspace.
func (mr *MockWorkspaceManagerServerMockRecorder) StopWorkspace(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StopWorkspace", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).StopWorkspace), arg0, arg1)
}

// Subscribe mocks base method.
func (m *MockWorkspaceManagerServer) Subscribe(arg0 *api.SubscribeRequest, arg1 api.WorkspaceManager_SubscribeServer) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Subscribe", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// Subscribe indicates an expected call of Subscribe.
func (mr *MockWorkspaceManagerServerMockRecorder) Subscribe(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Subscribe", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).Subscribe), arg0, arg1)
}

// TakeSnapshot mocks base method.
func (m *MockWorkspaceManagerServer) TakeSnapshot(arg0 context.Context, arg1 *api.TakeSnapshotRequest) (*api.TakeSnapshotResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "TakeSnapshot", arg0, arg1)
	ret0, _ := ret[0].(*api.TakeSnapshotResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// TakeSnapshot indicates an expected call of TakeSnapshot.
func (mr *MockWorkspaceManagerServerMockRecorder) TakeSnapshot(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "TakeSnapshot", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).TakeSnapshot), arg0, arg1)
}

// mustEmbedUnimplementedWorkspaceManagerServer mocks base method.
func (m *MockWorkspaceManagerServer) mustEmbedUnimplementedWorkspaceManagerServer() {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "mustEmbedUnimplementedWorkspaceManagerServer")
}

// mustEmbedUnimplementedWorkspaceManagerServer indicates an expected call of mustEmbedUnimplementedWorkspaceManagerServer.
func (mr *MockWorkspaceManagerServerMockRecorder) mustEmbedUnimplementedWorkspaceManagerServer() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "mustEmbedUnimplementedWorkspaceManagerServer", reflect.TypeOf((*MockWorkspaceManagerServer)(nil).mustEmbedUnimplementedWorkspaceManagerServer))
}

// MockWorkspaceManager_SubscribeClient is a mock of WorkspaceManager_SubscribeClient interface.
type MockWorkspaceManager_SubscribeClient struct {
	ctrl     *gomock.Controller
	recorder *MockWorkspaceManager_SubscribeClientMockRecorder
}

// MockWorkspaceManager_SubscribeClientMockRecorder is the mock recorder for MockWorkspaceManager_SubscribeClient.
type MockWorkspaceManager_SubscribeClientMockRecorder struct {
	mock *MockWorkspaceManager_SubscribeClient
}

// NewMockWorkspaceManager_SubscribeClient creates a new mock instance.
func NewMockWorkspaceManager_SubscribeClient(ctrl *gomock.Controller) *MockWorkspaceManager_SubscribeClient {
	mock := &MockWorkspaceManager_SubscribeClient{ctrl: ctrl}
	mock.recorder = &MockWorkspaceManager_SubscribeClientMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockWorkspaceManager_SubscribeClient) EXPECT() *MockWorkspaceManager_SubscribeClientMockRecorder {
	return m.recorder
}

// CloseSend mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) CloseSend() error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CloseSend")
	ret0, _ := ret[0].(error)
	return ret0
}

// CloseSend indicates an expected call of CloseSend.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) CloseSend() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CloseSend", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).CloseSend))
}

// Context mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) Context() context.Context {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Context")
	ret0, _ := ret[0].(context.Context)
	return ret0
}

// Context indicates an expected call of Context.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) Context() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Context", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).Context))
}

// Header mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) Header() (metadata.MD, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Header")
	ret0, _ := ret[0].(metadata.MD)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Header indicates an expected call of Header.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) Header() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Header", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).Header))
}

// Recv mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) Recv() (*api.SubscribeResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Recv")
	ret0, _ := ret[0].(*api.SubscribeResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Recv indicates an expected call of Recv.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) Recv() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Recv", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).Recv))
}

// RecvMsg mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) RecvMsg(arg0 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RecvMsg", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// RecvMsg indicates an expected call of RecvMsg.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) RecvMsg(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RecvMsg", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).RecvMsg), arg0)
}

// SendMsg mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) SendMsg(arg0 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SendMsg", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// SendMsg indicates an expected call of SendMsg.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) SendMsg(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SendMsg", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).SendMsg), arg0)
}

// Trailer mocks base method.
func (m *MockWorkspaceManager_SubscribeClient) Trailer() metadata.MD {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Trailer")
	ret0, _ := ret[0].(metadata.MD)
	return ret0
}

// Trailer indicates an expected call of Trailer.
func (mr *MockWorkspaceManager_SubscribeClientMockRecorder) Trailer() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Trailer", reflect.TypeOf((*MockWorkspaceManager_SubscribeClient)(nil).Trailer))
}

// MockWorkspaceManagerClient is a mock of WorkspaceManagerClient interface.
type MockWorkspaceManagerClient struct {
	ctrl     *gomock.Controller
	recorder *MockWorkspaceManagerClientMockRecorder
}

// MockWorkspaceManagerClientMockRecorder is the mock recorder for MockWorkspaceManagerClient.
type MockWorkspaceManagerClientMockRecorder struct {
	mock *MockWorkspaceManagerClient
}

// NewMockWorkspaceManagerClient creates a new mock instance.
func NewMockWorkspaceManagerClient(ctrl *gomock.Controller) *MockWorkspaceManagerClient {
	mock := &MockWorkspaceManagerClient{ctrl: ctrl}
	mock.recorder = &MockWorkspaceManagerClientMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockWorkspaceManagerClient) EXPECT() *MockWorkspaceManagerClientMockRecorder {
	return m.recorder
}

// ControlAdmission mocks base method.
func (m *MockWorkspaceManagerClient) ControlAdmission(arg0 context.Context, arg1 *api.ControlAdmissionRequest, arg2 ...grpc.CallOption) (*api.ControlAdmissionResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "ControlAdmission", varargs...)
	ret0, _ := ret[0].(*api.ControlAdmissionResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// ControlAdmission indicates an expected call of ControlAdmission.
func (mr *MockWorkspaceManagerClientMockRecorder) ControlAdmission(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ControlAdmission", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).ControlAdmission), varargs...)
}

// ControlPort mocks base method.
func (m *MockWorkspaceManagerClient) ControlPort(arg0 context.Context, arg1 *api.ControlPortRequest, arg2 ...grpc.CallOption) (*api.ControlPortResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "ControlPort", varargs...)
	ret0, _ := ret[0].(*api.ControlPortResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// ControlPort indicates an expected call of ControlPort.
func (mr *MockWorkspaceManagerClientMockRecorder) ControlPort(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ControlPort", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).ControlPort), varargs...)
}

// DescribeWorkspace mocks base method.
func (m *MockWorkspaceManagerClient) DescribeWorkspace(arg0 context.Context, arg1 *api.DescribeWorkspaceRequest, arg2 ...grpc.CallOption) (*api.DescribeWorkspaceResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "DescribeWorkspace", varargs...)
	ret0, _ := ret[0].(*api.DescribeWorkspaceResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// DescribeWorkspace indicates an expected call of DescribeWorkspace.
func (mr *MockWorkspaceManagerClientMockRecorder) DescribeWorkspace(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DescribeWorkspace", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).DescribeWorkspace), varargs...)
}

// GetWorkspaces mocks base method.
func (m *MockWorkspaceManagerClient) GetWorkspaces(arg0 context.Context, arg1 *api.GetWorkspacesRequest, arg2 ...grpc.CallOption) (*api.GetWorkspacesResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "GetWorkspaces", varargs...)
	ret0, _ := ret[0].(*api.GetWorkspacesResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspaces indicates an expected call of GetWorkspaces.
func (mr *MockWorkspaceManagerClientMockRecorder) GetWorkspaces(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspaces", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).GetWorkspaces), varargs...)
}

// MarkActive mocks base method.
func (m *MockWorkspaceManagerClient) MarkActive(arg0 context.Context, arg1 *api.MarkActiveRequest, arg2 ...grpc.CallOption) (*api.MarkActiveResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "MarkActive", varargs...)
	ret0, _ := ret[0].(*api.MarkActiveResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// MarkActive indicates an expected call of MarkActive.
func (mr *MockWorkspaceManagerClientMockRecorder) MarkActive(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "MarkActive", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).MarkActive), varargs...)
}

// SetTimeout mocks base method.
func (m *MockWorkspaceManagerClient) SetTimeout(arg0 context.Context, arg1 *api.SetTimeoutRequest, arg2 ...grpc.CallOption) (*api.SetTimeoutResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "SetTimeout", varargs...)
	ret0, _ := ret[0].(*api.SetTimeoutResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// SetTimeout indicates an expected call of SetTimeout.
func (mr *MockWorkspaceManagerClientMockRecorder) SetTimeout(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetTimeout", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).SetTimeout), varargs...)
}

// StartWorkspace mocks base method.
func (m *MockWorkspaceManagerClient) StartWorkspace(arg0 context.Context, arg1 *api.StartWorkspaceRequest, arg2 ...grpc.CallOption) (*api.StartWorkspaceResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "StartWorkspace", varargs...)
	ret0, _ := ret[0].(*api.StartWorkspaceResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// StartWorkspace indicates an expected call of StartWorkspace.
func (mr *MockWorkspaceManagerClientMockRecorder) StartWorkspace(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StartWorkspace", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).StartWorkspace), varargs...)
}

// StopWorkspace mocks base method.
func (m *MockWorkspaceManagerClient) StopWorkspace(arg0 context.Context, arg1 *api.StopWorkspaceRequest, arg2 ...grpc.CallOption) (*api.StopWorkspaceResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "StopWorkspace", varargs...)
	ret0, _ := ret[0].(*api.StopWorkspaceResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// StopWorkspace indicates an expected call of StopWorkspace.
func (mr *MockWorkspaceManagerClientMockRecorder) StopWorkspace(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StopWorkspace", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).StopWorkspace), varargs...)
}

// Subscribe mocks base method.
func (m *MockWorkspaceManagerClient) Subscribe(arg0 context.Context, arg1 *api.SubscribeRequest, arg2 ...grpc.CallOption) (api.WorkspaceManager_SubscribeClient, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "Subscribe", varargs...)
	ret0, _ := ret[0].(api.WorkspaceManager_SubscribeClient)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Subscribe indicates an expected call of Subscribe.
func (mr *MockWorkspaceManagerClientMockRecorder) Subscribe(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Subscribe", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).Subscribe), varargs...)
}

// TakeSnapshot mocks base method.
func (m *MockWorkspaceManagerClient) TakeSnapshot(arg0 context.Context, arg1 *api.TakeSnapshotRequest, arg2 ...grpc.CallOption) (*api.TakeSnapshotResponse, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "TakeSnapshot", varargs...)
	ret0, _ := ret[0].(*api.TakeSnapshotResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// TakeSnapshot indicates an expected call of TakeSnapshot.
func (mr *MockWorkspaceManagerClientMockRecorder) TakeSnapshot(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "TakeSnapshot", reflect.TypeOf((*MockWorkspaceManagerClient)(nil).TakeSnapshot), varargs...)
}
