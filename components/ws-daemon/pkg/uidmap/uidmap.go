// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package uidmap

import (
	"bufio"
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	ndeapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/golang/protobuf/jsonpb"
	"github.com/sirupsen/logrus"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

//
// BEWARE
// The code in this file, i.e. everything offered by WorkspaceBackupServer is accessible without further protection
// by user-reachable code. There's no server or ws-man in front of this interface. Keep this interface minimal, and
// be defensive!
//

const (
	// timeBetweenConnectionAttempts is the time we wait until we make another connection attempt to a workspace
	timeBetweenConnectionAttempts = 1 * time.Second

	// time between calls is the time that has to pass until we answer an RPC call again
	timeBetweenCalls = 10 * time.Second

	// requestsBeforeBreak is the number of requests a client can make to the canary before the canary
	// disconnects and waits timeBetweenCalls.
	requestsBeforeBreak = 10

	// withUsernamespaceAnnotation is set on workspaces which are wrapped in a user namespace (or have some form of user namespace support)
	// Beware: this annotation is duplicated/copied in ws-manager
	withUsernamespaceAnnotation = "gitpod/withUsernamespace"
)

// Uidmapper provides UID mapping services for creating Linux user namespaces
// from within a workspace.
type Uidmapper struct {
	Config Config
}

// Config configures the UID mapper
type Config struct {
	// ProcLocation is the location of the node's proc filesystem
	ProcLocation string `json:"procLocation"`
	// RootRange is the range to which one can map the root (uid 0) user/group to
	RootRange UIDRange `json:"rootUIDRange"`
	// UserRange is the range to which any other user can be mapped to
	UserRange []UIDRange `json:"userUIDRange"`
}

// UIDRange represents a range of UID/GID's
type UIDRange struct {
	Start uint32 `json:"start"`
	Size  uint32 `json:"size"`
}

// Contains returns true if the other range is contained by this one
func (r UIDRange) Contains(start, size uint32) bool {
	if start < r.Start {
		return false
	}
	if size > r.Size {
		return false
	}
	return true
}

type connectionError struct {
	error
}

func (c connectionError) Error() string {
	return fmt.Sprintf("cannot dial workspace: %s", c.error.Error())
}

func (c connectionError) Unwrap() error {
	return c.error
}

// WorkspaceAdded is called when a new workspace is added
func (m *Uidmapper) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	if _, ok := ws.Pod.Annotations[withUsernamespaceAnnotation]; !ok {
		// this isn't a user namespaced workspace - nothing to do here
		return nil
	}

	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	var connectionAttempts int
	for {
		err := m.establishUIDCanary(ctx, ws, disp)

		delay := timeBetweenCalls
		if cerr, ok := err.(connectionError); ok {
			if connectionAttempts > 10 {
				log.WithFields(ws.OWI()).WithError(cerr.Unwrap()).Warn("UID mapper canary connection error")
			}
			connectionAttempts++

			delay = timeBetweenConnectionAttempts
		} else if err != nil {
			log.WithFields(ws.OWI()).WithError(err).Warn("UID mapper canary error")
		} else if ctx.Err() != nil {
			break
		}

		time.Sleep(delay)
	}
	return nil
}

// establishUIDCanary attempts to connect to a workspace and install the uidmapper canary. If anything goes wrong
// in the process, we'll return an error. The caller is expected to try again after waiting some time, unless the ctx errors.
// If the client has excaused its requests, we'll return with a nil error, in which case the caller is also expected
// to call again after waiting some more time.
func (m *Uidmapper) establishUIDCanary(ctx context.Context, ws *dispatch.Workspace, disp *dispatch.Dispatch) (err error) {
	if err = ctx.Err(); err != nil {
		return
	}

	host := wsk8s.WorkspaceSupervisorEndpoint(ws.WorkspaceID, disp.KubernetesNamespace)
	dialCtx, cancel := context.WithTimeout(ctx, timeBetweenConnectionAttempts)
	defer cancel()
	conn, err := grpc.DialContext(dialCtx, host, grpc.WithInsecure())
	if err != nil {
		return connectionError{err}
	}
	iwh := ndeapi.NewInWorkspaceHelperClient(conn)

	canary, err := iwh.UidmapCanary(ctx)
	if err != nil {
		return err
	}
	log.WithFields(ws.OWI()).Info("installed uid mapper canary")

	for i := 0; i < requestsBeforeBreak; i++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		msg, err := canary.Recv()
		if err != nil {
			return err
		}

		var resp ndeapi.UidmapCanaryResponse
		err = m.handleUIDMappingRequest(ctx, disp, ws, msg)
		if err != nil {
			if st, ok := status.FromError(err); ok {
				resp.Message = st.Message()
				resp.ErrorCode = uint32(st.Code())
			} else {
				resp.Message = err.Error()
				resp.ErrorCode = uint32(codes.Internal)
			}
		}
		err = canary.Send(&resp)
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *Uidmapper) handleUIDMappingRequest(ctx context.Context, disp *dispatch.Dispatch, ws *dispatch.Workspace, req *ndeapi.UidmapCanaryRequest) (err error) {
	reqjson, _ := (&jsonpb.Marshaler{}).MarshalToString(req)
	fields := logrus.Fields{"req": reqjson, "containerID": ws.ContainerID, "workspaceId": ws.WorkspaceID, "instanceId": ws.InstanceID}
	log.WithFields(fields).Info("received UID mapping request")

	err = m.validateMapping(req.Mapping)
	if err != nil {
		return err
	}

	containerPID, err := disp.CRI.ContainerPID(ctx, ws.ContainerID)
	if err != nil {
		log.WithError(err).WithFields(fields).Error("handleUIDMappingRequest: cannot get containerPID")
		return status.Error(codes.Internal, "cannot establish mapping")
	}
	fields["containerPID"] = containerPID

	hostPID, err := m.findHostPID(uint64(containerPID), uint64(req.Pid))
	if err != nil {
		log.WithError(err).WithFields(fields).Error("handleUIDMappingRequest: cannot find PID on host")
		return status.Error(codes.InvalidArgument, "cannot find PID")
	}
	fields["hostPID"] = hostPID

	err = WriteMapping(hostPID, req.Gid, req.Mapping)
	if err != nil {
		log.WithError(err).WithFields(fields).Error("handleUIDMappingRequest: cannot write mapping")
		return status.Error(codes.FailedPrecondition, "cannot write mapping")
	}

	log.WithFields(fields).Info("established UID/GID mapping")

	return nil
}

