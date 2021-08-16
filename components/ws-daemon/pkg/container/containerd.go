// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package container

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/containerd/containerd"
	"github.com/containerd/containerd/api/events"
	"github.com/containerd/containerd/api/services/tasks/v1"
	"github.com/containerd/containerd/api/types"
	"github.com/containerd/containerd/containers"
	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/typeurl"
	ocispecs "github.com/opencontainers/runtime-spec/specs-go"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

const (
	kubernetesNamespace            = "k8s.io"
	containerLabelCRIKind          = "io.cri-containerd.kind"
	containerLabelK8sContainerName = "io.kubernetes.container.name"
	containerLabelK8sPodName       = "io.kubernetes.pod.name"
)

// NewContainerd creates a new containerd adapter
func NewContainerd(cfg *ContainerdConfig, mounts *NodeMountsLookup, pathMapping PathMapping) (*Containerd, error) {
	cc, err := containerd.New(cfg.SocketPath, containerd.WithDefaultNamespace(kubernetesNamespace))
	if err != nil {
		return nil, xerrors.Errorf("cannot connect to containerd at %s: %w", cfg.SocketPath, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = cc.Version(ctx)
	if err != nil {
		return nil, xerrors.Errorf("cannot connect to containerd: %w", err)
	}

	res := &Containerd{
		Client:  cc,
		Mounts:  mounts,
		Mapping: pathMapping,

		cond:   sync.NewCond(&sync.Mutex{}),
		cntIdx: make(map[string]*containerInfo),
		podIdx: make(map[string]*containerInfo),
		wsiIdx: make(map[string]*containerInfo),
	}
	go res.start()

	return res, nil
}

// Containerd implements the ws-daemon CRI for containerd
type Containerd struct {
	Client  *containerd.Client
	Mounts  *NodeMountsLookup
	Mapping PathMapping

	cond   *sync.Cond
	podIdx map[string]*containerInfo
	wsiIdx map[string]*containerInfo
	cntIdx map[string]*containerInfo
}

type containerInfo struct {
	WorkspaceID string
	InstanceID  string
	OwnerID     string
	ID          string
	Snapshotter string
	SnapshotKey string
	PodName     string
	SeenTask    bool
	Rootfs      string
	UpperDir    string
	CGroupPath  string
	PID         uint32
}

// start listening to containerd
func (s *Containerd) start() {
	// Using the filter expression for subscribe does not seem to work. We simply don't get any events.
	// That's ok as the event handler below are capable of ignoring any event that's not for them.

	reconnectionInterval := 2 * time.Second
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		cs, err := s.Client.ContainerService().List(ctx)
		if err != nil {
			log.WithError(err).Error("cannot list container")
			time.Sleep(reconnectionInterval)
			continue
		}

		// we have to loop through the containers twice because we don't know in which order
		// the sandbox and workspace container are in. handleNewContainer expects to see the
		// sandbox before the actual workspace. Hence, the first pass is for the sandboxes,
		// the second pass for workspaces.
		for _, c := range cs {
			s.handleNewContainer(c)
		}
		for _, c := range cs {
			s.handleNewContainer(c)
		}

		tsks, err := s.Client.TaskService().List(ctx, &tasks.ListTasksRequest{})
		if err != nil {
			log.WithError(err).Error("cannot list tasks")
			time.Sleep(reconnectionInterval)
			continue
		}
		for _, t := range tsks.Tasks {
			s.handleNewTask(t.ID, nil, t.Pid)
		}

		evts, errchan := s.Client.Subscribe(context.Background())
		log.Info("containerd subscription established")
		for {
			select {
			case evt := <-evts:
				ev, err := typeurl.UnmarshalAny(evt.Event)
				if err != nil {
					log.WithError(err).Warn("cannot unmarshal containerd event")
					continue
				}
				s.handleContainerdEvent(ev)
			case err := <-errchan:
				log.WithError(err).Error("lost connection to containerd - will attempt to reconnect")
				time.Sleep(reconnectionInterval)
				break
			}
		}
	}
}

func (s *Containerd) handleContainerdEvent(ev interface{}) {
	switch evt := ev.(type) {
	case *events.ContainerCreate:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		c, err := s.Client.ContainerService().Get(ctx, evt.ID)
		if err != nil {
			log.WithError(err).WithField("ID", evt.ID).WithField("containerImage", evt.Image).Warn("cannot find container we just received a create event for")
			return
		}
		s.handleNewContainer(c)
	case *events.TaskCreate:
		s.handleNewTask(evt.ContainerID, evt.Rootfs, evt.Pid)

	case *events.TaskDelete:

	case *events.ContainerDelete:
		s.cond.L.Lock()
		defer s.cond.L.Unlock()

		info, ok := s.cntIdx[evt.ID]
		if !ok {
			return
		}
		delete(s.cntIdx, evt.ID)
		delete(s.wsiIdx, info.InstanceID)
		delete(s.podIdx, info.PodName)
	}
}

func (s *Containerd) handleNewContainer(c containers.Container) {
	// TODO(cw): check kubernetes namespace
	podName := c.Labels[containerLabelK8sPodName]
	if podName == "" {
		return
	}

	if c.Labels[containerLabelCRIKind] == "sandbox" && c.Labels[wsk8s.WorkspaceIDLabel] != "" {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()

		if _, ok := s.podIdx[podName]; ok {
			// we've already seen the pod - no need to add it to the info again,
			// thereby possibly overwriting previously attached info.
			return
		}

		info := &containerInfo{
			InstanceID:  c.Labels[wsk8s.WorkspaceIDLabel],
			OwnerID:     c.Labels[wsk8s.OwnerLabel],
			WorkspaceID: c.Labels[wsk8s.MetaIDLabel],
			PodName:     podName,
		}
		if info.Snapshotter == "" {
			// c.Snapshotter is optional
			info.Snapshotter = "overlayfs"
		}

		// Beware: the ID at this point is NOT the same as the ID of the actual workspace container.
		//         Here we're talking about the sandbox, not the "workspace" container.
		s.podIdx[podName] = info
		s.wsiIdx[info.InstanceID] = info

		log.WithField("podname", podName).WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).Debug("found sandbox - adding to label cache")
		return
	}

	if c.Labels[containerLabelCRIKind] == "container" && c.Labels[containerLabelK8sContainerName] == "workspace" {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()
		if _, ok := s.cntIdx[c.ID]; ok {
			// we've already seen this container - no need to add it to the info again,
			// thereby possibly overwriting previously attached info.
			return
		}

		info, ok := s.podIdx[podName]
		if !ok {
			// we haven't seen this container's sandbox, hence have no info about it
			return
		}

		var err error
		info.CGroupPath, err = ExtractCGroupPathFromContainer(c)
		if err != nil {
			log.WithError(err).WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).Warn("cannot extract cgroup path")
		}

		info.ID = c.ID
		info.SnapshotKey = c.SnapshotKey
		info.Snapshotter = c.Snapshotter

		s.cntIdx[c.ID] = info
		log.WithField("podname", podName).WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).WithField("ID", c.ID).Debug("found workspace container - updating label cache")
	}
}

