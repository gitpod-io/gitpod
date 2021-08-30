// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by MockGen. DO NOT EDIT.
// Source: gitpod-service.go

// Package protocol is a generated GoMock package.
package protocol

import (
	context "context"
	reflect "reflect"

	gomock "github.com/golang/mock/gomock"
)

// MockAPIInterface is a mock of APIInterface interface.
type MockAPIInterface struct {
	ctrl     *gomock.Controller
	recorder *MockAPIInterfaceMockRecorder
}

// MockAPIInterfaceMockRecorder is the mock recorder for MockAPIInterface.
type MockAPIInterfaceMockRecorder struct {
	mock *MockAPIInterface
}

// NewMockAPIInterface creates a new mock instance.
func NewMockAPIInterface(ctrl *gomock.Controller) *MockAPIInterface {
	mock := &MockAPIInterface{ctrl: ctrl}
	mock.recorder = &MockAPIInterfaceMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockAPIInterface) EXPECT() *MockAPIInterfaceMockRecorder {
	return m.recorder
}

// AdminBlockUser mocks base method.
func (m *MockAPIInterface) AdminBlockUser(ctx context.Context, req *AdminBlockUserRequest) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "AdminBlockUser", ctx, req)
	ret0, _ := ret[0].(error)
	return ret0
}

// AdminBlockUser indicates an expected call of AdminBlockUser.
func (mr *MockAPIInterfaceMockRecorder) AdminBlockUser(ctx, req interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AdminBlockUser", reflect.TypeOf((*MockAPIInterface)(nil).AdminBlockUser), ctx, req)
}

// ClosePort mocks base method.
func (m *MockAPIInterface) ClosePort(ctx context.Context, workspaceID string, port float32) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ClosePort", ctx, workspaceID, port)
	ret0, _ := ret[0].(error)
	return ret0
}

// ClosePort indicates an expected call of ClosePort.
func (mr *MockAPIInterfaceMockRecorder) ClosePort(ctx, workspaceID, port interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ClosePort", reflect.TypeOf((*MockAPIInterface)(nil).ClosePort), ctx, workspaceID, port)
}

// ControlAdmission mocks base method.
func (m *MockAPIInterface) ControlAdmission(ctx context.Context, id string, level *AdmissionLevel) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ControlAdmission", ctx, id, level)
	ret0, _ := ret[0].(error)
	return ret0
}

// ControlAdmission indicates an expected call of ControlAdmission.
func (mr *MockAPIInterfaceMockRecorder) ControlAdmission(ctx, id, level interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ControlAdmission", reflect.TypeOf((*MockAPIInterface)(nil).ControlAdmission), ctx, id, level)
}

// CreateWorkspace mocks base method.
func (m *MockAPIInterface) CreateWorkspace(ctx context.Context, options *CreateWorkspaceOptions) (*WorkspaceCreationResult, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CreateWorkspace", ctx, options)
	ret0, _ := ret[0].(*WorkspaceCreationResult)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// CreateWorkspace indicates an expected call of CreateWorkspace.
func (mr *MockAPIInterfaceMockRecorder) CreateWorkspace(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CreateWorkspace", reflect.TypeOf((*MockAPIInterface)(nil).CreateWorkspace), ctx, options)
}

// DeleteAccount mocks base method.
func (m *MockAPIInterface) DeleteAccount(ctx context.Context) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DeleteAccount", ctx)
	ret0, _ := ret[0].(error)
	return ret0
}

// DeleteAccount indicates an expected call of DeleteAccount.
func (mr *MockAPIInterfaceMockRecorder) DeleteAccount(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DeleteAccount", reflect.TypeOf((*MockAPIInterface)(nil).DeleteAccount), ctx)
}

// DeleteEnvVar mocks base method.
func (m *MockAPIInterface) DeleteEnvVar(ctx context.Context, variable *UserEnvVarValue) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DeleteEnvVar", ctx, variable)
	ret0, _ := ret[0].(error)
	return ret0
}

// DeleteEnvVar indicates an expected call of DeleteEnvVar.
func (mr *MockAPIInterfaceMockRecorder) DeleteEnvVar(ctx, variable interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DeleteEnvVar", reflect.TypeOf((*MockAPIInterface)(nil).DeleteEnvVar), ctx, variable)
}

