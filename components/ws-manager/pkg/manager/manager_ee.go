// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

//go:build !oss
// +build !oss

package manager

import (
	"context"
	"strings"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// TakeSnapshot creates a copy of the workspace content and stores it so that another workspace can be created from it.
func (m *Manager) TakeSnapshot(ctx context.Context, req *api.TakeSnapshotRequest) (res *api.TakeSnapshotResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "TakeSnapshot")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	pod, err := m.findWorkspacePod(ctx, req.Id)
	if isKubernetesObjNotFoundError(err) {
		return nil, status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}
	tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))
	span.LogKV("event", "get pod")

	wso, err := m.getWorkspaceObjects(ctx, pod)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}

	sts, err := m.getWorkspaceStatus(*wso)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}

	if sts.Phase != api.WorkspacePhase_RUNNING {
		return nil, status.Errorf(codes.FailedPrecondition, "can only take snapshots of running workspaces")
	}

	sync, err := m.connectToWorkspaceDaemon(ctx, workspaceObjects{Pod: pod})
	if err != nil {
		return nil, status.Errorf(codes.Unavailable, "cannot connect to workspace daemon: %q", err)
	}

	r, err := sync.TakeSnapshot(ctx, &wsdaemon.TakeSnapshotRequest{
		Id:                req.Id,
		ReturnImmediately: req.ReturnImmediately,
	})
	if err != nil {
		// err is already a grpc error - no need to faff with that
		return nil, err
	}

	return &api.TakeSnapshotResponse{Url: r.Url}, nil
}

// ControlAdmission makes a workspace accessible for everyone or for the owner only
func (m *Manager) ControlAdmission(ctx context.Context, req *api.ControlAdmissionRequest) (res *api.ControlAdmissionResponse, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "ControlAdmission")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	tracing.LogRequestSafe(span, req)
	defer tracing.FinishSpan(span, &err)

	pod, err := m.findWorkspacePod(ctx, req.Id)
	if isKubernetesObjNotFoundError(err) {
		return nil, status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}
	tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))
	span.LogKV("event", "get pod")

	wso, err := m.getWorkspaceObjects(ctx, pod)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}

	sts, err := m.getWorkspaceStatus(*wso)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}

	if sts.Phase == api.WorkspacePhase_STOPPING || sts.Phase == api.WorkspacePhase_STOPPED {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot control admission of stopping workspaces")
	}

	val, ok := api.AdmissionLevel_name[int32(req.Level)]
	if !ok {
		return nil, status.Errorf(codes.InvalidArgument, "invalid admission level")
	}
	// lowercase is just for vanity's sake
	val = strings.ToLower(val)

	err = m.markWorkspace(ctx, req.Id, addMark(kubernetes.WorkspaceAdmissionAnnotation, val))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot change workspace admission level: %q", err)
	}

	return &api.ControlAdmissionResponse{}, nil
}

// SetTimeout changes the default timeout for a running workspace
func (m *Manager) SetTimeout(ctx context.Context, req *api.SetTimeoutRequest) (res *api.SetTimeoutResponse, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "SetTimeout")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	_, err = time.ParseDuration(req.Duration)
	if err != nil {
		return nil, xerrors.Errorf("invalid duration \"%s\": %w", req.Duration, err)
	}

	err = m.markWorkspace(ctx, req.Id, addMark(customTimeoutAnnotation, req.Duration))
	if err != nil {
		return nil, xerrors.Errorf("cannot set workspace timeout: %w", err)
	}

	return &api.SetTimeoutResponse{}, nil
}

// BackupWorkspace attempts to create a backup of the workspace, ignoring its perceived current status as much as it can
func (m *Manager) BackupWorkspace(ctx context.Context, req *api.BackupWorkspaceRequest) (res *api.BackupWorkspaceResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "BackupWorkspace")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	pod, err := m.findWorkspacePod(ctx, req.Id)
	if isKubernetesObjNotFoundError(err) {
		return nil, status.Errorf(codes.NotFound, "workspace pod for %s does not exist", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace pod: %q", err)
	}
	tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))
	span.LogKV("event", "get pod")

	sync, err := m.connectToWorkspaceDaemon(ctx, workspaceObjects{Pod: pod})
	if err != nil {
		return nil, status.Errorf(codes.Unavailable, "cannot connect to workspace daemon: %q", err)
	}

	r, err := sync.BackupWorkspace(ctx, &wsdaemon.BackupWorkspaceRequest{Id: req.Id})
	if err != nil {
		// err is already a grpc error - no need to faff with that
		return nil, err
	}

	return &api.BackupWorkspaceResponse{Url: r.Url}, nil
}
