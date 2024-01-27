// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	cgroups_v2 "github.com/gitpod-io/gitpod/common-go/cgroups/v2"
	ctntcfg "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/test/pkg/agent/daemon/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/google/nftables"
	"github.com/mitchellh/go-ps"
	"github.com/prometheus/procfs"
	"github.com/vishvananda/netns"
	"golang.org/x/xerrors"
)

func main() {
	done := make(chan struct{})
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/shutdown", shugtdownHandler(done))
		_ = http.ListenAndServe(":8080", mux)
	}()
	integration.ServeAgent(done, new(DaemonAgent))
}

func shugtdownHandler(done chan struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		close(done)
		w.Write([]byte("shutdown"))
		w.WriteHeader(http.StatusOK)
	}
}

type daemonConfig struct {
	Daemon struct {
		Content struct {
			Storage ctntcfg.StorageConfig `json:"storage"`
		} `json:"content"`
	} `json:"daemon"`
}

// DaemonAgent provides ingteration test services from within ws-daemon
type DaemonAgent struct {
}

// CreateBucket reads the daemon's config, and creates a bucket
func (*DaemonAgent) CreateBucket(args *api.CreateBucketRequest, resp *api.CreateBucketResponse) error {
	*resp = api.CreateBucketResponse{}

	fc, err := os.ReadFile("/config/config.json")
	if err != nil {
		return err
	}
	var cfg daemonConfig
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return err
	}

	ac, err := storage.NewDirectAccess(&cfg.Daemon.Content.Storage)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	err = ac.Init(ctx, args.Owner, args.Workspace, "")
	if err != nil {
		return err
	}

	err = ac.EnsureExists(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (*DaemonAgent) GetWorkspaceResources(args *api.GetWorkspaceResourcesRequest, resp *api.GetWorkspaceResourcesResponse) error {
	*resp = api.GetWorkspaceResourcesResponse{}

	filepath.WalkDir("/mnt/node-cgroups", func(path string, d fs.DirEntry, err error) error {
		if strings.Contains(path, args.ContainerId) {
			var returnErr error
			cpu := cgroups_v2.NewCpuController(path)
			quota, _, err := cpu.Max()
			if err == nil {
				resp.Found = true
				resp.CpuQuota = int64(quota)
			} else {
				returnErr = err
			}

			io := cgroups_v2.NewIOController(path)
			devices, err := io.Max()
			if err == nil {
				resp.FoundIOMax = true
				resp.IOMax = devices
			} else {
				returnErr = err
			}

			return returnErr
		}

		return nil
	})
	return nil
}

func (*DaemonAgent) VerifyRateLimitingRule(args *api.VerifyRateLimitingRuleRequest, resp *api.VerifyRateLimitingRuleResponse) error {
	*resp = api.VerifyRateLimitingRuleResponse{}
	ring0Pid, err := findWorkspaceRing0Pid(args.ContainerId)
	if err != nil {
		return err
	}

	netns, err := netns.GetFromPid(int(ring0Pid))
	if err != nil {
		return fmt.Errorf("could not get handle for network namespace: %w", err)
	}

	nftconn, err := nftables.New(nftables.WithNetNSFd(int(netns)))
	if err != nil {
		return fmt.Errorf("could not establish netlink connection for nft: %w", err)
	}

	gitpodTable := &nftables.Table{
		Name:   "gitpod",
		Family: nftables.TableFamilyIPv4,
	}

	// Check if drop stats counter exists.
	counterObject, err := nftconn.GetObject(&nftables.CounterObj{
		Table: gitpodTable,
		Name:  "ws-connection-drop-stats",
	})
	if err != nil {
		return fmt.Errorf("could not get connection drop stats: %w", err)
	}
	_, ok := counterObject.(*nftables.CounterObj)
	if !ok {
		return fmt.Errorf("could not cast counter object")
	}

	// Check if set exists.
	_, err = nftconn.GetSetByName(gitpodTable, "ws-connections")
	if err != nil {
		return fmt.Errorf("could not get set ws-connections: %w", err)
	}

	// Check if ratelimit chain exists.
	chains, err := nftconn.ListChains()
	if err != nil {
		return fmt.Errorf("could not list chains: %w", err)
	}
	var found bool
	for _, c := range chains {
		if c.Name == "ratelimit" {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("chain ratelimit not found")
	}

	return nil
}

// findWorkspaceRing0Pid finds the ring0 process for a workspace container.
// It first looks up the container's process, then finds the ring0 process among its children.
func findWorkspaceRing0Pid(containerId string) (int, error) {
	// Hack: need to use both procfs and go-ps, as the former provides a process' command line,
	// while the latter provides the parent PID. Neither does both ¯\_(ツ)_/¯
	pfs, err := procfs.NewFS("/proc")
	if err != nil {
		return 0, err
	}
	procs, err := ps.Processes()
	if err != nil {
		return 0, err
	}
	var containerProc ps.Process
	for _, p := range procs {
		if processContainsArg(pfs, p.Pid(), containerId) {
			containerProc = p
			break
		}
	}
	if containerProc == nil {
		return 0, xerrors.Errorf("no process found for container id %s", containerId)
	}

	// Find ring0 among the container's child processes.
	ring0Pid, found := findRing0(pfs, procs, containerProc)
	if !found {
		return 0, xerrors.Errorf("no ring0 process found for container id %s", containerId)
	}
	return ring0Pid, nil
}

func processContainsArg(pfs procfs.FS, pid int, arg string) bool {
	p, err := pfs.Proc(pid)
	if err != nil {
		return false
	}
	cmd, _ := p.CmdLine()
	for _, c := range cmd {
		if strings.Contains(c, arg) {
			return true
		}
	}
	return false
}

func findRing0(pfs procfs.FS, all []ps.Process, fromParent ps.Process) (int, bool) {
	for _, proc := range all {
		if proc.PPid() != fromParent.Pid() {
			continue
		}
		if processContainsArg(pfs, proc.Pid(), "ring0") {
			// We found the ring0 process.
			return proc.Pid(), true
		}

		// Try looking for ring0 in any child processes.
		pid, found := findRing0(pfs, all, proc)
		if found {
			return pid, true
		}
	}
	return 0, false
}
