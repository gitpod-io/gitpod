// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package iws

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/sys/unix"
	"golang.org/x/time/rate"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	linuxproc "github.com/c9s/goprocinfo/linux"
	"github.com/gitpod-io/gitpod/common-go/cgroups"
	v2 "github.com/gitpod-io/gitpod/common-go/cgroups/v2"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	nsi "github.com/gitpod-io/gitpod/ws-daemon/pkg/nsinsider"
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
	procDefaultMaskedPaths = []string{
		"acpi",
		"kcore",
		"keys",
		"latency_stats",
		"timer_list",
		"timer_stats",
		"sched_debug",
		"scsi",
	}
	procDefaultReadonlyPaths = []string{
		"asound",
		"bus",
		"fs",
		"irq",
		"sys",
		"sysrq-trigger",
	}
	sysfsDefaultMaskedPaths = []string{
		"firmware",
	}
)

// ServeWorkspace establishes the IWS server for a workspace
func ServeWorkspace(uidmapper *Uidmapper, fsshift api.FSShiftMethod, cgroupMountPoint string, workspaceCIDR string) func(ctx context.Context, ws *session.Workspace) error {
	return func(ctx context.Context, ws *session.Workspace) (err error) {
		span, _ := opentracing.StartSpanFromContext(ctx, "iws.ServeWorkspace")
		defer tracing.FinishSpan(span, &err)
		if _, running := ws.NonPersistentAttrs[session.AttrWorkspaceServer]; running {
			span.SetTag("alreadyRunning", true)
			return nil
		}

		iws := &InWorkspaceServiceServer{
			Uidmapper:        uidmapper,
			Session:          ws,
			FSShift:          fsshift,
			CGroupMountPoint: cgroupMountPoint,
			WorkspaceCIDR:    workspaceCIDR,
		}
		err = iws.Start()
		if err != nil {
			return xerrors.Errorf("cannot start in-workspace-helper server: %w", err)
		}

		log.WithFields(ws.OWI()).Debug("established IWS server")
		ws.NonPersistentAttrs[session.AttrWorkspaceServer] = iws.Stop

		return nil
	}
}

// StopServingWorkspace stops a previously started workspace server
func StopServingWorkspace(ctx context.Context, ws *session.Workspace) (err error) {
	//nolint:ineffassign
	span, _ := opentracing.StartSpanFromContext(ctx, "iws.StopServingWorkspace")
	defer tracing.FinishSpan(span, &err)

	rawStop, ok := ws.NonPersistentAttrs[session.AttrWorkspaceServer]
	if !ok {
		return nil
	}

	stopFn, ok := rawStop.(func())
	if !ok {
		return nil
	}

	stopFn()
	log.WithFields(ws.OWI()).Debug("stopped IWS server")
	return nil
}

