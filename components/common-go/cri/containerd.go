// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cri

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/containerd/containerd"
	"github.com/containerd/containerd/api/events"
	"github.com/containerd/containerd/api/types"
	"github.com/containerd/containerd/containers"
	"github.com/containerd/typeurl"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
)

const (
	// labelCacheSize configures how big our label cache is, i.e. how many workspace pods
	// we can handle in this ws-sync instance at the same time. 1024 is way more than we
	// will ever have on a single machine. A single label is about 200 byte.
	labelCacheSize = 1024

	kubernetesNamespace            = "k8s.io"
	containerLabelCRIKind          = "io.cri-containerd.kind"
	containerLabelK8sContainerName = "io.kubernetes.container.name"
	containerLabelK8sPodName       = "io.kubernetes.pod.name"
	containerLabelK8sNamespace     = "io.kubernetes.pod.namespace"
)

// NewContainerdCRI creates a new containerd adapter
func NewContainerdCRI(cfg *ContainerdConfig, mounts *NodeMountsLookup) (*ContainerdCRI, error) {
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

	res := &ContainerdCRI{
		Client: cc,
		Mounts: mounts,

		cond:    sync.NewCond(&sync.Mutex{}),
		cntIdx:  make(map[string]*containerInfo),
		podIdx:  make(map[string]*containerInfo),
		wsiIdx:  make(map[string]*containerInfo),
		errchan: make(chan error),
	}
	err = res.start()
	if err != nil {
		return nil, err
	}
	return res, nil
}

// ContainerdCRI implements the ws-sync CRI for containerd
type ContainerdCRI struct {
	Client *containerd.Client
	Mounts *NodeMountsLookup

	cond    *sync.Cond
	podIdx  map[string]*containerInfo
	wsiIdx  map[string]*containerInfo
	cntIdx  map[string]*containerInfo
	errchan chan error
}

type containerInfo struct {
	WorkspaceID string
	InstanceID  string
	OwnerID     string
	ContainerID string
	PodName     string
	SeenTask    bool
	UpperDir    string
}

// start listening to containerd
func (s *ContainerdCRI) start() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cs, err := s.Client.ContainerService().List(ctx)
	if err != nil {
		return xerrors.Errorf("cannot list container: %w", err)
	}
	for _, c := range cs {
		s.handleNewContainer(c)
	}

	// Using the filter expression for subscribe does not seem to work. We simply don't get any events.
	// That's ok as the event handler below are capable of ignoring any event that's not for them.
	evts, errchan := s.Client.Subscribe(context.Background())
	go func() {
		for {
			select {
			case evt := <-evts:
				var ev interface{}
				ev, err = typeurl.UnmarshalAny(evt.Event)
				if err != nil {
					log.WithError(err).Warn("cannot unmarshal containerd event")
					continue
				}
				s.handleContainerdEvent(ev)
			case err := <-errchan:
				log.WithError(err).Error("containerd CRI error")
				s.errchan <- err
			}
		}
	}()
	return nil
}

func (s *ContainerdCRI) handleContainerdEvent(ev interface{}) {
	switch evt := ev.(type) {
	case *events.ContainerCreate:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		c, err := s.Client.ContainerService().Get(ctx, evt.ID)
		if err != nil {
			log.WithError(err).WithField("containerID", evt.ID).WithField("containerImage", evt.Image).Warn("cannot find container we just received a create event for")
			return
		}
		s.handleNewContainer(c)
	case *events.TaskCreate:
		s.handleNewTask(evt.ContainerID, evt.Rootfs)

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

func (s *ContainerdCRI) handleNewContainer(c containers.Container) {
	// TODO: check kubernetes namespace
	podName := c.Labels[containerLabelK8sPodName]
	if podName == "" {
		return
	}
	if c.Labels[containerLabelCRIKind] == "sandbox" && c.Labels[wsk8s.WorkspaceIDLabel] != "" {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()

		info := &containerInfo{
			InstanceID:  c.Labels[wsk8s.WorkspaceIDLabel],
			OwnerID:     c.Labels[wsk8s.OwnerLabel],
			WorkspaceID: c.Labels[wsk8s.MetaIDLabel],
			PodName:     podName,
		}

		// Beware: the containerID at this point is NOT the same as the ID of the actual workspace container.
		//         Here we're talking about the sandbox, not the "workspace" container.
		s.podIdx[podName] = info
		s.wsiIdx[info.InstanceID] = info

		log.WithField("podname", podName).WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).Debug("found sandbox - adding to label cache")
		return
	}

	if c.Labels[containerLabelCRIKind] == "container" && c.Labels[containerLabelK8sContainerName] == "workspace" {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()
		info, ok := s.podIdx[podName]
		if !ok {
			// we haven't seen this container's sandbox, hence have no info about it
			return
		}

		info.ContainerID = c.ID
		s.cntIdx[c.ID] = info
		log.WithField("podname", podName).WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).Debug("found workspace container - updating label cache")
	}
}

func (s *ContainerdCRI) handleNewTask(cid string, rootfs []*types.Mount) {
	s.cond.L.Lock()
	defer s.cond.L.Unlock()

	info, ok := s.cntIdx[cid]
	if !ok {
		// we don't care for this task
		return
	}

	for _, rfs := range rootfs {
		if rfs.Type != "overlay" {
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

	info.SeenTask = true

	log.WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).WithField("cid", cid).WithField("upperdir", info.UpperDir).Debug("found task")
	s.cond.Broadcast()
}

// Error listens for errors in the interaction with the container runtime
func (s *ContainerdCRI) Error() <-chan error {
	return s.errchan
}

// WaitForContainer waits for workspace container to come into existence.
func (s *ContainerdCRI) WaitForContainer(ctx context.Context, workspaceInstanceID string) (cid ContainerID, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "WaitForContainer")
	defer tracing.FinishSpan(span, &err)

	rchan := make(chan ContainerID, 1)
	go func() {
		s.cond.L.Lock()
		defer s.cond.L.Unlock()

		for {
			s.cond.Wait()
			info, ok := s.wsiIdx[workspaceInstanceID]

			if ok && info.SeenTask {
				select {
				case rchan <- ContainerID(info.ContainerID):
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
	case cid = <-rchan:
		return
	case <-ctx.Done():
		err = ctx.Err()
		return
	}
}

// ContainerUpperdir finds the workspace container's overlayfs upperdir.
func (s *ContainerdCRI) ContainerUpperdir(ctx context.Context, id ContainerID) (loc string, err error) {
	info, ok := s.cntIdx[string(id)]
	if !ok {
		return "", ErrNotFound
	}
	return s.Mounts.mapNodePath(info.UpperDir)
}
