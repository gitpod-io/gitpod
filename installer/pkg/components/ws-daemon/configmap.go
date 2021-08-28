// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsdaemon

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	wsdapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	wsdconfig "github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

const (
	locContainerWorkingArea = "/mnt/workingarea"
	locNodeWorkingArea      = "/mnt/disks/ssd0/workspaces"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var fsshift wsdapi.FSShiftMethod
	switch ctx.Config.WorkspaceRuntime.FSShiftMethod {
	case config.FSShiftFuseFS:
		fsshift = wsdapi.FSShiftMethod_FUSE
	case config.FSShiftShiftFS:
		fsshift = wsdapi.FSShiftMethod_SHIFTFS
	default:
		return nil, fmt.Errorf("unknown fs shift method: %s", ctx.Config.WorkspaceRuntime.FSShiftMethod)
	}

	wsdcfg := wsdconfig.Config{
		Daemon: daemon.Config{
			Runtime: daemon.RuntimeConfig{
				Container: &container.Config{
					Runtime: container.RuntimeContainerd,
					Mounts: container.NodeMountsLookupConfig{
						ProcLoc: "/mnt/rootfs/proc",
					},
					Containerd: &container.ContainerdConfig{
						SocketPath: "/mnt/rootfs/run/containerd/containerd.sock",
					},
				},
			},
			Content: content.Config{
				WorkingArea:     locContainerWorkingArea,
				WorkingAreaNode: locNodeWorkingArea,
				UserNamespaces: content.UserNamespacesConfig{
					FSShift: content.FSShiftMethod(fsshift),
				},
				Storage: common.StorageConfig(&ctx.Config),
			},
			Uidmapper: iws.UidmapperConfig{
				ProcLocation: "/mnt/rootfs/proc",
				RootRange: iws.UIDRange{
					Start: 33333,
					Size:  1,
				},
				UserRange: []iws.UIDRange{{
					Start: 100000,
					Size:  70000,
				}},
			},
			Resources: resources.Config{
				// TODO(cw): how do we best expose this config?
				CPUBuckets: []resources.Bucket{
					{Budget: 90000, Limit: 500},
					{Budget: 120000, Limit: 400},
					{Budget: 54000, Limit: 200},
				},
				ControlPeriod:   "15m",
				SamplingPeriod:  "10s",
				CGroupsBasePath: "/mnt/rootfs/sys/fs/cgroup",
				ProcessPriorities: map[resources.ProcessType]int{
					resources.ProcessSupervisor: 0,
					resources.ProcessTheia:      5,
					resources.ProcessShell:      6,
					resources.ProcessDefault:    10,
				},
			},
			Hosts: hosts.Config{
				Enabled:       true,
				NodeHostsFile: "/mnt/rootfs/etc/hosts",
				FixedHosts: map[string][]hosts.Host{
					"registryFacade": {{
						Name: fmt.Sprintf("reg.%s", ctx.Config.Domain),
						Addr: "127.0.0.1",
					}},
				},
			},
			ReadinessSignal: daemon.ReadinessSignalConfig{
				Enabled: true,
				Addr:    ":9999",
			},
			DiskSpaceGuard: diskguard.Config{
				Enabled:  true,
				Interval: util.Duration(5 * time.Minute),
				Locations: []diskguard.LocationConfig{{
					Path:          locContainerWorkingArea,
					MinBytesAvail: 21474836480,
				}},
			},
		},
		Prometheus: wsdconfig.Addr{
			Addr: "localhost:9500",
		},
		PProf: wsdconfig.Addr{
			Addr: "localhost:6060",
		},
	}
	fc, err := json.MarshalIndent(wsdcfg, "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-daemon config: %w", err)
	}

	return []runtime.Object{&corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:   component,
			Labels: common.DefaultLabels(component),
		},
		Data: map[string]string{
			"config.json": string(fc),
		},
	}}, nil
}