// InWorkspaceServiceServer implements the workspace facing backup services
type InWorkspaceServiceServer struct {
	Uidmapper        *Uidmapper
	Session          *session.Workspace
	FSShift          api.FSShiftMethod
	CGroupMountPoint string

	WorkspaceCIDR string

	srv  *grpc.Server
	sckt io.Closer

	api.UnimplementedInWorkspaceServiceServer
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

	wbs.sckt = sckt

	limits := ratelimitingInterceptor{
		"/iws.InWorkspaceService/PrepareForUserNS": ratelimit{
			UseOnce: true,
		},
		"/iws.InWorkspaceService/EvacuateCGroup": ratelimit{
			UseOnce: true,
		},
		"/iws.InWorkspaceService/WriteIDMapping": ratelimit{
			Limiter: rate.NewLimiter(rate.Every(2500*time.Millisecond), 4),
		},
		"/iws.InWorkspaceService/Teardown": ratelimit{
			UseOnce: true,
		},
		"/iws.InWorkspaceService/WorkspaceInfo": ratelimit{
			Limiter: rate.NewLimiter(rate.Every(1500*time.Millisecond), 4),
		},
	}

	wbs.srv = grpc.NewServer(grpc.ChainUnaryInterceptor(limits.UnaryInterceptor()))
	api.RegisterInWorkspaceServiceServer(wbs.srv, wbs)
	go func() {
		err := wbs.srv.Serve(sckt)
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

	log.WithField("type", wbs.FSShift).WithFields(wbs.Session.OWI()).Debug("FSShift")

	// user namespace support for FUSE landed in Linux 4.18:
	//   - http://lkml.iu.edu/hypermail/linux/kernel/1806.0/04385.html
	// Development leading up to this point:
	//   - https://lists.linuxcontainers.org/pipermail/lxc-devel/2014-July/009797.html
	//   - https://lists.linuxcontainers.org/pipermail/lxc-users/2014-October/007948.html
	err = nsi.Nsinsider(wbs.Session.InstanceID, int(containerPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "prepare-dev", "--uid", strconv.Itoa(wsinit.GitpodUID), "--gid", strconv.Itoa(wsinit.GitpodGID))
	})
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("PrepareForUserNS: cannot prepare /dev")
		return nil, status.Errorf(codes.Internal, "cannot prepare /dev")
	}

	// create overlayfs directories to be used in ring2 as rootfs and also upper layer to track changes in the workspace
	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "upper"), 0755)
	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "work"), 0755)
	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "mark"), 0755)

	mountpoint := filepath.Join(wbs.Session.ServiceLocNode, "mark")

	// We cannot use the nsenter syscall here because mount namespaces affect the whole process, not just the current thread.
	// That's why we resort to exec'ing "nsenter ... mount ...".
	err = nsi.Nsinsider(wbs.Session.InstanceID, int(1), func(c *exec.Cmd) {
		c.Args = append(c.Args, "make-shared", "--target", "/")
	})
	if err != nil {
		log.WithField("containerPID", containerPID).WithFields(wbs.Session.OWI()).WithError(err).Error("cannot make container's rootfs shared")
		return nil, status.Errorf(codes.Internal, "cannot make container's rootfs shared")
	}

	err = nsi.Nsinsider(wbs.Session.InstanceID, int(1), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mount-shiftfs-mark", "--source", rootfs, "--target", mountpoint)
	})
	if err != nil {
		log.WithField("rootfs", rootfs).WithFields(wbs.Session.OWI()).WithField("mountpoint", mountpoint).WithError(err).Error("cannot mount shiftfs mark")
		return nil, status.Errorf(codes.Internal, "cannot mount shiftfs mark")
	}

	if err := wbs.createWorkspaceCgroup(ctx, wscontainerID); err != nil {
		return nil, err
	}

	return &api.PrepareForUserNSResponse{
		FsShift: api.FSShiftMethod_SHIFTFS,
	}, nil
}

func (wbs *InWorkspaceServiceServer) createWorkspaceCgroup(ctx context.Context, wscontainerID container.ID) error {
	rt := wbs.Uidmapper.Runtime
	if rt == nil {
		return status.Errorf(codes.FailedPrecondition, "not connected to container runtime")
	}

	unified, err := cgroups.IsUnifiedCgroupSetup()
	if err != nil {
		// log error and do not expose it to the user
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("could not determine cgroup setup")
		return status.Errorf(codes.FailedPrecondition, "could not determine cgroup setup")
	}

	if !unified {
		return nil
	}

	cgroupBase, err := rt.ContainerCGroupPath(ctx, wscontainerID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("cannot find workspace container CGroup path")
		return status.Errorf(codes.NotFound, "cannot find workspace container cgroup")
	}

	err = evacuateToCGroup(ctx, log.WithFields(wbs.Session.OWI()), wbs.CGroupMountPoint, cgroupBase, "workspace")
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("cannot create workspace cgroup")
		return status.Errorf(codes.FailedPrecondition, "cannot create workspace cgroup")
	}

	return nil
}

