// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package iws

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
)

// Uidmapper provides UID mapping services for creating Linux user namespaces
// from within a workspace.
type Uidmapper struct {
	Config  UidmapperConfig
	Runtime container.Runtime
}

// UidmapperConfig configures the UID mapper
type UidmapperConfig struct {
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

// HandleUIDMappingRequest performs a UID mapping request
func (m *Uidmapper) HandleUIDMappingRequest(ctx context.Context, req *api.WriteIDMappingRequest, containerID container.ID, instanceID string) (err error) {
	var reqjson []byte
	reqjson, err = protojson.Marshal(req)
	if err != nil {
		return err
	}

	log := log.WithFields(map[string]interface{}{
		"req":         string(reqjson),
		"containerID": containerID,
		"instanceId":  instanceID,
	})

	log.Debug("received UID mapping request")

	err = m.validateMapping(req.Mapping)
	if err != nil {
		return err
	}

	containerPID, err := m.Runtime.ContainerPID(ctx, containerID)
	if err != nil {
		log.WithError(err).Error("handleUIDMappingRequest: cannot get containerPID")
		return status.Error(codes.Internal, "cannot establish mapping")
	}

	log.WithField("containerPID", containerPID)

	hostPID, err := m.findHostPID(uint64(containerPID), uint64(req.Pid))
	if err != nil {
		log.WithError(err).Error("handleUIDMappingRequest: cannot find PID on host")
		return status.Error(codes.InvalidArgument, "cannot find PID")
	}

	log = log.WithField("hostPID", hostPID)

	err = WriteMapping(hostPID, req.Gid, req.Mapping)
	if err != nil {
		log.WithError(err).Error("handleUIDMappingRequest: cannot write mapping")
		return status.Error(codes.FailedPrecondition, "cannot write mapping")
	}

	log.Debug("established UID/GID mapping")

	return nil
}

func (m *Uidmapper) validateMapping(mapping []*api.WriteIDMappingRequest_Mapping) error {
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
func WriteMapping(hostPID uint64, gid bool, mapping []*api.WriteIDMappingRequest_Mapping) (err error) {
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

	err = os.WriteFile(pth, []byte(fc), 0644)
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
		if len(paths) == 0 {
			return 0, xerrors.Errorf("cannot find in-container PID %d on the node", inContainerPID)
		}

		p := paths[0]
		paths = paths[1:]

		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}

		p = filepath.Join(m.Config.ProcLocation, p)

		pid, nspid, err := readStatusFile(filepath.Join(p, "status"))
		if err != nil {
			log.WithField("file", filepath.Join(p, "status")).WithError(err).Debug("findHostPID: cannot read PID file")
			continue
		}
		for _, nsp := range nspid {
			if nsp == inContainerPID {
				return pid, nil
			}
		}

		taskfn := filepath.Join(p, "task")
		tasks, err := os.ReadDir(taskfn)
		if err != nil {
			continue
		}
		for _, task := range tasks {
			cldrn, err := os.ReadFile(filepath.Join(taskfn, task.Name(), "children"))
			if err != nil {
				continue
			}
			paths = append(paths, strings.Fields(string(cldrn))...)
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