// DeleteGitpodToken mocks base method.
func (m *MockAPIInterface) DeleteGitpodToken(ctx context.Context, tokenHash string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DeleteGitpodToken", ctx, tokenHash)
	ret0, _ := ret[0].(error)
	return ret0
}

// DeleteGitpodToken indicates an expected call of DeleteGitpodToken.
func (mr *MockAPIInterfaceMockRecorder) DeleteGitpodToken(ctx, tokenHash interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DeleteGitpodToken", reflect.TypeOf((*MockAPIInterface)(nil).DeleteGitpodToken), ctx, tokenHash)
}

// DeleteOwnAuthProvider mocks base method.
func (m *MockAPIInterface) DeleteOwnAuthProvider(ctx context.Context, params *DeleteOwnAuthProviderParams) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DeleteOwnAuthProvider", ctx, params)
	ret0, _ := ret[0].(error)
	return ret0
}

// DeleteOwnAuthProvider indicates an expected call of DeleteOwnAuthProvider.
func (mr *MockAPIInterfaceMockRecorder) DeleteOwnAuthProvider(ctx, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DeleteOwnAuthProvider", reflect.TypeOf((*MockAPIInterface)(nil).DeleteOwnAuthProvider), ctx, params)
}

// DeleteWorkspace mocks base method.
func (m *MockAPIInterface) DeleteWorkspace(ctx context.Context, id string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DeleteWorkspace", ctx, id)
	ret0, _ := ret[0].(error)
	return ret0
}

// DeleteWorkspace indicates an expected call of DeleteWorkspace.
func (mr *MockAPIInterfaceMockRecorder) DeleteWorkspace(ctx, id interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DeleteWorkspace", reflect.TypeOf((*MockAPIInterface)(nil).DeleteWorkspace), ctx, id)
}

// GenerateNewGitpodToken mocks base method.
func (m *MockAPIInterface) GenerateNewGitpodToken(ctx context.Context, options *GenerateNewGitpodTokenOptions) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GenerateNewGitpodToken", ctx, options)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GenerateNewGitpodToken indicates an expected call of GenerateNewGitpodToken.
func (mr *MockAPIInterfaceMockRecorder) GenerateNewGitpodToken(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GenerateNewGitpodToken", reflect.TypeOf((*MockAPIInterface)(nil).GenerateNewGitpodToken), ctx, options)
}