func (wbs *InWorkspaceServiceServer) SetupPairVeths(ctx context.Context, req *api.SetupPairVethsRequest) (*api.SetupPairVethsResponse, error) {
	rt := wbs.Uidmapper.Runtime
	if rt == nil {
		return nil, status.Errorf(codes.FailedPrecondition, "not connected to container runtime")
	}
	wscontainerID, err := rt.WaitForContainer(ctx, wbs.Session.InstanceID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("SetupPairVeths: cannot find workspace container")
		return nil, status.Errorf(codes.Internal, "cannot find workspace container")
	}

	containerPID, err := rt.ContainerPID(ctx, wscontainerID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("SetupPairVeths: cannot find workspace container PID")
		return nil, status.Errorf(codes.Internal, "cannnot setup a pair of veths")
	}

	err = nsi.Nsinsider(wbs.Session.InstanceID, int(containerPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "setup-pair-veths",
			"--target-pid", strconv.Itoa(int(req.Pid)),
			fmt.Sprintf("--workspace-cidr=%v", wbs.WorkspaceCIDR),
		)
	}, nsi.EnterMountNS(true), nsi.EnterPidNS(true), nsi.EnterNetNS(true))
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("SetupPairVeths: cannot setup a pair of veths")
		return nil, status.Errorf(codes.Internal, "cannot setup a pair of veths")
	}

	pid, err := wbs.Uidmapper.findHostPID(containerPID, uint64(req.Pid))
	if err != nil {
		return nil, xerrors.Errorf("cannot map in-container PID %d (container PID: %d): %w", req.Pid, containerPID, err)
	}
	err = nsi.Nsinsider(wbs.Session.InstanceID, int(pid), func(c *exec.Cmd) {
		c.Args = append(c.Args, "setup-peer-veth",
			fmt.Sprintf("--workspace-cidr=%v", wbs.WorkspaceCIDR),
		)
	}, nsi.EnterMountNS(true), nsi.EnterPidNS(true), nsi.EnterNetNS(true))
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("SetupPairVeths: cannot setup a peer veths")

		nsi.Nsinsider(wbs.Session.InstanceID, int(containerPID), func(c *exec.Cmd) {
			c.Args = append(c.Args, "dump-network-info",
				fmt.Sprintf("--tag=%v", "pod"))
		}, nsi.EnterMountNS(true), nsi.EnterPidNS(true), nsi.EnterNetNS(true))

		nsi.Nsinsider(wbs.Session.InstanceID, int(pid), func(c *exec.Cmd) {
			c.Args = append(c.Args, "dump-network-info",
				fmt.Sprintf("--tag=%v", "workspace"))
		}, nsi.EnterMountNS(true), nsi.EnterPidNS(true), nsi.EnterNetNS(true))

		return nil, status.Errorf(codes.Internal, "cannot setup a peer veths")
	}

	err = nsi.Nsinsider(wbs.Session.InstanceID, int(containerPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "enable-ip-forward")
	}, nsi.EnterNetNS(true), nsi.EnterMountNSPid(1))
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("SetupPairVeths: cannot enable IP forwarding")
		return nil, status.Errorf(codes.Internal, "cannot enable IP forwarding")
	}

	return &api.SetupPairVethsResponse{}, nil
}

func evacuateToCGroup(ctx context.Context, log *logrus.Entry, mountpoint, oldGroup, child string) error {
	newGroup := filepath.Join(oldGroup, child)
	oldPath := filepath.Join(mountpoint, oldGroup)
	newPath := filepath.Join(mountpoint, newGroup)

	if err := os.MkdirAll(newPath, 0755); err != nil {
		return err
	}

	// evacuate existing procs from oldGroup to newGroup, so that we can enable all controllers including threaded ones
	cgroupProcsBytes, err := os.ReadFile(filepath.Join(oldPath, "cgroup.procs"))
	if err != nil {
		return err
	}
	for _, pidStr := range strings.Split(string(cgroupProcsBytes), "\n") {
		if pidStr == "" || pidStr == "0" {
			continue
		}
		if err := os.WriteFile(filepath.Join(newPath, "cgroup.procs"), []byte(pidStr), 0644); err != nil {
			log.WithError(err).Warnf("failed to move process %s to cgroup %q", pidStr, newGroup)
		}
	}

	// enable controllers for all subgroups under the oldGroup
	controllerBytes, err := os.ReadFile(filepath.Join(oldPath, "cgroup.controllers"))
	if err != nil {
		return err
	}
	for _, controller := range strings.Fields(string(controllerBytes)) {
		log.Debugf("enabling controller %q", controller)
		if err := os.WriteFile(filepath.Join(oldPath, "cgroup.subtree_control"), []byte("+"+controller), 0644); err != nil {
			log.WithError(err).Warnf("failed to enable controller %q", controller)
		}
	}

	return nil
}

