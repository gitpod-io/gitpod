// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package container

import (
	"context"

	"golang.org/x/xerrors"
)

// Runtime abstracts over the different container runtimes out there w.r.t. to the features we need from those runtimes
type Runtime interface {
	// WaitForContainer waits for workspace container to come into existence.
	// When this function returns no guarantee is made about the lifecycle state of the container, just its mere existence.
	// Implementors have to respect context cancelation.
	WaitForContainer(ctx context.Context, workspaceInstanceID string) (id ID, err error)

	// WaitForContainerStop waits for a workspace container to be deleted.
	// When this function returns without error, it's guaranteed that the container is gone.
	// Implementors have to respect context cancelation.
	WaitForContainerStop(ctx context.Context, workspaceInstanceID string) error

	// ContainerExists finds out if a container with the given ID exists. The existence of the container says nothing about the
	// container's state, which may be running, stopped, deleted, unkown or something else.
	ContainerExists(ctx context.Context, id ID) (exists bool, err error)

	// ContainerRootfs finds the workspace container's rootfs. By default the location returned here has to be accessible from
	// the calling process (i.e. if the calling process runs in a container itself, the returned location has to be accessible from
	// within that container).
	// If opts.Unmapped == true, the location returned here is relative to root mount namespace, i.e. not the container.
	//
	// If the container, or its rootfs, is not found ErrNotFound is returned.
	ContainerRootfs(ctx context.Context, id ID, opts OptsContainerRootfs) (loc string, err error)

	// ContainerCGroupPath finds the container's cgroup path on the node. Note: this path is not the complete path to the container's cgroup,
	// but merely the suffix. To make it a complete path you need to add the cgroup base path (e.g. /sys/fs/cgroup) and the type of cgroup
	// you care for, e.g. cpu: filepath.Join("/sys/fs/cgroup", "cpu", cgroupPath).
	//
	// If the container is not found ErrNotFound is returned.
	// If the container has no cgroup ErrNoCGroup is returned.
	ContainerCGroupPath(ctx context.Context, id ID) (loc string, err error)

	// ContainerPID returns the PID of the container's namespace root process, e.g. the container shim.
	ContainerPID(ctx context.Context, id ID) (pid uint64, err error)

	// IsContainerdReady returns is the status of containerd.
	IsContainerdReady(ctx context.Context) (bool, error)

	// ListWorkspaceContainers retuns a list of all WorkspaceContainers currently known to the runtime
	ListWorkspaceContainers(ctx context.Context) ([]*WorkspaceContainerInfo, error)
}

var (
	// ErrNotFound means the container was not found
	ErrNotFound = xerrors.Errorf("not found")

	// ErrNoUpperdir means the container has no upperdir
	ErrNoUpperdir = xerrors.Errorf("no upperdir available")

	// ErrNoCGroup means the container has no cgroup
	ErrNoCGroup = xerrors.Errorf("no cgroup available")
)

// ID represents the ID of a CRI container
type ID string

// OptsContainerRootfs provides options for the ContainerRootfs function
type OptsContainerRootfs struct {
	Unmapped bool
}

type WorkspaceContainerInfo struct {
	// The PID of the container's namespace root process, e.g. the container shim.
	PID uint64
	// The CRI container id
	ID ID
	// The OwnerID is the user id of the workspace owner
	OwnerID string
	// The WorkspaceID
	WorkspaceID string
	// The InstanceID of the workspace this container is attached to
	InstanceID string
	// The workspace type
	WorkspaceType string
}