func (m *Uidmapper) validateMapping(mapping []*ndeapi.UidmapCanaryRequest_Mapping) error {
	for _, mp := range mapping {
		if mp.ContainerId == 0 && !m.Config.RootRange.Contains(mp.HostId, mp.Size) {
			return status.Error(codes.InvalidArgument, "mapping for UID 0 is out of range")
		}
		if mp.ContainerId > 0 {
			var found bool
			for _, r := range m.Config.UserRange {
				if r.Contains(mp.HostId, mp.Size) {
					found = true
					break
				}
			}
			if !found {
				return status.Errorf(codes.InvalidArgument, "mapping for UID %d is out of range", mp.ContainerId)
			}
		}
	}
	return nil
}

// WriteMapping writes uid_map and gid_map
func WriteMapping(hostPID uint64, gid bool, mapping []*ndeapi.UidmapCanaryRequest_Mapping) (err error) {
	// Note: unlike shadow's newuidmap/newgidmap we do not set /proc/PID/setgroups to deny because:
	//    - we're writing from a privileged process, hence don't trip that restriction introduced in Linux 3.39
	//    - denying setgroups would prevent any meaningfull use of the NS mapped "root" user (e.g. breaks apt-get)

	var fc string
	for _, m := range mapping {
		fc += fmt.Sprintf("%d %d %d\n", m.ContainerId, m.HostId, m.Size)
	}

	var fn string
	if gid {
		fn = "gid_map"
	} else {
		fn = "uid_map"
	}

	pth := fmt.Sprintf("/proc/%d/%s", hostPID, fn)
	log.WithField("path", pth).WithField("fc", fc).Debug("attempting to write UID mapping")

	err = ioutil.WriteFile(pth, []byte(fc), 0644)
	if err != nil {
		return xerrors.Errorf("cannot write UID/GID mapping: %w", err)
	}

	return nil
}

// findHosPID translates an in-container PID to the root PID namespace.
func (m *Uidmapper) findHostPID(containerPID, inContainerPID uint64) (uint64, error) {
	paths := []string{fmt.Sprint(containerPID)}
	seen := make(map[string]struct{})

	for {
		p := paths[0]
		paths = paths[1:]

		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}

		p = filepath.Join(m.Config.ProcLocation, p)

		pid, nspid, err := readStatusFile(filepath.Join(p, "status"))
		for _, nsp := range nspid {
			if nsp == inContainerPID {
				return pid, nil
			}
		}

		taskfn := filepath.Join(p, "task")
		tasks, err := ioutil.ReadDir(taskfn)
		if err != nil {
			continue
		}
		for _, task := range tasks {
			cldrn, err := ioutil.ReadFile(filepath.Join(taskfn, task.Name(), "children"))
			if err != nil {
				continue
			}
			paths = append(paths, strings.Fields(string(cldrn))...)
		}

		if len(paths) == 0 {
			return 0, fmt.Errorf("cannot find in-container PID %d on the node", inContainerPID)
		}
	}
}

func readStatusFile(fn string) (pid uint64, nspid []uint64, err error) {
	f, err := os.Open(fn)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "Pid:") {
			pid, err = strconv.ParseUint(strings.TrimSpace(strings.TrimPrefix(line, "Pid:")), 10, 64)
			if err != nil {
				err = xerrors.Errorf("cannot parse pid in %s: %w", fn, err)
				return
			}
		}
		if strings.HasPrefix(line, "NSpid:") {
			fields := strings.Fields(strings.TrimSpace(strings.TrimPrefix(line, "NSpid:")))
			for _, fld := range fields {
				var npid uint64
				npid, err = strconv.ParseUint(fld, 10, 64)
				if err != nil {
					err = xerrors.Errorf("cannot parse NSpid %v in %s: %w", fld, fn, err)
					return
				}

				nspid = append(nspid, npid)
			}
		}
	}
	if err = scanner.Err(); err != nil {
		return
	}

	return
}