// MountProc mounts a proc filesystem
func (wbs *InWorkspaceServiceServer) MountProc(ctx context.Context, req *api.MountProcRequest) (resp *api.MountProcResponse, err error) {
	var (
		reqPID  = req.Pid
		procPID uint64
	)
	defer func() {
		if err == nil {
			return
		}

		log.WithError(err).WithField("procPID", procPID).WithField("reqPID", reqPID).WithFields(wbs.Session.OWI()).Error("cannot mount proc")
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
		return nil, xerrors.Errorf("cannot find container PID for containerID %v: %w", wscontainerID, err)
	}

	procPID, err = wbs.Uidmapper.findHostPID(containerPID, uint64(req.Pid))
	if err != nil {
		return nil, xerrors.Errorf("cannot map in-container PID %d (container PID: %d): %w", req.Pid, containerPID, err)
	}

	nodeStaging, err := os.MkdirTemp("", "proc-staging")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare proc staging: %w", err)
	}
	err = nsi.Nsinsider(wbs.Session.InstanceID, int(procPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mount-proc", "--target", nodeStaging)
	}, nsi.EnterMountNS(false), nsi.EnterPidNS(true), nsi.EnterNetNS(true))
	if err != nil {
		return nil, xerrors.Errorf("mount new proc at %s: %w", nodeStaging, err)
	}

	for _, mask := range procDefaultMaskedPaths {
		err = maskPath(filepath.Join(nodeStaging, mask))
		if err != nil {
			return nil, xerrors.Errorf("cannot mask %s: %w", mask, err)
		}
	}
	for _, rdonly := range procDefaultReadonlyPaths {
		err = readonlyPath(filepath.Join(nodeStaging, rdonly))
		if err != nil {
			return nil, xerrors.Errorf("cannot mount readonly %s: %w", rdonly, err)
		}
	}

	err = moveMount(wbs.Session.InstanceID, int(procPID), nodeStaging, req.Target)
	if err != nil {
		return nil, err
	}

	// now that we've moved the mount (which we've done with OPEN_TREE_CLONE), we'll
	// need to unmount the mask mounts again to not leave them dangling.
	var masks []string
	masks = append(masks, procDefaultMaskedPaths...)
	masks = append(masks, procDefaultReadonlyPaths...)
	cleanupMaskedMount(wbs.Session.OWI(), nodeStaging, masks)

	return &api.MountProcResponse{}, nil
}

// MountProc mounts a proc filesystem
func (wbs *InWorkspaceServiceServer) UmountProc(ctx context.Context, req *api.UmountProcRequest) (resp *api.UmountProcResponse, err error) {
	var (
		reqPID  = req.Pid
		procPID uint64
	)
	defer func() {
		if err == nil {
			return
		}

		log.WithError(err).WithFields(wbs.Session.OWI()).WithField("procPID", procPID).WithField("reqPID", reqPID).Error("UmountProc failed")
		if _, ok := status.FromError(err); !ok {
			err = status.Error(codes.Internal, "cannot umount proc")
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
		return nil, xerrors.Errorf("cannot find container PID for containerID %v: %w", wscontainerID, err)
	}

	procPID, err = wbs.Uidmapper.findHostPID(containerPID, uint64(req.Pid))
	if err != nil {
		return nil, xerrors.Errorf("cannot map in-container PID %d (container PID: %d): %w", req.Pid, containerPID, err)
	}

	nodeStaging, err := os.MkdirTemp("", "proc-umount")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare proc staging: %w", err)
	}
	scktPath := filepath.Join(nodeStaging, "sckt")
	l, err := net.Listen("unix", scktPath)
	if err != nil {
		return nil, xerrors.Errorf("cannot listen for mountfd: %w", err)
	}
	defer l.Close()

	type fdresp struct {
		FD  int
		Err error
	}
	fdrecv := make(chan fdresp)
	go func() {
		defer close(fdrecv)

		rconn, err := l.Accept()
		if err != nil {
			fdrecv <- fdresp{Err: err}
			return
		}
		defer rconn.Close()

		conn := rconn.(*net.UnixConn)
		err = conn.SetDeadline(time.Now().Add(5 * time.Second))
		if err != nil {
			fdrecv <- fdresp{Err: err}
			return
		}

		f, err := conn.File()
		if err != nil {
			fdrecv <- fdresp{Err: err}
			return
		}
		defer f.Close()
		connfd := int(f.Fd())

		buf := make([]byte, unix.CmsgSpace(4))
		_, _, _, _, err = unix.Recvmsg(connfd, nil, buf, 0)
		if err != nil {
			fdrecv <- fdresp{Err: err}
			return
		}

		msgs, err := unix.ParseSocketControlMessage(buf)
		if err != nil {
			fdrecv <- fdresp{Err: err}
			return
		}
		if len(msgs) != 1 {
			fdrecv <- fdresp{Err: xerrors.Errorf("expected a single socket control message")}
			return
		}

		fds, err := unix.ParseUnixRights(&msgs[0])
		if err != nil {
			fdrecv <- fdresp{Err: err}
			return
		}
		if len(fds) == 0 {
			fdrecv <- fdresp{Err: xerrors.Errorf("expected a single socket FD")}
			return
		}

		fdrecv <- fdresp{FD: fds[0]}
	}()

	rconn, err := net.Dial("unix", scktPath)
	if err != nil {
		return nil, err
	}
	defer rconn.Close()
	conn := rconn.(*net.UnixConn)
	connFD, err := conn.File()
	if err != nil {
		return nil, err
	}

	err = nsi.Nsinsider(wbs.Session.InstanceID, int(procPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "open-tree", "--target", req.Target, "--pipe-fd", "3")
		c.ExtraFiles = append(c.ExtraFiles, connFD)
	})
	if err != nil {
		return nil, xerrors.Errorf("cannot open-tree at %s (container PID: %d): %w", req.Target, containerPID, err)
	}

	fdr := <-fdrecv
	if fdr.Err != nil {
		return nil, fdr.Err
	}
	if fdr.FD == 0 {
		return nil, xerrors.Errorf("received nil as mountfd (container PID: %d): %w", containerPID, err)
	}

	base, err := os.Executable()
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(filepath.Join(filepath.Dir(base), "nsinsider"), "move-mount", "--target", nodeStaging, "--pipe-fd", "3")
	cmd.ExtraFiles = append(cmd.ExtraFiles, os.NewFile(uintptr(fdr.FD), ""))
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Unshareflags: syscall.CLONE_NEWNS,
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, xerrors.Errorf("cannot move-mount: %w: %s", err, string(out))
	}

	return &api.UmountProcResponse{}, nil
}

