// Copyright (c) Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockServer is a mock implementation of the gitpod.Server interface
type MockServer struct {
	mock.Mock
}

func (m *MockServer) SetDotfilesRepository(ctx context.Context, url string) error {
	args := m.Called(ctx, url)
	return args.Error(0)
}

func (m *MockServer) UpdateDotfiles(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockServer) GetUser(ctx context.Context) (*gitpod.User, error) {
	args := m.Called(ctx)
	return args.Get(0).(*gitpod.User), args.Error(1)
}

func (m *MockServer) GetWorkspaces(ctx context.Context) ([]*gitpod.Workspace, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*gitpod.Workspace), args.Error(1)
}

func (m *MockServer) GetWorkspace(ctx context.Context, id string) (*gitpod.Workspace, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*gitpod.Workspace), args.Error(1)
}

func (m *MockServer) StopWorkspace(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockServer) CreateSnapshot(ctx context.Context, workspaceID string, tag string) (string, error) {
	args := m.Called(ctx, workspaceID, tag)
	return args.String(0), args.Error(1)
}

// TODO: Add mocks for other gitpod.Server methods if needed for other tests

func TestDotfilesLinkCmd(t *testing.T) {
	mockServer := new(MockServer)
	// Replace the original GetServer function with one that returns the mock server
	originalGetServer := gitpod.GetServer
	gitpod.GetServer = func(ctx context.Context) (gitpod.Server, error) {
		return mockServer, nil
	}
	defer func() { gitpod.GetServer = originalGetServer }() // Restore original function after test

	repoURL := "https://github.com/user/dotfiles.git"
	mockServer.On("SetDotfilesRepository", mock.Anything, repoURL).Return(nil)

	var actualOutput bytes.Buffer
	rootCmd.SetOut(&actualOutput)
	rootCmd.SetErr(&actualOutput) // Capture stderr as well for error messages

	rootCmd.SetArgs([]string{"dotfiles", "link", repoURL})
	err := rootCmd.Execute()

	assert.NoError(t, err)
	assert.Contains(t, actualOutput.String(), "Successfully linked dotfiles repository: "+repoURL)
	mockServer.AssertCalled(t, "SetDotfilesRepository", mock.Anything, repoURL)
}

func TestDotfilesRemoveCmd(t *testing.T) {
	mockServer := new(MockServer)
	originalGetServer := gitpod.GetServer
	gitpod.GetServer = func(ctx context.Context) (gitpod.Server, error) {
		return mockServer, nil
	}
	defer func() { gitpod.GetServer = originalGetServer }()

	mockServer.On("SetDotfilesRepository", mock.Anything, "").Return(nil)

	var actualOutput bytes.Buffer
	rootCmd.SetOut(&actualOutput)
	rootCmd.SetErr(&actualOutput)

	rootCmd.SetArgs([]string{"dotfiles", "remove"})
	err := rootCmd.Execute()

	assert.NoError(t, err)
	assert.Contains(t, actualOutput.String(), "Successfully removed dotfiles repository.")
	mockServer.AssertCalled(t, "SetDotfilesRepository", mock.Anything, "")
}

func TestDotfilesUpdateCmd(t *testing.T) {
	mockServer := new(MockServer)
	originalGetServer := gitpod.GetServer
	gitpod.GetServer = func(ctx context.Context) (gitpod.Server, error) {
		return mockServer, nil
	}
	defer func() { gitpod.GetServer = originalGetServer }()

	mockServer.On("UpdateDotfiles", mock.Anything).Return(nil)

	var actualOutput bytes.Buffer
	rootCmd.SetOut(&actualOutput)
	rootCmd.SetErr(&actualOutput)

	rootCmd.SetArgs([]string{"dotfiles", "update"})
	err := rootCmd.Execute()

	assert.NoError(t, err)
	assert.Contains(t, actualOutput.String(), "Successfully triggered dotfiles update.")
	mockServer.AssertCalled(t, "UpdateDotfiles", mock.Anything)
}

// TODO: Add tests for error cases, such as when the server returns an error.
// TODO: Add integration tests to ensure the command works correctly with the Gitpod backend.
//       This will require a running Gitpod instance and a way to configure it for testing.
