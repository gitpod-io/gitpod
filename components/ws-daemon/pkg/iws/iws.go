// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package iws

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/sys/unix"
	"golang.org/x/time/rate"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
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
func ServeWorkspace(uidmapper *Uidmapper, fsshift api.FSShiftMethod) func(ctx context.Context, ws *session.Workspace) error {
	return func(ctx context.Context, ws *session.Workspace) (err error) {
		if _, running := ws.NonPersistentAttrs[session.AttrWorkspaceServer]; running {
			return nil
		}

		//nolint:ineffassign
		span, ctx := opentracing.StartSpanFromContext(ctx, "iws.ServeWorkspace")
		defer tracing.FinishSpan(span, &err)

		helper := &InWorkspaceServiceServer{
			Uidmapper: uidmapper,
			Session:   ws,
			FSShift:   fsshift,
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
func StopServingWorkspace(ctx context.Context, ws *session.Workspace) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "iws.StopServingWorkspace")
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
	log.WithFields(ws.OWI()).Info("stopped IWS server")
	return nil
}

// InWorkspaceServiceServer implements the workspace facing backup services
type InWorkspaceServiceServer struct {
	Uidmapper *Uidmapper
	Session   *session.Workspace
	FSShift   api.FSShiftMethod

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
		"/iws.InWorkspaceService/WriteIDMapping": ratelimit{
			Limiter: rate.NewLimiter(rate.Every(2500*time.Millisecond), 4),
		},
		"/iws.InWorkspaceService/Teardown": ratelimit{
			UseOnce: true,
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

	log.WithField("type", wbs.FSShift).Debug("FSShift")

	// user namespace support for FUSE landed in Linux 4.18:
	//   - http://lkml.iu.edu/hypermail/linux/kernel/1806.0/04385.html
	// Development leading up to this point:
	//   - https://lists.linuxcontainers.org/pipermail/lxc-devel/2014-July/009797.html
	//   - https://lists.linuxcontainers.org/pipermail/lxc-users/2014-October/007948.html
	err = nsinsider(wbs.Session.InstanceID, int(containerPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mknod-fuse", "--uid", strconv.Itoa(wsinit.GitpodUID), "--gid", strconv.Itoa(wsinit.GitpodGID))
	})
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("PrepareForUserNS: cannot mknod fuse")
		return nil, status.Errorf(codes.Internal, "cannot prepare FUSE")
	}
	err = nsinsider(wbs.Session.InstanceID, int(containerPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mknod-devnettun")
	})
	if err != nil {
		log.WithError(err).WithFields(wbs.Session.OWI()).Error("PrepareForUserNS: cannot create /dev/net/tun")
		return nil, status.Errorf(codes.Internal, "cannot create /dev/net/tun")
	}

	// create overlayfs directories to be used in ring2 as rootfs and also upper layer to track changes in the workspace
	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "upper"), 0755)
	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "work"), 0755)
	_ = os.MkdirAll(filepath.Join(wbs.Session.ServiceLocDaemon, "mark"), 0755)

	mountpoint := filepath.Join(wbs.Session.ServiceLocNode, "mark")

	if wbs.FSShift == api.FSShiftMethod_FUSE || wbs.Session.FullWorkspaceBackup {
		err = nsinsider(wbs.Session.InstanceID, int(1), func(c *exec.Cmd) {
			// In case of any change in the user mapping, the next line must be updated.
			mappings := fmt.Sprintf("0:%v:1:1:100000:65534", wsinit.GitpodUID)
			c.Args = append(c.Args, "mount-fusefs-mark",
				"--source", rootfs,
				"--merged", filepath.Join(wbs.Session.ServiceLocNode, "mark"),
				"--upper", filepath.Join(wbs.Session.ServiceLocNode, "upper"),
				"--work", filepath.Join(wbs.Session.ServiceLocNode, "work"),
				"--uidmapping", mappings,
				"--gidmapping", mappings)
		})
		if err != nil {
			log.WithField("rootfs", rootfs).WithError(err).Error("cannot mount fusefs mark")
			return nil, status.Errorf(codes.Internal, "cannot mount fusefs mark")
		}

		log.WithFields(wbs.Session.OWI()).WithField("configuredShift", wbs.FSShift).WithField("fwb", wbs.Session.FullWorkspaceBackup).Info("fs-shift using fuse")
		return &api.PrepareForUserNSResponse{
			FsShift:             api.FSShiftMethod_FUSE,
			FullWorkspaceBackup: wbs.Session.FullWorkspaceBackup,
		}, nil
	}

	// We cannot use the nsenter syscall here because mount namespaces affect the whole process, not just the current thread.
	// That's why we resort to exec'ing "nsenter ... mount ...".
	err = nsinsider(wbs.Session.InstanceID, int(1), func(c *exec.Cmd) {
		c.Args = append(c.Args, "make-shared", "--target", "/")
	})
	if err != nil {
		log.WithField("containerPID", containerPID).WithError(err).Error("cannot make container's rootfs shared")
		return nil, status.Errorf(codes.Internal, "cannot make container's rootfs shared")
	}

	err = nsinsider(wbs.Session.InstanceID, int(1), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mount-shiftfs-mark", "--source", rootfs, "--target", mountpoint)
	})
	if err != nil {
		log.WithField("rootfs", rootfs).WithField("mountpoint", mountpoint).WithError(err).Error("cannot mount shiftfs mark")
		return nil, status.Errorf(codes.Internal, "cannot mount shiftfs mark")
	}

	return &api.PrepareForUserNSResponse{
		FsShift:             api.FSShiftMethod_SHIFTFS,
		FullWorkspaceBackup: wbs.Session.FullWorkspaceBackup,
	}, nil
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

		log.WithError(err).WithField("procPID", procPID).WithField("reqPID", reqPID).Error("cannot mount proc")
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
	err = nsinsider(wbs.Session.InstanceID, int(procPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mount-proc", "--target", nodeStaging)
	}, enterMountNS(false), enterPidNS(true))
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

		log.WithError(err).WithField("procPID", procPID).WithField("reqPID", reqPID).Error("UmountProc failed")
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

	err = nsinsider(wbs.Session.InstanceID, int(procPID), func(c *exec.Cmd) {
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

		log.WithError(err).WithField("procPID", procPID).WithField("reqPID", reqPID).Error("cannot mount proc")
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

	nodeStaging, err := os.MkdirTemp("", "sysfs-staging")
	if err != nil {
		return nil, xerrors.Errorf("cannot prepare proc staging: %w", err)
	}
	err = nsinsider(wbs.Session.InstanceID, int(procPID), func(c *exec.Cmd) {
		c.Args = append(c.Args, "mount-sysfs", "--target", nodeStaging)
	}, enterMountNS(false), enterNetNS(true))
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

	return &api.MountProcResponse{}, nil
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
	err = nsinsider(instanceID, targetPid, func(c *exec.Cmd) {
		c.Args = append(c.Args, "move-mount", "--target", target, "--pipe-fd", "3")
		c.ExtraFiles = append(c.ExtraFiles, mntf)
	}, enterPidNS(true))
	if err != nil {
		return xerrors.Errorf("cannot move mount: %w", err)
	}
	return nil
}

type nsinsiderOpts struct {
	MountNS bool
	PidNS   bool
	NetNS   bool
}

func enterMountNS(enter bool) nsinsiderOpt {
	return func(o *nsinsiderOpts) {
		o.MountNS = enter
	}
}

func enterPidNS(enter bool) nsinsiderOpt {
	return func(o *nsinsiderOpts) {
		o.PidNS = enter
	}
}

func enterNetNS(enter bool) nsinsiderOpt {
	return func(o *nsinsiderOpts) {
		o.NetNS = enter
	}
}

type nsinsiderOpt func(*nsinsiderOpts)

func nsinsider(instanceID string, targetPid int, mod func(*exec.Cmd), opts ...nsinsiderOpt) error {
	cfg := nsinsiderOpts{
		MountNS: true,
	}
	for _, o := range opts {
		o(&cfg)
	}

	base, err := os.Executable()
	if err != nil {
		return err
	}

	type mnt struct {
		Env    string
		Source string
		Flags  int
	}
	var nss []mnt
	if cfg.MountNS {
		nss = append(nss,
			mnt{"_LIBNSENTER_ROOTFD", fmt.Sprintf("/proc/%d/root", targetPid), unix.O_PATH},
			mnt{"_LIBNSENTER_CWDFD", fmt.Sprintf("/proc/%d/cwd", targetPid), unix.O_PATH},
			mnt{"_LIBNSENTER_MNTNSFD", fmt.Sprintf("/proc/%d/ns/mnt", targetPid), os.O_RDONLY},
		)
	}
	if cfg.PidNS {
		nss = append(nss, mnt{"_LIBNSENTER_PIDNSFD", fmt.Sprintf("/proc/%d/ns/pid", targetPid), os.O_RDONLY})
	}
	if cfg.NetNS {
		nss = append(nss, mnt{"_LIBNSENTER_NETNSFD", fmt.Sprintf("/proc/%d/ns/net", targetPid), os.O_RDONLY})
	}

	stdioFdCount := 3
	cmd := exec.Command(filepath.Join(filepath.Dir(base), "nsinsider"))
	mod(cmd)
	cmd.Env = append(cmd.Env, "_LIBNSENTER_INIT=1", "GITPOD_INSTANCE_ID="+instanceID)
	for _, ns := range nss {
		f, err := os.OpenFile(ns.Source, ns.Flags, 0)
		if err != nil {
			return xerrors.Errorf("cannot open %s: %w", ns.Source, err)
		}
		defer f.Close()
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%d", ns.Env, stdioFdCount+len(cmd.ExtraFiles)))
		cmd.ExtraFiles = append(cmd.ExtraFiles, f)
	}

	rw := log.JSONWriter(log.WithFields(log.OWI("", "", instanceID)))
	defer rw.Close()

	cmd.Stdout = rw
	cmd.Stderr = rw
	err = cmd.Run()
	if err != nil {
		return xerrors.Errorf("cannot run nsinsider: %w", err)
	}
	return nil
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

	err = wbs.unPrepareForUserNS()
	if err != nil {
		log.WithError(err).WithFields(owi).Error("mark FS unmount failed")
		success = false
	}

	return &api.TeardownResponse{Success: success}, nil
}

func (wbs *InWorkspaceServiceServer) unPrepareForUserNS() error {
	mountpoint := filepath.Join(wbs.Session.ServiceLocNode, "mark")
	err := nsinsider(wbs.Session.InstanceID, 1, func(c *exec.Cmd) {
		c.Args = append(c.Args, "unmount", "--target", mountpoint)
	})
	if err != nil {
		return xerrors.Errorf("cannot unmount mark at %s: %w", mountpoint, err)
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
