// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build oss
// +build oss

package manager

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/ws-manager/api"
)

var errEnterpriseFeature = status.Errorf(codes.Unimplemented, "feature is available in the enterprise edition")

// TakeSnapshot creates a copy of the workspace content and stores it so that another workspace can be created from it.
func (m *Manager) TakeSnapshot(ctx context.Context, req *api.TakeSnapshotRequest) (res *api.TakeSnapshotResponse, err error) {
	return nil, errEnterpriseFeature
}

// ControlAdmission makes a workspace accessible for everyone or for the owner only
func (m *Manager) ControlAdmission(ctx context.Context, req *api.ControlAdmissionRequest) (res *api.ControlAdmissionResponse, err error) {
	return nil, errEnterpriseFeature
}

// SetTimeout changes the default timeout for a running workspace
func (m *Manager) SetTimeout(ctx context.Context, req *api.SetTimeoutRequest) (res *api.SetTimeoutResponse, err error) {
	return nil, errEnterpriseFeature
}

// BackupWorkspace creates a copy of the workspace content and stores it so that another workspace can be created from it.
func (m *Manager) BackupWorkspace(ctx context.Context, req *api.BackupWorkspaceRequest) (res *api.BackupWorkspaceResponse, err error) {
	return nil, errEnterpriseFeature
}