func (wbs *InWorkspaceServiceServer) MountSysfs(ctx context.Context, req *api.MountProcRequest) (resp *api.MountProcResponse, err error) {
	var (
		reqPID  = req.Pid
		procPID uint64
	)
	defer func() {
		if err == nil {
			return
		}

		log.WithError(err).WithFields(wbs.Session.OWI()).WithField("procPID", procPID).WithField("reqPID", reqPID).WithFields(wbs.Session.OWI()).Error("cannot mount sysfs")
		if _, ok := status.FromError(err); !ok {
			err = status.Error(codes.Internal, "cannot mount sysfs")
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
		return nil, xerrors.Errorf("cannot find container PID for containerID %v: %w", wscontainerID, err)
	}

	procPID, err = wbs.Uidmapper.findHostPID(containerPID, uint64(req.Pid))
	if err != nil {
		return nil, xerrors.Errorf("cannot map in-container PID %d (container PID: %d): %w", req.Pid, containerPID, err)
	}

	nodeStaging, err := os.MkdirTemp("", "sysfs-staging")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare proc staging: %w", err)
	}
	err = nsi.Nsinsider(wbs.Session.InstanceID, int(procPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mount-sysfs", "--target", nodeStaging)
	}, nsi.EnterMountNS(false), nsi.EnterNetNS(true))
	if err != nil {
		return nil, xerrors.Errorf("mount new sysfs at %s: %w", nodeStaging, err)
	}

	for _, mask := range sysfsDefaultMaskedPaths {
		err = maskPath(filepath.Join(nodeStaging, mask))
		if err != nil {
			return nil, xerrors.Errorf("cannot mask %s: %w", mask, err)
		}
	}

	err = moveMount(wbs.Session.InstanceID, int(procPID), nodeStaging, req.Target)
	if err != nil {
		return nil, err
	}

	cleanupMaskedMount(wbs.Session.OWI(), nodeStaging, sysfsDefaultMaskedPaths)

	return &api.MountProcResponse{}, nil
}

func (wbs *InWorkspaceServiceServer) MountNfs(ctx context.Context, req *api.MountNfsRequest) (resp *api.MountNfsResponse, err error) {
	var (
		reqPID        = req.Pid
		supervisorPID uint64
	)
	defer func() {
		if err == nil {
			return
		}

		log.WithError(err).WithFields(wbs.Session.OWI()).WithField("procPID", supervisorPID).WithField("reqPID", reqPID).WithFields(wbs.Session.OWI()).Error("cannot mount nfs")
		if _, ok := status.FromError(err); !ok {
			err = status.Error(codes.Internal, "cannot mount nfs")
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
		return nil, xerrors.Errorf("cannot find container PID for containerID %v: %w", wscontainerID, err)
	}

	supervisorPID, err = wbs.Uidmapper.findSupervisorPID(containerPID)
	if err != nil {
		return nil, xerrors.Errorf("cannot map supervisor PID %d (container PID: %d): %w", req.Pid, containerPID, err)
	}

	nodeStaging, err := os.MkdirTemp("", "nfs-staging")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare nfs staging: %w", err)
	}

	log.WithField("source", req.Source).WithField("target", req.Target).WithField("staging", nodeStaging).WithField("args", req.Args).Info("Mounting nfs")
	cmd := exec.CommandContext(ctx, "mount", "-t", "nfs4", "-o", req.Args, req.Source, nodeStaging)
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	err = cmd.Run()
	if err != nil {
		return nil, xerrors.Errorf("cannot mount nfs: %w", err)
	}

	stat, err := os.Stat(nodeStaging)
	if err != nil {
		return nil, xerrors.Errorf("cannot stat staging: %w", err)
	}

	sys, ok := stat.Sys().(*syscall.Stat_t)
	if !ok {
		return nil, xerrors.Errorf("cast to stat failed")
	}

	if sys.Uid != 133332 || sys.Gid != 133332 {
		err = os.Chown(nodeStaging, 133332, 133332)
		if err != nil {
			return nil, xerrors.Errorf("cannot chown %s for %s", nodeStaging, req.Source)
		}
	}

	err = moveMount(wbs.Session.InstanceID, int(supervisorPID), nodeStaging, req.Target)
	if err != nil {
		return nil, err
	}

	return &api.MountNfsResponse{}, nil
}

