// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package iws

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/sys/unix"
	"golang.org/x/time/rate"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

//
// BEWARE
// The code in this file, i.e. everything offered by InWorkspaceHelperServer is accessible without further protection
// by user-reachable code. There's no server or ws-man in front of this interface. Keep this interface minimal, and
// be defensive!
//
// IWS services are made available to workspaces through the workspace dispatch.
// When a new workspace is added, the dispatch listener creates a new gRPC server socket,
// and tears it down when the workspace is removed (i.e. the workspace context is canceled).
//

var (
	// These *must* be kept in sync with moby/moby and kubernetes/kubernetes.
	// https://github.com/moby/moby/blob/master/oci/defaults.go#L116-L134
	// https://github.com/kubernetes/kubernetes/blob/master/pkg/securitycontext/util.go#L200-L218
	//
	// Compared to the origin of this list, we imply the /proc prefix.
	// That means we don't list the prefix, but also we only list files/dirs here which
	// reside in /proc (e.g. not /sys/firmware).
	defaultMaskedPaths = []string{
		"acpi",
		"kcore",
		"keys",
		"latency_stats",
		"timer_list",
		"timer_stats",
		"sched_debug",
		"scsi",
	}
	defaultReadonlyPaths = []string{
		"asound",
		"bus",
		"fs",
		"irq",
		"sys",
		"sysrq-trigger",
	}
)

// ServeWorkspace establishes the IWS server for a workspace
func ServeWorkspace(uidmapper *Uidmapper) func(ctx context.Context, ws *session.Workspace) error {
	return func(ctx context.Context, ws *session.Workspace) (err error) {
		if !ws.FullWorkspaceBackup && !ws.UserNamespaced {
			return nil
		}

		//nolint:ineffassign
		span, ctx := opentracing.StartSpanFromContext(ctx, "iws.ServeWorkspace")
		defer tracing.FinishSpan(span, &err)

		helper := &InWorkspaceServiceServer{
			Uidmapper: uidmapper,
			Session:   ws,
		}
		err = helper.Start()
		if err != nil {
			return xerrors.Errorf("cannot start in-workspace-helper server: %w", err)
		}

		log.WithFields(ws.OWI()).Info("established IWS server")
		ws.NonPersistentAttrs[session.AttrWorkspaceServer] = helper.Stop

		return nil
	}
}

// StopServingWorkspace stops a previously started workspace server
func StopServingWorkspace(ctx context.Context, ws *session.Workspace) error {
	rawStop, ok := ws.NonPersistentAttrs[session.AttrWorkspaceServer]
	if !ok {
		return nil
	}

	stopFn, ok := rawStop.(context.CancelFunc)
	if !ok {
		return nil
	}

	stopFn()
	log.WithFields(ws.OWI()).Info("stopped IWS server")
	return nil
}

// InWorkspaceServiceServer implements the workspace facing backup services
type InWorkspaceServiceServer struct {
	Uidmapper *Uidmapper
	Session   *session.Workspace

	srv  *grpc.Server
	sckt io.Closer
}

