// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package container

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/containerd/containerd"
	"github.com/containerd/containerd/api/events"
	"github.com/containerd/containerd/api/services/tasks/v1"
	"github.com/containerd/containerd/api/types"
	"github.com/containerd/containerd/api/types/task"
	"github.com/containerd/containerd/containers"
	"github.com/containerd/containerd/errdefs"
	"github.com/containerd/containerd/images"
	"github.com/containerd/platforms"
	"github.com/containerd/typeurl/v2"
	ocispecs "github.com/opencontainers/runtime-spec/specs-go"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

const (
	kubernetesNamespace            = "k8s.io"
	containerLabelCRIKind          = "io.cri-containerd.kind"
	containerLabelK8sContainerName = "io.kubernetes.container.name"
	containerLabelK8sPodName       = "io.kubernetes.pod.name"
)

// NewContainerd creates a new containerd adapter
func NewContainerd(cfg *ContainerdConfig, pathMapping PathMapping, registryFacadeHost string) (*Containerd, error) {
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
		Mapping: pathMapping,

		cond:   sync.NewCond(&sync.Mutex{}),
		cntIdx: make(map[string]*containerInfo),
		podIdx: make(map[string]*containerInfo),
		wsiIdx: make(map[string]*containerInfo),

		registryFacadeHost: registryFacadeHost,
	}
	go res.start()

	return res, nil
}

// Containerd implements the ws-daemon CRI for containerd
type Containerd struct {
	Client  *containerd.Client
	Mapping PathMapping

	cond   *sync.Cond
	podIdx map[string]*containerInfo
	wsiIdx map[string]*containerInfo
	cntIdx map[string]*containerInfo

	registryFacadeHost string
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
	ImageRef    string
}