func moveMount(instanceID string, targetPid int, source, target string) error {
	mntfd, err := syscallOpenTree(unix.AT_FDCWD, source, flagOpenTreeClone|flagAtRecursive)
	if err != nil {
		return xerrors.Errorf("cannot open tree: %w", err)
	}
	mntf := os.NewFile(mntfd, "")
	defer mntf.Close()

	// Note(cw): we also need to enter the target PID namespace because the mount target
	// 			 might refer to proc.
	err = nsi.Nsinsider(instanceID, targetPid, func(c *exec.Cmd) {
		c.Args = append(c.Args, "move-mount", "--target", target, "--pipe-fd", "3")
		c.ExtraFiles = append(c.ExtraFiles, mntf)
	}, nsi.EnterPidNS(true))
	if err != nil {
		return xerrors.Errorf("cannot move mount: %w", err)
	}
	return nil
}

// cleanupMaskedMount will unmount and remove the paths joined with the basedir.
// Errors are logged instead of returned.
// This is useful for when we've moved the mount (which we've done with OPEN_TREE_CLONE), we'll
// need to unmount the mask mounts again to not leave them dangling.
func cleanupMaskedMount(owi map[string]interface{}, base string, paths []string) {
	for _, mask := range paths {
		// Note: if errors happen while unmounting or removing the masks this does not mean
		//       that the final unmount won't happen. I.e. we can ignore those errors here
		//       because they would not be actionable anyways. Only if the final removal or
		//       unmount fails did we leak a mount.

		fn := filepath.Join(base, mask)
		err := unix.Unmount(fn, 0)
		if err != nil {
			continue
		}
		_ = os.RemoveAll(fn)
	}

	err := unix.Unmount(base, 0)
	if err != nil {
		log.WithError(err).WithField("fn", base).WithFields(owi).Warn("cannot unmount dangling base mount")
		err = unix.Unmount(base, syscall.MNT_DETACH)
		if err != nil {
			log.WithError(err).WithField("fn", base).WithFields(owi).Warn("cannot detach dangling base mount")
		}
		return
	}

	err = os.RemoveAll(base)
	if err != nil {
		log.WithError(err).WithField("fn", base).WithFields(owi).Warn("cannot remove dangling base mount")
		return
	}
}

// maskPath masks the top of the specified path inside a container to avoid
// security issues from processes reading information from non-namespace aware
// mounts ( proc/kcore ).
// For files, maskPath bind mounts /dev/null over the top of the specified path.
// For directories, maskPath mounts read-only tmpfs over the top of the specified path.
//
// Blatant copy from runc: https://github.com/opencontainers/runc/blob/master/libcontainer/rootfs_linux.go#L946-L959
func maskPath(path string) error {
	if err := unix.Mount("/dev/null", path, "", unix.MS_BIND, ""); err != nil && !errors.Is(err, fs.ErrNotExist) {
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
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return err
	}
	return unix.Mount(path, path, "", unix.MS_BIND|unix.MS_REMOUNT|unix.MS_RDONLY|unix.MS_REC, "")
}