// Start creates the syscall socket the IWS server listens on, and starts the gRPC server on it
func (wbs *InWorkspaceServiceServer) Start() error {
	// It's possible that the kubelet hasn't create the ServiceLocDaemon directory yet.
	err := os.MkdirAll(wbs.Session.ServiceLocDaemon, 0755)
	if err != nil && !os.IsExist(err) {
		return xerrors.Errorf("cannot create ServiceLocDaemon: %w", err)
	}

	socketFN := filepath.Join(wbs.Session.ServiceLocDaemon, "daemon.sock")
	if _, err := os.Stat(socketFN); err == nil {
		// a former ws-daemon instance left their sockets laying around.
		// Let's clean up after them.
		_ = os.Remove(socketFN)
	}
	sckt, err := net.Listen("unix", socketFN)
	if err != nil {
		return xerrors.Errorf("cannot create IWS socket: %w", err)
	}
	err = os.Chmod(socketFN, 0777)
	if err != nil {
		return xerrors.Errorf("cannot chmod IWS socket: %w", err)
	}

	limits := ratelimitingInterceptor{
		"/iws.InWorkspaceService/PrepareForUserNS": ratelimit{
			UseOnce: true,
		},
		"/iws.InWorkspaceService/WriteIDMapping": ratelimit{
			Limiter: rate.NewLimiter(rate.Every(2500*time.Millisecond), 4),
		},
		"/iws.InWorkspaceService/Teardown": ratelimit{
			UseOnce: true,
		},
	}

	srv := grpc.NewServer(grpc.ChainUnaryInterceptor(limits.UnaryInterceptor()))
	api.RegisterInWorkspaceServiceServer(srv, wbs)
	go func() {
		err := srv.Serve(sckt)
		if err != nil {
			log.WithError(err).WithFields(wbs.Session.OWI()).Error("IWS server failed")
		}
	}()
	return nil
}

// Stop stops the service and closes the socket
func (wbs *InWorkspaceServiceServer) Stop() {
	defer wbs.sckt.Close()
	wbs.srv.GracefulStop()
}

// PrepareForUserNS mounts the workspace's shiftfs mark
func (wbs *InWorkspaceServiceServer) PrepareForUserNS(ctx context.Context, req *api.PrepareForUserNSRequest) (*api.PrepareForUserNSResponse, error) {
	if !wbs.Session.UserNamespaced {
		return nil, status.Error(codes.FailedPrecondition, "not supported for this workspace")
	}

	rt := wbs.Uidmapper.Runtime
	if rt == nil {
		return nil, status.Errorf(codes.FailedPrecondition, "not connected to container runtime")
	}
	wscontainerID, err := rt.WaitForContainer(ctx, wbs.Session.InstanceID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("PrepareForUserNS: cannot find workspace container")
		return nil, status.Errorf(codes.Internal, "cannot find workspace container")
	}

	rootfs, err := rt.ContainerRootfs(ctx, wscontainerID, container.OptsContainerRootfs{Unmapped: true})
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("PrepareForUserNS: cannot find workspace rootfs")
		return nil, status.Errorf(codes.Internal, "cannot find workspace rootfs")
	}

	containerPID, err := rt.ContainerPID(ctx, wscontainerID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("PrepareForUserNS: cannot find workspace container PID")
		return nil, status.Errorf(codes.Internal, "cannot find workspace rootfs")
	}

	// We cannot use the nsenter syscall here because mount namespaces affect the whole process, not just the current thread.
	// That's why we resort to exec'ing "nsenter ... mount ...".
	mntout, err := exec.Command("nsenter", "-t", fmt.Sprint(containerPID), "-m", "--", "mount", "--make-shared", "/").CombinedOutput()
	if err != nil {
		log.WithField("containerPID", containerPID).WithField("mntout", string(mntout)).WithError(err).Error("cannot make container's rootfs shared")
		return nil, status.Errorf(codes.Internal, "cannot make container's rootfs shared")
	}

	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "mark"), 0755)
	mountpoint := filepath.Join(wbs.Session.ServiceLocNode, "mark")
	mntout, err = exec.Command("nsenter", "-t", "1", "-m", "--", "mount", "-t", "shiftfs", "-o", "mark", rootfs, mountpoint).CombinedOutput()
	if err != nil {
		log.WithField("rootfs", rootfs).WithField("mountpoint", mountpoint).WithField("mntout", string(mntout)).WithError(err).Error("cannot mount shiftfs mark")
		return nil, status.Errorf(codes.Internal, "cannot mount shiftfs mark")
	}

	return &api.PrepareForUserNSResponse{}, nil
}

