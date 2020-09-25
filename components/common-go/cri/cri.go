// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cri

import (
	"context"
	"fmt"
)

// ContainerRuntimeInterface abstracts over the different container runtimes out there w.r.t. to the features we need from those runtimes
type ContainerRuntimeInterface interface {
	// WaitForContainer waits for workspace container to come into existence.
	// When this function returns no guarantee is made about the lifecycle state of the container, just its mere existence.
	// Implementors have to respect context cancelation.
	WaitForContainer(ctx context.Context, workspaceInstanceID string) (id ContainerID, err error)

	// ContainerUpperdir finds the workspace container's overlayfs upperdir. The location returned here has to be accessible from
	// the calling process (i.e. if the calling process runs in a container itself, the returned location has to be accessible from
	// within that container).
	//
	// If the container is not found ErrNotFound is returned.
	// If the container has no upperdir ErrNoUpperdir is returned.
	ContainerUpperdir(ctx context.Context, id ContainerID) (loc string, err error)

	// Error listens for errors in the interaction with the container runtime
	Error() <-chan error
}

var (
	// ErrNotFound means the container was not found
	ErrNotFound = fmt.Errorf("not found")

	// ErrNoUpperdir means the container has no upperdir
	ErrNoUpperdir = fmt.Errorf("no upperdir available")
)

// ContainerID represents the ID of a CRI container
type ContainerID string