// WriteIDMapping writes /proc/.../uid_map and /proc/.../gid_map for a workapce container
func (wbs *InWorkspaceServiceServer) WriteIDMapping(ctx context.Context, req *api.WriteIDMappingRequest) (*api.WriteIDMappingResponse, error) {
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

// Allow workspace users to manipulate the cgroups to which the user process belong by constructing the cgroups of the following form
//
// <container-cgorup>  drwxr-xr-x 3 root      root
// └── workspace       drwxr-xr-x 5 gitpodUid gitpodGid
//
//	└── user        drwxr-xr-x 5 gitpodUid gitpodGid
func (wbs *InWorkspaceServiceServer) EvacuateCGroup(ctx context.Context, req *api.EvacuateCGroupRequest) (*api.EvacuateCGroupResponse, error) {
	unified, err := cgroups.IsUnifiedCgroupSetup()
	if err != nil {
		// log error and do not expose it to the user
		log.WithFields(wbs.Session.OWI()).WithError(err).Error("could not determine cgroup setup")
		return nil, status.Errorf(codes.FailedPrecondition, "could not determine cgroup setup")
	}
	if !unified {
		return &api.EvacuateCGroupResponse{}, nil
	}

	rt := wbs.Uidmapper.Runtime
	if rt == nil {
		return nil, status.Errorf(codes.FailedPrecondition, "not connected to container runtime")
	}
	wscontainerID, err := rt.WaitForContainer(ctx, wbs.Session.InstanceID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("EvacuateCGroup: cannot find workspace container")
		return nil, status.Errorf(codes.NotFound, "cannot find workspace container")
	}

	cgroupBase, err := rt.ContainerCGroupPath(ctx, wscontainerID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("EvacuateCGroup: cannot find workspace container CGroup path")
		return nil, status.Errorf(codes.NotFound, "cannot find workspace container cgroup")
	}

	workspaceCGroup := filepath.Join(cgroupBase, "workspace")
	if _, err := os.Stat(filepath.Join(wbs.CGroupMountPoint, workspaceCGroup)); err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).WithField("path", workspaceCGroup).Error("EvacuateCGroup: workspace cgroup error")
		return nil, status.Errorf(codes.FailedPrecondition, "cannot find workspace cgroup")
	}

	err = evacuateToCGroup(ctx, log.WithFields(wbs.Session.OWI()), wbs.CGroupMountPoint, workspaceCGroup, "user")
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).WithField("path", workspaceCGroup).Error("EvacuateCGroup: cannot produce user cgroup")
		return nil, status.Errorf(codes.FailedPrecondition, "cannot produce user cgroup")
	}

	out, err := exec.CommandContext(ctx, "chown", "-R", fmt.Sprintf("%d:%d", wsinit.GitpodUID, wsinit.GitpodGID), filepath.Join(wbs.CGroupMountPoint, workspaceCGroup)).CombinedOutput()
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).WithField("path", workspaceCGroup).WithField("out", string(out)).Error("EvacuateCGroup: cannot chown workspace cgroup")
		return nil, status.Errorf(codes.FailedPrecondition, "cannot chown workspace cgroup")
	}

	return &api.EvacuateCGroupResponse{}, nil
}

// Teardown triggers the final liev backup and possibly shiftfs mark unmount
func (wbs *InWorkspaceServiceServer) Teardown(ctx context.Context, req *api.TeardownRequest) (*api.TeardownResponse, error) {
	owi := wbs.Session.OWI()

	var (
		success = true
		err     error
	)

	err = wbs.unPrepareForUserNS()
	if err != nil {
		log.WithError(err).WithFields(owi).Error("mark FS unmount failed")
		success = false
	}

	return &api.TeardownResponse{Success: success}, nil
}

func (wbs *InWorkspaceServiceServer) unPrepareForUserNS() error {
	mountpoint := filepath.Join(wbs.Session.ServiceLocNode, "mark")
	err := nsi.Nsinsider(wbs.Session.InstanceID, 1, func(c *exec.Cmd) {
		c.Args = append(c.Args, "unmount", "--target", mountpoint)
	})
	if err != nil {
		return xerrors.Errorf("cannot unmount mark at %s: %w", mountpoint, err)
	}

	return nil
}

func (wbs *InWorkspaceServiceServer) WorkspaceInfo(ctx context.Context, req *api.WorkspaceInfoRequest) (*api.WorkspaceInfoResponse, error) {
	log.WithFields(wbs.Session.OWI()).Debug("Received workspace info request")
	rt := wbs.Uidmapper.Runtime
	if rt == nil {
		return nil, status.Errorf(codes.FailedPrecondition, "not connected to container runtime")
	}
	wscontainerID, err := rt.WaitForContainer(ctx, wbs.Session.InstanceID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("EvacuateCGroup: cannot find workspace container")
		return nil, status.Errorf(codes.NotFound, "cannot find workspace container")
	}

	cgroupPath, err := rt.ContainerCGroupPath(ctx, wscontainerID)
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("EvacuateCGroup: cannot find workspace container CGroup path")
		return nil, status.Errorf(codes.NotFound, "cannot find workspace container cgroup")
	}

	unified, err := cgroups.IsUnifiedCgroupSetup()
	if err != nil {
		// log error and do not expose it to the user
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("could not determine cgroup setup")
		return nil, status.Errorf(codes.FailedPrecondition, "could not determine cgroup setup")
	}

	if !unified {
		return nil, status.Errorf(codes.FailedPrecondition, "only cgroups v2 is supported")
	}

	resources, err := getWorkspaceResourceInfo(wbs.CGroupMountPoint, cgroupPath)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.WithError(err).WithFields(wbs.Session.OWI()).Error("could not get resource information")
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}

	return &api.WorkspaceInfoResponse{
		Resources: resources,
	}, nil
}