func (s *Containerd) handleNewTask(cid string, rootfs []*types.Mount, pid uint32) {
	s.cond.L.Lock()
	defer s.cond.L.Unlock()

	info, ok := s.cntIdx[cid]
	if !ok {
		// we don't care for this task as we haven't seen a workspace container for it
		return
	}
	if info.SeenTask {
		// we've already seen this task - no need to add it to the info again,
		// thereby possibly overwriting previously attached info.
		return
	}

	if rootfs == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		mnts, err := s.Client.SnapshotService(info.Snapshotter).Mounts(ctx, info.SnapshotKey)
		cancel()
		if err != nil {
			log.WithError(err).Warnf("cannot get mounts for container %v", cid)
		}
		for _, m := range mnts {
			rootfs = append(rootfs, &types.Mount{
				Source:  m.Source,
				Options: m.Options,
				Type:    m.Type,
			})
		}
	}

	for _, rfs := range rootfs {
		if rfs.Type != info.Snapshotter {
			continue
		}
		for _, opt := range rfs.Options {
			if !strings.HasPrefix(opt, "upperdir=") {
				continue
			}
			info.UpperDir = strings.TrimPrefix(opt, "upperdir=")
			break
		}
		if info.UpperDir != "" {
			break
		}
	}

	info.PID = pid
	info.SeenTask = true

	log.WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).WithField("cid", cid).WithField("upperdir", info.UpperDir).WithField("rootfs", info.Rootfs).Debug("found task")
	s.cond.Broadcast()
}