// MountProc mounts a proc filesystem
func (wbs *InWorkspaceServiceServer) MountProc(ctx context.Context, req *api.MountProcRequest) (resp *api.MountProcResponse, err error) {
	if !wbs.Session.UserNamespaced {
		return nil, status.Error(codes.FailedPrecondition, "not supported for this workspace")
	}

	var (
		reqPID  = req.Pid
		procPID uint64
	)
	defer func() {
		if err == nil {
			return
		}

		log.WithError(err).WithField("procPID", procPID).WithField("reqPID", reqPID).Error("MountProc failed")
		if _, ok := status.FromError(err); !ok {
			err = status.Error(codes.Internal, "cannot mount proc")
		}
	}()

	rt := wbs.Uidmapper.Runtime
	if rt == nil {
		return nil, status.Errorf(codes.FailedPrecondition, "not connected to container runtime")
	}
	wscontainerID, err := rt.WaitForContainer(ctx, wbs.Session.InstanceID)
	if err != nil {
		return nil, xerrors.Errorf("cannot find workspace container")
	}

	containerPID, err := rt.ContainerPID(ctx, wscontainerID)
	if err != nil {
		return nil, xerrors.Errorf("cannot find container PID for containerID %v: %w", wscontainerID)
	}

	procPID, err = wbs.Uidmapper.findHostPID(containerPID, uint64(req.Pid))
	if err != nil {
		return nil, xerrors.Errorf("cannot map in-container PID %d (container PID: %d): %w", req.Pid, containerPID)
	}

	nodeStaging, err := ioutil.TempDir("", "proc-staging")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare proc staging: %w")
	}
	mntout, err := exec.Command("nsenter", "-t", fmt.Sprint(procPID), "-p", "--", "mount", "-t", "proc", "proc", nodeStaging).CombinedOutput()
	if err != nil {
		return nil, xerrors.Errorf("mount new proc at %s: %w: %s", nodeStaging, err, string(mntout))
	}

	for _, mask := range defaultMaskedPaths {
		err = maskPath(filepath.Join(nodeStaging, mask))
		if err != nil {
			return nil, xerrors.Errorf("cannot mask %s: %w", mask, err)
		}
	}
	for _, rdonly := range defaultReadonlyPaths {
		err = readonlyPath(filepath.Join(nodeStaging, rdonly))
		if err != nil {
			return nil, xerrors.Errorf("cannot mount readonly %s: %w", rdonly, err)
		}
	}

	containerStaging, err := ioutil.TempDir(wbs.Session.ServiceLocDaemon, "proc-staging")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare proc-staging for container: %w", err)
	}

	mntout, err = exec.Command("mount", "--move", nodeStaging, containerStaging).CombinedOutput()
	if err != nil {
		return nil, xerrors.Errorf("cannot move proc mount at %s: %w: %s", containerStaging, err, string(mntout))
	}

	workspaceStaging := filepath.Join("/.workspace", strings.TrimPrefix(containerStaging, wbs.Session.ServiceLocDaemon))

	return &api.MountProcResponse{
		Location: workspaceStaging,
	}, nil
}

// maskPath masks the top of the specified path inside a container to avoid
// security issues from processes reading information from non-namespace aware
// mounts ( proc/kcore ).
// For files, maskPath bind mounts /dev/null over the top of the specified path.
// For directories, maskPath mounts read-only tmpfs over the top of the specified path.
//
// Blatant copy from runc: https://github.com/opencontainers/runc/blob/master/libcontainer/rootfs_linux.go#L946-L959
func maskPath(path string) error {
	if err := unix.Mount("/dev/null", path, "", unix.MS_BIND, ""); err != nil && !os.IsNotExist(err) {
		if err == unix.ENOTDIR {
			return unix.Mount("tmpfs", path, "tmpfs", unix.MS_RDONLY, "")
		}
		return err
	}
	return nil
}