func getWorkspaceResourceInfo(mountPoint, cgroupPath string) (*api.Resources, error) {
	cpu, err := getCpuResourceInfoV2(mountPoint, cgroupPath)
	if err != nil {
		return nil, err
	}

	memory, err := getMemoryResourceInfoV2(mountPoint, cgroupPath)
	if err != nil {
		return nil, err
	}

	return &api.Resources{
		Cpu:    cpu,
		Memory: memory,
	}, nil
}

func getCpuResourceInfoV2(mountPoint, cgroupPath string) (*api.Cpu, error) {
	cpu := v2.NewCpuControllerWithMount(mountPoint, cgroupPath)

	t, err := resolveCPUStatV2(cpu)
	if err != nil {
		return nil, err
	}

	time.Sleep(time.Second)

	t2, err := resolveCPUStatV2(cpu)
	if err != nil {
		return nil, err
	}

	cpuUsage := t2.usage - t.usage
	totalTime := t2.uptime - t.uptime
	used := cpuUsage / totalTime * 1000

	quota, period, err := cpu.Max()
	if errors.Is(err, os.ErrNotExist) {
		quota = math.MaxUint64
	} else if err != nil {
		return nil, err
	}

	// if no cpu limit has been specified, use the number of cores
	var limit uint64
	if quota == math.MaxUint64 {
		// TODO(toru): we have to check a parent cgroup instead of a host resources
		cpuInfo, err := linuxproc.ReadCPUInfo("/proc/cpuinfo")
		if err != nil {
			return nil, err
		}

		limit = uint64(cpuInfo.NumCore()) * 1000
	} else {
		limit = quota / period * 1000
	}

	return &api.Cpu{
		Used:  int64(used),
		Limit: int64(limit),
	}, nil
}

func getMemoryResourceInfoV2(mountPoint, cgroupPath string) (*api.Memory, error) {
	memory := v2.NewMemoryControllerWithMount(mountPoint, cgroupPath)
	memoryLimit, err := memory.Max()
	if err != nil {
		return nil, xerrors.Errorf("could not retrieve memory max: %w", err)
	}

	memInfo, err := linuxproc.ReadMemInfo("/proc/meminfo")
	if err != nil {
		return nil, xerrors.Errorf("failed to read meminfo: %w", err)
	}

	// if no memory limit has been specified, use total available memory
	if memoryLimit == math.MaxUint64 || memoryLimit > memInfo.MemTotal*1024 {
		// total memory is specifed on kilobytes -> convert to bytes
		memoryLimit = memInfo.MemTotal * 1024
	}

	usedMemory, err := memory.Current()
	if err != nil {
		return nil, xerrors.Errorf("failed to read current memory usage: %w", err)
	}

	stats, err := memory.Stat()
	if err != nil {
		return nil, xerrors.Errorf("failed to read memory stats: %w", err)
	}

	if stats.InactiveFileTotal > 0 {
		if usedMemory < stats.InactiveFileTotal {
			usedMemory = 0
		} else {
			usedMemory -= stats.InactiveFileTotal
		}
	}

	return &api.Memory{
		Limit: int64(memoryLimit),
		Used:  int64(usedMemory),
	}, nil
}

type cpuStat struct {
	usage  float64
	uptime float64
}

func resolveCPUStatV2(cpu *v2.Cpu) (*cpuStat, error) {
	stats, err := cpu.Stat()
	if err != nil {
		return nil, xerrors.Errorf("failed to get cpu usage: %w", err)
	}

	usage := float64(stats.UsageTotal) * 1e-6
	uptime, err := readProcUptime()
	if err != nil {
		return nil, err
	}

	return &cpuStat{
		usage:  usage,
		uptime: uptime,
	}, nil
}

func readProcUptime() (float64, error) {
	content, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, xerrors.Errorf("failed to read uptime: %w", err)
	}
	values := strings.Split(strings.TrimSpace(string(content)), " ")
	uptime, err := strconv.ParseFloat(values[0], 64)
	if err != nil {
		return 0, xerrors.Errorf("failed to parse uptime: %w", err)
	}

	return uptime, nil
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