// start listening to containerd
func (s *Containerd) start() {
	// Using the filter expression for subscribe does not seem to work. We simply don't get any events.
	// That's ok as the event handler below are capable of ignoring any event that's not for them.

	reconnectionInterval := 2 * time.Second
	for {
		func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			isServing, err := s.Client.IsServing(ctx)
			if err != nil {
				log.WithError(err).Error("cannot check if containerd is available")
				time.Sleep(reconnectionInterval)
				return
			}

			if !isServing {
				err := s.Client.Reconnect()
				if err != nil {
					log.WithError(err).Error("cannot reconnect to containerd")
					time.Sleep(reconnectionInterval)
					return
				}
			}

			cs, err := s.Client.ContainerService().List(ctx)
			if err != nil {
				log.WithError(err).Error("cannot list container")
				time.Sleep(reconnectionInterval)
				return
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
				return
			}
			for _, t := range tsks.Tasks {
				s.handleNewTask(t.ID, nil, t.Pid)
			}

			evts, errchan := s.Client.Subscribe(context.Background())
			log.Info("containerd subscription established")
		LOOP:
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
					break LOOP
				}
			}
		}()
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

		var info *containerInfo
		if _, ok := c.Labels["gpwsman"]; ok {
			// this is a ws-manager-mk1 workspace
			info = &containerInfo{
				InstanceID:  c.Labels[wsk8s.WorkspaceIDLabel],
				OwnerID:     c.Labels[wsk8s.OwnerLabel],
				WorkspaceID: c.Labels[wsk8s.MetaIDLabel],
				PodName:     podName,
			}
		} else {
			// this is a ws-manager-mk2 workspace
			info = &containerInfo{
				InstanceID:  c.Labels["gitpod.io/instanceID"],
				OwnerID:     c.Labels[wsk8s.OwnerLabel],
				WorkspaceID: c.Labels[wsk8s.WorkspaceIDLabel],
				PodName:     podName,
			}
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
		info.ImageRef = c.Image

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
			log.WithError(err).WithFields(log.OWI(info.OwnerID, info.WorkspaceID, info.InstanceID)).Warnf("cannot get mounts for container %v", cid)
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
	span.LogKV("workspaceInstanceID", workspaceInstanceID)
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
	span.LogKV("workspaceInstanceID", workspaceInstanceID)
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

func (s *Containerd) DisposeContainer(ctx context.Context, workspaceInstanceID string) {
	log := log.WithContext(ctx)

	log.Debug("containerd: disposing container")

	s.cond.L.Lock()
	defer s.cond.L.Unlock()

	info, ok := s.wsiIdx[workspaceInstanceID]
	if !ok {
		// seems we are already done here
		log.Debug("containerd: disposing container skipped")
		return
	}
	defer log.Debug("containerd: disposing container done")

	if info.ID != "" {
		err := s.Client.ContainerService().Delete(ctx, info.ID)
		if err != nil && !errors.Is(err, errdefs.ErrNotFound) {
			log.WithField("containerId", info.ID).WithError(err).Error("cannot delete containerd container")
		}
	}

	delete(s.wsiIdx, info.InstanceID)
	delete(s.podIdx, info.PodName)
	delete(s.cntIdx, info.ID)
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
	_, ok := s.cntIdx[string(id)]
	if !ok {
		return "", ErrNotFound
	}

	rootfs := fmt.Sprintf("/run/containerd/io.containerd.runtime.v2.task/k8s.io/%v/rootfs", id)

	if opts.Unmapped {
		return rootfs, nil
	}

	return s.Mapping.Translate(rootfs)
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

func (s *Containerd) GetContainerImageInfo(ctx context.Context, id ID) (*workspacev1.WorkspaceImageInfo, error) {
	info, ok := s.cntIdx[string(id)]
	if !ok {
		return nil, ErrNotFound
	}

	image, err := s.Client.GetImage(ctx, info.ImageRef)
	if err != nil {
		return nil, err
	}
	size, err := image.Size(ctx)
	if err != nil {
		return nil, err
	}

	wsImageInfo := &workspacev1.WorkspaceImageInfo{
		TotalSize: size,
	}

	// Fetch the manifest
	manifest, err := images.Manifest(ctx, s.Client.ContentStore(), image.Target(), platforms.Default())
	if err != nil {
		log.WithError(err).WithField("image", info.ImageRef).Error("Failed to get manifest")
		return wsImageInfo, nil
	}
	if manifest.Annotations != nil {
		wsImageInfo.WorkspaceImageRef = manifest.Annotations["io.gitpod.workspace-image.ref"]
		if size, err := strconv.Atoi(manifest.Annotations["io.gitpod.workspace-image.size"]); err == nil {
			wsImageInfo.WorkspaceImageSize = int64(size)
		}
	}
	return wsImageInfo, nil
}

func (s *Containerd) IsContainerdReady(ctx context.Context) (bool, error) {
	if len(s.registryFacadeHost) == 0 {
		return s.Client.IsServing(ctx)
	}

	// check registry facade can reach containerd and returns image not found.
	isServing, err := s.Client.IsServing(ctx)
	if err != nil {
		return false, err
	}

	if !isServing {
		return false, nil
	}

	_, err = s.Client.GetImage(ctx, fmt.Sprintf("%v/not-a-valid-image:latest", s.registryFacadeHost))
	if err != nil {
		if errdefs.IsNotFound(err) {
			return true, nil
		}

		return false, nil
	}

	return true, nil
}

func (s *Containerd) GetContainerTaskInfo(ctx context.Context, id ID) (*task.Process, error) {
	task, err := s.Client.TaskService().Get(ctx, &tasks.GetRequest{
		ContainerID: string(id),
	})
	if err != nil {
		return nil, err
	}
	if task.Process == nil {
		return nil, fmt.Errorf("task has no process")
	}
	return task.Process, nil
}

func (s *Containerd) ForceKillContainerTask(ctx context.Context, id ID) error {
	_, err := s.Client.TaskService().Kill(ctx, &tasks.KillRequest{
		ContainerID: string(id),
		Signal:      9,
		All:         true,
	})
	return err
}

var kubepodsQoSRegexp = regexp.MustCompile(`([^/]+)-([^/]+)-pod`)
var kubepodsRegexp = regexp.MustCompile(`([^/]+)-pod`)

// ExtractCGroupPathFromContainer retrieves the CGroupPath from the linux section
// in a container's OCI spec.
func ExtractCGroupPathFromContainer(container containers.Container) (cgroupPath string, err error) {
	var spec ocispecs.Spec
	err = json.Unmarshal(container.Spec.GetValue(), &spec)
	if err != nil {
		return
	}
	if spec.Linux == nil {
		return "", xerrors.Errorf("container spec has no Linux section")
	}

	// systemd: /kubepods.slice/kubepods-<QoS-class>.slice/kubepods-<QoS-class>-pod<pod-UID>.slice:<prefix>:<container-iD>
	// systemd: /kubepods.slice/kubepods-pod<pod-UID>.slice:<prefix>:<container-iD>
	// cgroupfs: /kubepods/<QoS-class>/pod<pod-UID>/<container-iD>
	fields := strings.SplitN(spec.Linux.CgroupsPath, ":", 3)
	if len(fields) != 3 {

		return spec.Linux.CgroupsPath, nil
	}

	if match := kubepodsQoSRegexp.FindStringSubmatch(fields[0]); len(match) == 3 {
		root, class := match[1], match[2]
		return filepath.Join(
			"/",
			fmt.Sprintf("%v.slice", root),
			fmt.Sprintf("%v-%v.slice", root, class),
			fields[0],
			fmt.Sprintf("%v-%v.scope", fields[1], fields[2]),
		), nil
	}

	if match := kubepodsRegexp.FindStringSubmatch(fields[0]); len(match) == 2 {
		root := match[1]
		return filepath.Join(
			"/",
			fmt.Sprintf("%v.slice", root),
			fields[0],
			fmt.Sprintf("%v-%v.scope", fields[1], fields[2]),
		), nil
	}

	return spec.Linux.CgroupsPath, nil
}