// readonlyPath will make a path read only.
//
// Blatant copy from runc: https://github.com/opencontainers/runc/blob/master/libcontainer/rootfs_linux.go#L907-L916
func readonlyPath(path string) error {
	if err := unix.Mount(path, path, "", unix.MS_BIND|unix.MS_REC, ""); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return unix.Mount(path, path, "", unix.MS_BIND|unix.MS_REMOUNT|unix.MS_RDONLY|unix.MS_REC, "")
}

// WriteIDMapping writes /proc/.../uid_map and /proc/.../gid_map for a workapce container
func (wbs *InWorkspaceServiceServer) WriteIDMapping(ctx context.Context, req *api.WriteIDMappingRequest) (*api.WriteIDMappingResponse, error) {
	if !wbs.Session.UserNamespaced {
		return nil, status.Error(codes.FailedPrecondition, "not supported for this workspace")
	}

	cid, err := wbs.Uidmapper.Runtime.WaitForContainer(ctx, wbs.Session.InstanceID)
	if err != nil {
		log.WithFields(wbs.Session.OWI()).WithError(err).Error("cannot write ID mapping, because we cannot find the container")
		return nil, status.Error(codes.FailedPrecondition, "cannot find container")
	}

	err = wbs.Uidmapper.HandleUIDMappingRequest(ctx, req, cid, wbs.Session.InstanceID)
	if err != nil {
		return nil, err
	}

	return &api.WriteIDMappingResponse{}, nil
}

// Teardown triggers the final liev backup and possibly shiftfs mark unmount
func (wbs *InWorkspaceServiceServer) Teardown(ctx context.Context, req *api.TeardownRequest) (*api.TeardownResponse, error) {
	owi := wbs.Session.OWI()

	var (
		success = true
		err     error
	)
	err = wbs.performLiveBackup()
	if err != nil {
		log.WithError(err).WithFields(owi).Error("FWB teardown failed")
		success = false
	}

	err = wbs.unPrepareForUserNS()
	if err != nil {
		log.WithError(err).WithFields(owi).Error("ShiftFS unmount failed")
		success = false
	}

	return &api.TeardownResponse{Success: success}, nil
}

func (wbs *InWorkspaceServiceServer) performLiveBackup() error {
	if !wbs.Session.FullWorkspaceBackup {
		return nil
	}

	lb, ok := wbs.Session.NonPersistentAttrs[session.AttrLiveBackup].(*LiveWorkspaceBackup)
	if lb == nil || !ok {
		return xerrors.Errorf("FWB workspace has no associated live backup")
	}

	_, err := lb.Backup()
	if err != nil {
		return err
	}

	return nil
}

func (wbs *InWorkspaceServiceServer) unPrepareForUserNS() error {
	if !wbs.Session.UserNamespaced {
		return nil
	}

	// We cannot use the nsenter syscall here because mount namespaces affect the whole process, not just the current thread.
	// That's why we resort to exec'ing "nsenter ... unmount ...".
	mountpoint := filepath.Join(wbs.Session.ServiceLocNode, "mark")
	mntout, err := exec.Command("nsenter", "-t", "1", "-m", "--", "umount", mountpoint).CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot unmount shiftfs mark at %s: %w: %s", mountpoint, err, mntout)
	}

	return nil
}

type ratelimitingInterceptor map[string]ratelimit

type ratelimit struct {
	Limiter *rate.Limiter
	UseOnce bool
}

func (rli ratelimitingInterceptor) UnaryInterceptor() grpc.UnaryServerInterceptor {
	var (
		mu   sync.Mutex
		used = make(map[string]struct{})
	)
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		limit, ok := rli[info.FullMethod]
		if ok {
			if limit.UseOnce {
				mu.Lock()
				_, ran := used[info.FullMethod]
				used[info.FullMethod] = struct{}{}
				mu.Unlock()

				if ran {
					return nil, status.Error(codes.ResourceExhausted, "can be used only once")
				}
			}

			if limit.Limiter != nil && !limit.Limiter.Allow() {
				return nil, status.Error(codes.ResourceExhausted, "too many requests")
			}
		}

		return handler(ctx, req)
	}
}
