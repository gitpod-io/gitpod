// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// GarbageCollector regularly prunes containers/images/workspaces.
// This is a generational GC. For it to work you have to label images/volumes/container
// using the label you get from Label().
type GarbageCollector struct {
	Client GCDockerClient
}

// GCDockerClient is the intersection of moby/docker interfaces required by the garbage collector
type GCDockerClient interface {
	ContainersPrune(ctx context.Context, pruneFilters filters.Args) (types.ContainersPruneReport, error)
	ImagesPrune(ctx context.Context, pruneFilter filters.Args) (types.ImagesPruneReport, error)
	VolumesPrune(ctx context.Context, pruneFilters filters.Args) (types.VolumesPruneReport, error)
}

// NewGarbageCollector creates a new GC. This does not start the GC itself. Call
// CollectGarbage in a Go routine to start the GC.
func NewGarbageCollector(client GCDockerClient) *GarbageCollector {
	return &GarbageCollector{
		Client: client,
	}
}

// CollectGarbage actually runs the gargabe collector removing all containers, images and volumes older than maxAge
func (gc *GarbageCollector) CollectGarbage(ctx context.Context, maxAge time.Duration) {
	log.Info("starting garbage collection")
	cpr, err := gc.Client.ContainersPrune(ctx, filters.NewArgs(
		filters.KeyValuePair{Key: "until", Value: maxAge.String()},
	))
	if err != nil {
		log.WithError(err).Warn("container prune failed")
	} else {
		log.WithField("deleted", len(cpr.ContainersDeleted)).WithField("bytesReclaimed", cpr.SpaceReclaimed).Info("containers pruned")
	}

	// We only remove images we built ourselves. In particular do we not want to delete the selfbuild image.
	ipr, err := gc.Client.ImagesPrune(ctx, filters.NewArgs(
		filters.KeyValuePair{Key: "until", Value: maxAge.String()},
		filters.KeyValuePair{Key: "label", Value: LabelTemporary},
		filters.KeyValuePair{Key: "dangling", Value: "false"},
	))
	if err != nil {
		log.WithError(err).Warn("image prune failed")
	} else {
		log.WithField("deleted", len(ipr.ImagesDeleted)).WithField("bytesReclaimed", ipr.SpaceReclaimed).Info("images pruned")
	}

	// It's safe to prune all volumes independently of their creation time. If they're still in use because of an active build,
	// then they're still bound by a container in which case prune won't remove them.
	vpr, err := gc.Client.VolumesPrune(ctx, filters.NewArgs(
		filters.KeyValuePair{Key: "label", Value: LabelTemporary},
	))
	if err != nil {
		log.WithError(err).Warn("volume prune failed")
	} else {
		log.WithField("deleted", len(vpr.VolumesDeleted)).WithField("bytesReclaimed", vpr.SpaceReclaimed).Info("volumes pruned")
	}

	log.Info("garbage collector done")
}

// Start schedules the garbage collector at regular intervals removing all artifacts older than maxAge
func (gc *GarbageCollector) Start(ctx context.Context, maxAge time.Duration) {
	d := maxAge / 10
	if d > 10*time.Minute {
		d = 10 * time.Minute
	}

	t := time.NewTicker(d)

	for {
		gc.CollectGarbage(ctx, maxAge)

		select {
		case <-t.C:
		case <-ctx.Done():
			return
		}
	}
}