// WaitForContainer waits for workspace container to come into existence.
func (s *Containerd) WaitForContainer(ctx context.Context, workspaceInstanceID string) (cid ID, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "WaitForContainer")
	defer tracing.FinishSpan(span, &err)

	rchan := make(chan ID, 1)
	go func() {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()

		for {
			info, ok := s.wsiIdx[workspaceInstanceID]

			if ok && info.SeenTask {
				select {
				case rchan <- ID(info.ID):
				default:
					// just to make sure this isn't blocking and we're not holding
					// the cond Lock too long.
				}

				break
			}

			if ctx.Err() != nil {
				break
			}

			s.cond.Wait()
		}
	}()

	select {
	case cid = <-rchan:
		return
	case <-ctx.Done():
		err = ctx.Err()
		return
	}
}

// WaitForContainerStop waits for workspace container to be deleted.
func (s *Containerd) WaitForContainerStop(ctx context.Context, workspaceInstanceID string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "WaitForContainerStop")
	defer tracing.FinishSpan(span, &err)

	rchan := make(chan struct{}, 1)
	go func() {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()

		_, ok := s.wsiIdx[workspaceInstanceID]
		if !ok {
			// container is already gone
			return
		}

		for {
			s.cond.Wait()
			_, ok := s.wsiIdx[workspaceInstanceID]

			if !ok {
				select {
				case rchan <- struct{}{}:
				default:
					// just to make sure this isn't blocking and we're not holding
					// the cond Lock too long.
				}

				break
			}

			if ctx.Err() != nil {
				break
			}
		}
	}()

	select {
	case <-rchan:
		return
	case <-ctx.Done():
		err = ctx.Err()
		return
	}
}

// ContainerExists finds out if a container with the given ID exists.
func (s *Containerd) ContainerExists(ctx context.Context, id ID) (exists bool, err error) {
	_, err = s.Client.ContainerService().Get(ctx, string(id))
	if err == errdefs.ErrNotFound {
		return false, nil
	}
	if err == nil {
		return false, err
	}

	return true, nil
}

// ContainerRootfs finds the workspace container's rootfs.
func (s *Containerd) ContainerRootfs(ctx context.Context, id ID, opts OptsContainerRootfs) (loc string, err error) {
	info, ok := s.cntIdx[string(id)]
	if !ok {
		return "", ErrNotFound
	}

	// TODO(cw): make this less brittle
	// We can't get the rootfs location on the node from containerd somehow.
	// As a workaround we'll look at the node's mount table using the snapshotter key.
	// This feels brittle and we should keep looking for a better way.
	mnt, err := s.Mounts.GetMountpoint(func(mountPoint string) bool {
		return strings.Contains(mountPoint, info.SnapshotKey)
	})
	if err != nil {
		return
	}

	if opts.Unmapped {
		return mnt, nil
	}

	return s.Mapping.Translate(mnt)
}

// ContainerCGroupPath finds the container's cgroup path suffix
func (s *Containerd) ContainerCGroupPath(ctx context.Context, id ID) (loc string, err error) {
	info, ok := s.cntIdx[string(id)]
	if !ok {
		return "", ErrNotFound
	}

	if info.CGroupPath == "" {
		return "", ErrNoCGroup
	}

	return info.CGroupPath, nil
}

// ContainerPID finds the workspace container's PID
func (s *Containerd) ContainerPID(ctx context.Context, id ID) (pid uint64, err error) {
	info, ok := s.cntIdx[string(id)]
	if !ok {
		return 0, ErrNotFound
	}

	return uint64(info.PID), nil
}

// ContainerPID returns the PID of the container's namespace root process, e.g. the container shim.
func (s *Containerd) IsContainerdReady(ctx context.Context) (bool, error) {
	return s.Client.IsServing(ctx)
}

// ExtractCGroupPathFromContainer retrieves the CGroupPath from the linux section
// in a container's OCI spec.
func ExtractCGroupPathFromContainer(container containers.Container) (cgroupPath string, err error) {
	var spec ocispecs.Spec
	err = json.Unmarshal(container.Spec.Value, &spec)
	if err != nil {
		return
	}
	if spec.Linux == nil {
		return "", xerrors.Errorf("container spec has no Linux section")
	}
	return spec.Linux.CgroupsPath, nil
}
