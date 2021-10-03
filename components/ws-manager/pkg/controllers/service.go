// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"

	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/pkg/kubeapi/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type Manager struct {
	Config    config.Configuration
	Clientset client.Client
	RawClient kubernetes.Interface

	wsmanapi.UnimplementedWorkspaceManagerServer
}

// startWorkspace creates a new running workspace within the manager's cluster
func (m *Manager) StartWorkspace(ctx context.Context, req *wsmanapi.StartWorkspaceRequest) (*wsmanapi.StartWorkspaceResponse, error) {
	obj, err := newWorkspace(ctx, &m.Config, req)
	if err != nil {
		return nil, err
	}
	err = m.Clientset.Create(ctx, obj)
	if err != nil {
		return nil, err
	}
	return &wsmanapi.StartWorkspaceResponse{
		Url:        obj.Spec.Orchestration.URL,
		OwnerToken: obj.Spec.Workspace.Auth.OwnerToken,
	}, nil
}

func (m *Manager) StopWorkspace(ctx context.Context, req *wsmanapi.StopWorkspaceRequest) (*wsmanapi.StopWorkspaceResponse, error) {
	var workspace workspacev1.Workspace
	err := m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: req.Id}, &workspace)
	if err != nil {
		return nil, err
	}

	err = m.Clientset.Delete(ctx, &workspace)
	if err != nil {
		return nil, err
	}

	return &wsmanapi.StopWorkspaceResponse{}, nil
}

type WorkspaceServiceDelegator struct {
	Handler wsmanapi.WorkspaceManagerServer
	Shadows []wsmanapi.WorkspaceManagerServer

	wsmanapi.UnimplementedWorkspaceManagerServer
}

var _ wsmanapi.WorkspaceManagerServer = &WorkspaceServiceDelegator{}

// getWorkspaces produces a list of running workspaces and their status
func (srv *WorkspaceServiceDelegator) GetWorkspaces(ctx context.Context, req *wsmanapi.GetWorkspacesRequest) (*wsmanapi.GetWorkspacesResponse, error) {
	for _, s := range srv.Shadows {
		go s.GetWorkspaces(ctx, req)
	}
	return srv.Handler.GetWorkspaces(ctx, req)
}

// startWorkspace creates a new running workspace within the manager's cluster
func (srv *WorkspaceServiceDelegator) StartWorkspace(ctx context.Context, req *wsmanapi.StartWorkspaceRequest) (*wsmanapi.StartWorkspaceResponse, error) {
	for _, s := range srv.Shadows {
		go s.StartWorkspace(ctx, req)
	}
	return srv.Handler.StartWorkspace(ctx, req)
}

// stopWorkspace stops a running workspace
func (srv *WorkspaceServiceDelegator) StopWorkspace(ctx context.Context, req *wsmanapi.StopWorkspaceRequest) (*wsmanapi.StopWorkspaceResponse, error) {
	for _, s := range srv.Shadows {
		go s.StopWorkspace(ctx, req)
	}
	return srv.Handler.StopWorkspace(ctx, req)
}

// describeWorkspace investigates a workspace and returns its status, and configuration
func (srv *WorkspaceServiceDelegator) DescribeWorkspace(ctx context.Context, req *wsmanapi.DescribeWorkspaceRequest) (*wsmanapi.DescribeWorkspaceResponse, error) {
	for _, s := range srv.Shadows {
		go s.DescribeWorkspace(ctx, req)
	}
	return srv.Handler.DescribeWorkspace(ctx, req)
}

// backupWorkspace backs up a running workspace
func (srv *WorkspaceServiceDelegator) BackupWorkspace(ctx context.Context, req *wsmanapi.BackupWorkspaceRequest) (*wsmanapi.BackupWorkspaceResponse, error) {
	for _, s := range srv.Shadows {
		go s.BackupWorkspace(ctx, req)
	}
	return srv.Handler.BackupWorkspace(ctx, req)
}

// subscribe streams all status updates to a client
func (srv *WorkspaceServiceDelegator) Subscribe(req *wsmanapi.SubscribeRequest, sub wsmanapi.WorkspaceManager_SubscribeServer) error {
	return srv.Handler.Subscribe(req, sub)
}

// markActive records a workspace as being active which prevents it from timing out
func (srv *WorkspaceServiceDelegator) MarkActive(ctx context.Context, req *wsmanapi.MarkActiveRequest) (*wsmanapi.MarkActiveResponse, error) {
	for _, s := range srv.Shadows {
		go s.MarkActive(ctx, req)
	}
	return srv.Handler.MarkActive(ctx, req)
}

// setTimeout changes the default timeout for a running workspace
func (srv *WorkspaceServiceDelegator) SetTimeout(ctx context.Context, req *wsmanapi.SetTimeoutRequest) (*wsmanapi.SetTimeoutResponse, error) {
	for _, s := range srv.Shadows {
		go s.SetTimeout(ctx, req)
	}
	return srv.Handler.SetTimeout(ctx, req)
}

// controlPort publicly exposes or un-exposes a network port for a workspace
func (srv *WorkspaceServiceDelegator) ControlPort(ctx context.Context, req *wsmanapi.ControlPortRequest) (*wsmanapi.ControlPortResponse, error) {
	for _, s := range srv.Shadows {
		go s.ControlPort(ctx, req)
	}
	return srv.Handler.ControlPort(ctx, req)
}

// takeSnapshot creates a copy of the workspace content which can initialize a new workspace.
func (srv *WorkspaceServiceDelegator) TakeSnapshot(ctx context.Context, req *wsmanapi.TakeSnapshotRequest) (*wsmanapi.TakeSnapshotResponse, error) {
	for _, s := range srv.Shadows {
		go s.TakeSnapshot(ctx, req)
	}
	return srv.Handler.TakeSnapshot(ctx, req)
}

// controlAdmission makes a workspace accessible for everyone or for the owner only
func (srv *WorkspaceServiceDelegator) ControlAdmission(ctx context.Context, req *wsmanapi.ControlAdmissionRequest) (*wsmanapi.ControlAdmissionResponse, error) {
	for _, s := range srv.Shadows {
		go s.ControlAdmission(ctx, req)
	}
	return srv.Handler.ControlAdmission(ctx, req)
}