// GetAuthProviders mocks base method.
func (m *MockAPIInterface) GetAuthProviders(ctx context.Context) ([]*AuthProviderInfo, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetAuthProviders", ctx)
	ret0, _ := ret[0].([]*AuthProviderInfo)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetAuthProviders indicates an expected call of GetAuthProviders.
func (mr *MockAPIInterfaceMockRecorder) GetAuthProviders(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetAuthProviders", reflect.TypeOf((*MockAPIInterface)(nil).GetAuthProviders), ctx)
}

// GetBranding mocks base method.
func (m *MockAPIInterface) GetBranding(ctx context.Context) (*Branding, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetBranding", ctx)
	ret0, _ := ret[0].(*Branding)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetBranding indicates an expected call of GetBranding.
func (mr *MockAPIInterfaceMockRecorder) GetBranding(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetBranding", reflect.TypeOf((*MockAPIInterface)(nil).GetBranding), ctx)
}

// GetClientRegion mocks base method.
func (m *MockAPIInterface) GetClientRegion(ctx context.Context) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetClientRegion", ctx)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetClientRegion indicates an expected call of GetClientRegion.
func (mr *MockAPIInterfaceMockRecorder) GetClientRegion(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetClientRegion", reflect.TypeOf((*MockAPIInterface)(nil).GetClientRegion), ctx)
}

// GetConfiguration mocks base method.
func (m *MockAPIInterface) GetConfiguration(ctx context.Context) (*Configuration, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetConfiguration", ctx)
	ret0, _ := ret[0].(*Configuration)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetConfiguration indicates an expected call of GetConfiguration.
func (mr *MockAPIInterfaceMockRecorder) GetConfiguration(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetConfiguration", reflect.TypeOf((*MockAPIInterface)(nil).GetConfiguration), ctx)
}

// GetContentBlobDownloadURL mocks base method.
func (m *MockAPIInterface) GetContentBlobDownloadURL(ctx context.Context, name string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetContentBlobDownloadURL", ctx, name)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetContentBlobDownloadURL indicates an expected call of GetContentBlobDownloadURL.
func (mr *MockAPIInterfaceMockRecorder) GetContentBlobDownloadURL(ctx, name interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetContentBlobDownloadURL", reflect.TypeOf((*MockAPIInterface)(nil).GetContentBlobDownloadURL), ctx, name)
}

// GetContentBlobUploadURL mocks base method.
func (m *MockAPIInterface) GetContentBlobUploadURL(ctx context.Context, name string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetContentBlobUploadURL", ctx, name)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetContentBlobUploadURL indicates an expected call of GetContentBlobUploadURL.
func (mr *MockAPIInterfaceMockRecorder) GetContentBlobUploadURL(ctx, name interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetContentBlobUploadURL", reflect.TypeOf((*MockAPIInterface)(nil).GetContentBlobUploadURL), ctx, name)
}

// GetEnvVars mocks base method.
func (m *MockAPIInterface) GetEnvVars(ctx context.Context) ([]*UserEnvVarValue, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetEnvVars", ctx)
	ret0, _ := ret[0].([]*UserEnvVarValue)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetEnvVars indicates an expected call of GetEnvVars.
func (mr *MockAPIInterfaceMockRecorder) GetEnvVars(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetEnvVars", reflect.TypeOf((*MockAPIInterface)(nil).GetEnvVars), ctx)
}

// GetFeaturedRepositories mocks base method.
func (m *MockAPIInterface) GetFeaturedRepositories(ctx context.Context) ([]*WhitelistedRepository, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetFeaturedRepositories", ctx)
	ret0, _ := ret[0].([]*WhitelistedRepository)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetFeaturedRepositories indicates an expected call of GetFeaturedRepositories.
func (mr *MockAPIInterfaceMockRecorder) GetFeaturedRepositories(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetFeaturedRepositories", reflect.TypeOf((*MockAPIInterface)(nil).GetFeaturedRepositories), ctx)
}

// GetGitpodTokens mocks base method.
func (m *MockAPIInterface) GetGitpodTokens(ctx context.Context) ([]*APIToken, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetGitpodTokens", ctx)
	ret0, _ := ret[0].([]*APIToken)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetGitpodTokens indicates an expected call of GetGitpodTokens.
func (mr *MockAPIInterfaceMockRecorder) GetGitpodTokens(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetGitpodTokens", reflect.TypeOf((*MockAPIInterface)(nil).GetGitpodTokens), ctx)
}

// GetLayout mocks base method.
func (m *MockAPIInterface) GetLayout(ctx context.Context, workspaceID string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetLayout", ctx, workspaceID)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetLayout indicates an expected call of GetLayout.
func (mr *MockAPIInterfaceMockRecorder) GetLayout(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetLayout", reflect.TypeOf((*MockAPIInterface)(nil).GetLayout), ctx, workspaceID)
}

// GetLoggedInUser mocks base method.
func (m *MockAPIInterface) GetLoggedInUser(ctx context.Context) (*User, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetLoggedInUser", ctx)
	ret0, _ := ret[0].(*User)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetLoggedInUser indicates an expected call of GetLoggedInUser.
func (mr *MockAPIInterfaceMockRecorder) GetLoggedInUser(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetLoggedInUser", reflect.TypeOf((*MockAPIInterface)(nil).GetLoggedInUser), ctx)
}

// GetOpenPorts mocks base method.
func (m *MockAPIInterface) GetOpenPorts(ctx context.Context, workspaceID string) ([]*WorkspaceInstancePort, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetOpenPorts", ctx, workspaceID)
	ret0, _ := ret[0].([]*WorkspaceInstancePort)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetOpenPorts indicates an expected call of GetOpenPorts.
func (mr *MockAPIInterfaceMockRecorder) GetOpenPorts(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetOpenPorts", reflect.TypeOf((*MockAPIInterface)(nil).GetOpenPorts), ctx, workspaceID)
}

// GetOwnAuthProviders mocks base method.
func (m *MockAPIInterface) GetOwnAuthProviders(ctx context.Context) ([]*AuthProviderEntry, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetOwnAuthProviders", ctx)
	ret0, _ := ret[0].([]*AuthProviderEntry)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetOwnAuthProviders indicates an expected call of GetOwnAuthProviders.
func (mr *MockAPIInterfaceMockRecorder) GetOwnAuthProviders(ctx interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetOwnAuthProviders", reflect.TypeOf((*MockAPIInterface)(nil).GetOwnAuthProviders), ctx)
}

// GetPortAuthenticationToken mocks base method.
func (m *MockAPIInterface) GetPortAuthenticationToken(ctx context.Context, workspaceID string) (*Token, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPortAuthenticationToken", ctx, workspaceID)
	ret0, _ := ret[0].(*Token)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPortAuthenticationToken indicates an expected call of GetPortAuthenticationToken.
func (mr *MockAPIInterfaceMockRecorder) GetPortAuthenticationToken(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPortAuthenticationToken", reflect.TypeOf((*MockAPIInterface)(nil).GetPortAuthenticationToken), ctx, workspaceID)
}

// GetSnapshots mocks base method.
func (m *MockAPIInterface) GetSnapshots(ctx context.Context, workspaceID string) ([]*string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetSnapshots", ctx, workspaceID)
	ret0, _ := ret[0].([]*string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetSnapshots indicates an expected call of GetSnapshots.
func (mr *MockAPIInterfaceMockRecorder) GetSnapshots(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetSnapshots", reflect.TypeOf((*MockAPIInterface)(nil).GetSnapshots), ctx, workspaceID)
}

// GetGitpodTokenScopes indicates an expected call of GetGitpodTokenScopes.
func (mr *MockAPIInterfaceMockRecorder) GetGitpodTokenScopes(ctx, tokenHash interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetGitpodTokenScopes", reflect.TypeOf((*MockAPIInterface)(nil).GetGitpodTokenScopes), ctx, tokenHash)
}

// GetGitpodTokenScopes mocks base method.
func (m *MockAPIInterface) GetGitpodTokenScopes(ctx context.Context, tokenHash string) ([]string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetGitpodTokenScopes", ctx, tokenHash)
	ret0, _ := ret[0].([]string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetToken mocks base method.
func (m *MockAPIInterface) GetToken(ctx context.Context, query *GetTokenSearchOptions) (*Token, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetToken", ctx, query)
	ret0, _ := ret[0].(*Token)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetToken indicates an expected call of GetToken.
func (mr *MockAPIInterfaceMockRecorder) GetToken(ctx, query interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetToken", reflect.TypeOf((*MockAPIInterface)(nil).GetToken), ctx, query)
}

// GetUserStorageResource mocks base method.
func (m *MockAPIInterface) GetUserStorageResource(ctx context.Context, options *GetUserStorageResourceOptions) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetUserStorageResource", ctx, options)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetUserStorageResource indicates an expected call of GetUserStorageResource.
func (mr *MockAPIInterfaceMockRecorder) GetUserStorageResource(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetUserStorageResource", reflect.TypeOf((*MockAPIInterface)(nil).GetUserStorageResource), ctx, options)
}

// GetWorkspace mocks base method.
func (m *MockAPIInterface) GetWorkspace(ctx context.Context, id string) (*WorkspaceInfo, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetWorkspace", ctx, id)
	ret0, _ := ret[0].(*WorkspaceInfo)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspace indicates an expected call of GetWorkspace.
func (mr *MockAPIInterfaceMockRecorder) GetWorkspace(ctx, id interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspace", reflect.TypeOf((*MockAPIInterface)(nil).GetWorkspace), ctx, id)
}

// GetWorkspaceOwner mocks base method.
func (m *MockAPIInterface) GetWorkspaceOwner(ctx context.Context, workspaceID string) (*UserInfo, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetWorkspaceOwner", ctx, workspaceID)
	ret0, _ := ret[0].(*UserInfo)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspaceOwner indicates an expected call of GetWorkspaceOwner.
func (mr *MockAPIInterfaceMockRecorder) GetWorkspaceOwner(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspaceOwner", reflect.TypeOf((*MockAPIInterface)(nil).GetWorkspaceOwner), ctx, workspaceID)
}

// GetWorkspaceTimeout mocks base method.
func (m *MockAPIInterface) GetWorkspaceTimeout(ctx context.Context, workspaceID string) (*GetWorkspaceTimeoutResult, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetWorkspaceTimeout", ctx, workspaceID)
	ret0, _ := ret[0].(*GetWorkspaceTimeoutResult)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspaceTimeout indicates an expected call of GetWorkspaceTimeout.
func (mr *MockAPIInterfaceMockRecorder) GetWorkspaceTimeout(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspaceTimeout", reflect.TypeOf((*MockAPIInterface)(nil).GetWorkspaceTimeout), ctx, workspaceID)
}

// GetWorkspaceUsers mocks base method.
func (m *MockAPIInterface) GetWorkspaceUsers(ctx context.Context, workspaceID string) ([]*WorkspaceInstanceUser, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetWorkspaceUsers", ctx, workspaceID)
	ret0, _ := ret[0].([]*WorkspaceInstanceUser)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspaceUsers indicates an expected call of GetWorkspaceUsers.
func (mr *MockAPIInterfaceMockRecorder) GetWorkspaceUsers(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspaceUsers", reflect.TypeOf((*MockAPIInterface)(nil).GetWorkspaceUsers), ctx, workspaceID)
}

// GetWorkspaces mocks base method.
func (m *MockAPIInterface) GetWorkspaces(ctx context.Context, options *GetWorkspacesOptions) ([]*WorkspaceInfo, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetWorkspaces", ctx, options)
	ret0, _ := ret[0].([]*WorkspaceInfo)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetWorkspaces indicates an expected call of GetWorkspaces.
func (mr *MockAPIInterfaceMockRecorder) GetWorkspaces(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetWorkspaces", reflect.TypeOf((*MockAPIInterface)(nil).GetWorkspaces), ctx, options)
}

// GuessGitTokenScopes mocks base method.
func (m *MockAPIInterface) GuessGitTokenScopes(ctx context.Context, params *GuessGitTokenScopesParams) (*GuessedGitTokenScopes, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GuessGitTokenScopes", ctx, params)
	ret0, _ := ret[0].(*GuessedGitTokenScopes)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GuessGitTokenScopes indicates an expected call of GuessGitTokenScopes.
func (mr *MockAPIInterfaceMockRecorder) GuessGitTokenScopes(ctx, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GuessGitTokenScopes", reflect.TypeOf((*MockAPIInterface)(nil).GuessGitTokenScopes), ctx, params)
}

// HasPermission mocks base method.
func (m *MockAPIInterface) HasPermission(ctx context.Context, permission *PermissionName) (bool, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "HasPermission", ctx, permission)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// HasPermission indicates an expected call of HasPermission.
func (mr *MockAPIInterfaceMockRecorder) HasPermission(ctx, permission interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "HasPermission", reflect.TypeOf((*MockAPIInterface)(nil).HasPermission), ctx, permission)
}

// InstallUserPlugins mocks base method.
func (m *MockAPIInterface) InstallUserPlugins(ctx context.Context, params *InstallPluginsParams) (bool, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "InstallUserPlugins", ctx, params)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// InstallUserPlugins indicates an expected call of InstallUserPlugins.
func (mr *MockAPIInterfaceMockRecorder) InstallUserPlugins(ctx, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "InstallUserPlugins", reflect.TypeOf((*MockAPIInterface)(nil).InstallUserPlugins), ctx, params)
}

// InstanceUpdates mocks base method.
func (m *MockAPIInterface) InstanceUpdates(ctx context.Context, instanceID string) (<-chan *WorkspaceInstance, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "InstanceUpdates", ctx, instanceID)
	ret0, _ := ret[0].(<-chan *WorkspaceInstance)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// InstanceUpdates indicates an expected call of InstanceUpdates.
func (mr *MockAPIInterfaceMockRecorder) InstanceUpdates(ctx, instanceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "InstanceUpdates", reflect.TypeOf((*MockAPIInterface)(nil).InstanceUpdates), ctx, instanceID)
}

// IsPrebuildDone mocks base method.
func (m *MockAPIInterface) IsPrebuildDone(ctx context.Context, pwsid string) (bool, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "IsPrebuildDone", ctx, pwsid)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// IsPrebuildDone indicates an expected call of IsPrebuildDone.
func (mr *MockAPIInterfaceMockRecorder) IsPrebuildDone(ctx, pwsid interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "IsPrebuildDone", reflect.TypeOf((*MockAPIInterface)(nil).IsPrebuildDone), ctx, pwsid)
}

// IsWorkspaceOwner mocks base method.
func (m *MockAPIInterface) IsWorkspaceOwner(ctx context.Context, workspaceID string) (bool, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "IsWorkspaceOwner", ctx, workspaceID)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// IsWorkspaceOwner indicates an expected call of IsWorkspaceOwner.
func (mr *MockAPIInterfaceMockRecorder) IsWorkspaceOwner(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "IsWorkspaceOwner", reflect.TypeOf((*MockAPIInterface)(nil).IsWorkspaceOwner), ctx, workspaceID)
}

// OpenPort mocks base method.
func (m *MockAPIInterface) OpenPort(ctx context.Context, workspaceID string, port *WorkspaceInstancePort) (*WorkspaceInstancePort, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "OpenPort", ctx, workspaceID, port)
	ret0, _ := ret[0].(*WorkspaceInstancePort)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// OpenPort indicates an expected call of OpenPort.
func (mr *MockAPIInterfaceMockRecorder) OpenPort(ctx, workspaceID, port interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "OpenPort", reflect.TypeOf((*MockAPIInterface)(nil).OpenPort), ctx, workspaceID, port)
}

// PreparePluginUpload mocks base method.
func (m *MockAPIInterface) PreparePluginUpload(ctx context.Context, params *PreparePluginUploadParams) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "PreparePluginUpload", ctx, params)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// PreparePluginUpload indicates an expected call of PreparePluginUpload.
func (mr *MockAPIInterfaceMockRecorder) PreparePluginUpload(ctx, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PreparePluginUpload", reflect.TypeOf((*MockAPIInterface)(nil).PreparePluginUpload), ctx, params)
}

// RegisterGithubApp mocks base method.
func (m *MockAPIInterface) RegisterGithubApp(ctx context.Context, installationID string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RegisterGithubApp", ctx, installationID)
	ret0, _ := ret[0].(error)
	return ret0
}

// RegisterGithubApp indicates an expected call of RegisterGithubApp.
func (mr *MockAPIInterfaceMockRecorder) RegisterGithubApp(ctx, installationID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RegisterGithubApp", reflect.TypeOf((*MockAPIInterface)(nil).RegisterGithubApp), ctx, installationID)
}

// ResolvePlugins mocks base method.
func (m *MockAPIInterface) ResolvePlugins(ctx context.Context, workspaceID string, params *ResolvePluginsParams) (*ResolvedPlugins, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ResolvePlugins", ctx, workspaceID, params)
	ret0, _ := ret[0].(*ResolvedPlugins)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// ResolvePlugins indicates an expected call of ResolvePlugins.
func (mr *MockAPIInterfaceMockRecorder) ResolvePlugins(ctx, workspaceID, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ResolvePlugins", reflect.TypeOf((*MockAPIInterface)(nil).ResolvePlugins), ctx, workspaceID, params)
}

// SendFeedback mocks base method.
func (m *MockAPIInterface) SendFeedback(ctx context.Context, feedback string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SendFeedback", ctx, feedback)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// SendFeedback indicates an expected call of SendFeedback.
func (mr *MockAPIInterfaceMockRecorder) SendFeedback(ctx, feedback interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SendFeedback", reflect.TypeOf((*MockAPIInterface)(nil).SendFeedback), ctx, feedback)
}

// SendHeartBeat mocks base method.
func (m *MockAPIInterface) SendHeartBeat(ctx context.Context, options *SendHeartBeatOptions) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SendHeartBeat", ctx, options)
	ret0, _ := ret[0].(error)
	return ret0
}

// SendHeartBeat indicates an expected call of SendHeartBeat.
func (mr *MockAPIInterfaceMockRecorder) SendHeartBeat(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SendHeartBeat", reflect.TypeOf((*MockAPIInterface)(nil).SendHeartBeat), ctx, options)
}

// SetEnvVar mocks base method.
func (m *MockAPIInterface) SetEnvVar(ctx context.Context, variable *UserEnvVarValue) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetEnvVar", ctx, variable)
	ret0, _ := ret[0].(error)
	return ret0
}

// SetEnvVar indicates an expected call of SetEnvVar.
func (mr *MockAPIInterfaceMockRecorder) SetEnvVar(ctx, variable interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetEnvVar", reflect.TypeOf((*MockAPIInterface)(nil).SetEnvVar), ctx, variable)
}

// SetWorkspaceDescription mocks base method.
func (m *MockAPIInterface) SetWorkspaceDescription(ctx context.Context, id, desc string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetWorkspaceDescription", ctx, id, desc)
	ret0, _ := ret[0].(error)
	return ret0
}

// SetWorkspaceDescription indicates an expected call of SetWorkspaceDescription.
func (mr *MockAPIInterfaceMockRecorder) SetWorkspaceDescription(ctx, id, desc interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetWorkspaceDescription", reflect.TypeOf((*MockAPIInterface)(nil).SetWorkspaceDescription), ctx, id, desc)
}

// SetWorkspaceTimeout mocks base method.
func (m *MockAPIInterface) SetWorkspaceTimeout(ctx context.Context, workspaceID string, duration *WorkspaceTimeoutDuration) (*SetWorkspaceTimeoutResult, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetWorkspaceTimeout", ctx, workspaceID, duration)
	ret0, _ := ret[0].(*SetWorkspaceTimeoutResult)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// SetWorkspaceTimeout indicates an expected call of SetWorkspaceTimeout.
func (mr *MockAPIInterfaceMockRecorder) SetWorkspaceTimeout(ctx, workspaceID, duration interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetWorkspaceTimeout", reflect.TypeOf((*MockAPIInterface)(nil).SetWorkspaceTimeout), ctx, workspaceID, duration)
}

// StartWorkspace mocks base method.
func (m *MockAPIInterface) StartWorkspace(ctx context.Context, id string, options *StartWorkspaceOptions) (*StartWorkspaceResult, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "StartWorkspace", ctx, id, options)
	ret0, _ := ret[0].(*StartWorkspaceResult)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// StartWorkspace indicates an expected call of StartWorkspace.
func (mr *MockAPIInterfaceMockRecorder) StartWorkspace(ctx, id, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StartWorkspace", reflect.TypeOf((*MockAPIInterface)(nil).StartWorkspace), ctx, id, options)
}

// StopWorkspace mocks base method.
func (m *MockAPIInterface) StopWorkspace(ctx context.Context, id string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "StopWorkspace", ctx, id)
	ret0, _ := ret[0].(error)
	return ret0
}

// StopWorkspace indicates an expected call of StopWorkspace.
func (mr *MockAPIInterfaceMockRecorder) StopWorkspace(ctx, id interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StopWorkspace", reflect.TypeOf((*MockAPIInterface)(nil).StopWorkspace), ctx, id)
}

// StoreLayout mocks base method.
func (m *MockAPIInterface) StoreLayout(ctx context.Context, workspaceID, layoutData string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "StoreLayout", ctx, workspaceID, layoutData)
	ret0, _ := ret[0].(error)
	return ret0
}

// StoreLayout indicates an expected call of StoreLayout.
func (mr *MockAPIInterfaceMockRecorder) StoreLayout(ctx, workspaceID, layoutData interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "StoreLayout", reflect.TypeOf((*MockAPIInterface)(nil).StoreLayout), ctx, workspaceID, layoutData)
}

// TakeSnapshot mocks base method.
func (m *MockAPIInterface) TakeSnapshot(ctx context.Context, options *TakeSnapshotOptions) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "TakeSnapshot", ctx, options)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// TakeSnapshot indicates an expected call of TakeSnapshot.
func (mr *MockAPIInterfaceMockRecorder) TakeSnapshot(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "TakeSnapshot", reflect.TypeOf((*MockAPIInterface)(nil).TakeSnapshot), ctx, options)
}

// UninstallUserPlugin mocks base method.
func (m *MockAPIInterface) UninstallUserPlugin(ctx context.Context, params *UninstallPluginParams) (bool, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UninstallUserPlugin", ctx, params)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// UninstallUserPlugin indicates an expected call of UninstallUserPlugin.
func (mr *MockAPIInterfaceMockRecorder) UninstallUserPlugin(ctx, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UninstallUserPlugin", reflect.TypeOf((*MockAPIInterface)(nil).UninstallUserPlugin), ctx, params)
}

// UpdateLoggedInUser mocks base method.
func (m *MockAPIInterface) UpdateLoggedInUser(ctx context.Context, user *User) (*User, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UpdateLoggedInUser", ctx, user)
	ret0, _ := ret[0].(*User)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// UpdateLoggedInUser indicates an expected call of UpdateLoggedInUser.
func (mr *MockAPIInterfaceMockRecorder) UpdateLoggedInUser(ctx, user interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UpdateLoggedInUser", reflect.TypeOf((*MockAPIInterface)(nil).UpdateLoggedInUser), ctx, user)
}

// UpdateOwnAuthProvider mocks base method.
func (m *MockAPIInterface) UpdateOwnAuthProvider(ctx context.Context, params *UpdateOwnAuthProviderParams) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UpdateOwnAuthProvider", ctx, params)
	ret0, _ := ret[0].(error)
	return ret0
}

// UpdateOwnAuthProvider indicates an expected call of UpdateOwnAuthProvider.
func (mr *MockAPIInterfaceMockRecorder) UpdateOwnAuthProvider(ctx, params interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UpdateOwnAuthProvider", reflect.TypeOf((*MockAPIInterface)(nil).UpdateOwnAuthProvider), ctx, params)
}

// UpdateUserStorageResource mocks base method.
func (m *MockAPIInterface) UpdateUserStorageResource(ctx context.Context, options *UpdateUserStorageResourceOptions) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UpdateUserStorageResource", ctx, options)
	ret0, _ := ret[0].(error)
	return ret0
}

// UpdateUserStorageResource indicates an expected call of UpdateUserStorageResource.
func (mr *MockAPIInterfaceMockRecorder) UpdateUserStorageResource(ctx, options interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UpdateUserStorageResource", reflect.TypeOf((*MockAPIInterface)(nil).UpdateUserStorageResource), ctx, options)
}

// UpdateWorkspaceUserPin mocks base method.
func (m *MockAPIInterface) UpdateWorkspaceUserPin(ctx context.Context, id string, action *PinAction) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UpdateWorkspaceUserPin", ctx, id, action)
	ret0, _ := ret[0].(error)
	return ret0
}

// UpdateWorkspaceUserPin indicates an expected call of UpdateWorkspaceUserPin.
func (mr *MockAPIInterfaceMockRecorder) UpdateWorkspaceUserPin(ctx, id, action interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UpdateWorkspaceUserPin", reflect.TypeOf((*MockAPIInterface)(nil).UpdateWorkspaceUserPin), ctx, id, action)
}

// WatchWorkspaceImageBuildLogs mocks base method.
func (m *MockAPIInterface) WatchWorkspaceImageBuildLogs(ctx context.Context, workspaceID string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "WatchWorkspaceImageBuildLogs", ctx, workspaceID)
	ret0, _ := ret[0].(error)
	return ret0
}

// WatchWorkspaceImageBuildLogs indicates an expected call of WatchWorkspaceImageBuildLogs.
func (mr *MockAPIInterfaceMockRecorder) WatchWorkspaceImageBuildLogs(ctx, workspaceID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "WatchWorkspaceImageBuildLogs", reflect.TypeOf((*MockAPIInterface)(nil).WatchWorkspaceImageBuildLogs), ctx, workspaceID)
}
