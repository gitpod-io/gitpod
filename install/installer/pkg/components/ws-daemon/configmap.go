// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	wsdapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cgroup"
	wsdconfig "github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/netlimit"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var fsshift wsdapi.FSShiftMethod
	switch ctx.Config.Workspace.Runtime.FSShiftMethod {
	case config.FSShiftShiftFS:
		fsshift = wsdapi.FSShiftMethod_SHIFTFS
	default:
		return nil, fmt.Errorf("unknown fs shift method: %s", ctx.Config.Workspace.Runtime.FSShiftMethod)
	}

	cpuLimitConfig := cpulimit.Config{
		Enabled:        false,
		CGroupBasePath: "/mnt/node-cgroups",
		ControlPeriod:  util.Duration(15 * time.Second),
	}
	var ioLimitConfig daemon.IOLimitConfig

	var procLimit int64
	networkLimitConfig := netlimit.Config{
		Enabled:              false,
		Enforce:              false,
		ConnectionsPerMinute: 3000,
		BucketSize:           1000,
	}

	oomScoreAdjConfig := cgroup.OOMScoreAdjConfig{
		Enabled: false,
		Tier1:   0,
		Tier2:   0,
	}

	runtimeMapping := make(map[string]string)
	// default runtime mapping
	runtimeMapping[ctx.Config.Workspace.Runtime.ContainerDRuntimeDir] = "/mnt/node0"

	var wscontroller daemon.WorkspaceControllerConfig

	// default workspace network CIDR (and fallback)
	workspaceCIDR := "10.0.5.0/30"

	ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace == nil {
			return nil
		}

		cpuLimitConfig.Enabled = ucfg.Workspace.CPULimits.Enabled
		cpuLimitConfig.BurstLimit = ucfg.Workspace.CPULimits.BurstLimit
		cpuLimitConfig.Limit = ucfg.Workspace.CPULimits.Limit
		cpuLimitConfig.TotalBandwidth = ucfg.Workspace.CPULimits.NodeCPUBandwidth

		ioLimitConfig.WriteBWPerSecond = ucfg.Workspace.IOLimits.WriteBWPerSecond
		ioLimitConfig.ReadBWPerSecond = ucfg.Workspace.IOLimits.ReadBWPerSecond
		ioLimitConfig.WriteIOPS = ucfg.Workspace.IOLimits.WriteIOPS
		ioLimitConfig.ReadIOPS = ucfg.Workspace.IOLimits.ReadIOPS

		networkLimitConfig.Enabled = ucfg.Workspace.NetworkLimits.Enabled
		networkLimitConfig.Enforce = ucfg.Workspace.NetworkLimits.Enforce
		networkLimitConfig.ConnectionsPerMinute = ucfg.Workspace.NetworkLimits.ConnectionsPerMinute
		networkLimitConfig.BucketSize = ucfg.Workspace.NetworkLimits.BucketSize

		oomScoreAdjConfig.Enabled = ucfg.Workspace.OOMScores.Enabled
		oomScoreAdjConfig.Tier1 = ucfg.Workspace.OOMScores.Tier1
		oomScoreAdjConfig.Tier2 = ucfg.Workspace.OOMScores.Tier2

		if len(ucfg.Workspace.WSDaemon.Runtime.NodeToContainerMapping) > 0 {
			// reset map
			runtimeMapping = make(map[string]string)
			for _, value := range ucfg.Workspace.WSDaemon.Runtime.NodeToContainerMapping {
				runtimeMapping[value.Path] = value.Value
			}
		}

		procLimit = ucfg.Workspace.ProcLimit

		wscontroller.MaxConcurrentReconciles = 15

		if ucfg.Workspace.WorkspaceCIDR != "" {
			workspaceCIDR = ucfg.Workspace.WorkspaceCIDR
		}

		return nil
	})

	wsdcfg := wsdconfig.Config{
		Daemon: daemon.Config{
			Runtime: daemon.RuntimeConfig{
				KubernetesNamespace: ctx.Namespace,
				SecretsNamespace:    common.WorkspaceSecretsNamespace,
				Container: &container.Config{
					Runtime: container.RuntimeContainerd,
					Mapping: runtimeMapping,
					Mounts: container.NodeMountsLookupConfig{
						ProcLoc: "/mnt/mounts",
					},
					Containerd: &container.ContainerdConfig{
						SocketPath: "/mnt/containerd/containerd.sock",
					},
				},
				WorkspaceCIDR: workspaceCIDR,
			},
			Content: content.Config{
				WorkingArea:     ContainerWorkingAreaMk2,
				WorkingAreaNode: HostWorkingAreaMk2,
				TmpDir:          "/tmp",
				UserNamespaces: content.UserNamespacesConfig{
					FSShift: content.FSShiftMethod(fsshift),
				},
				Storage: common.StorageConfig(ctx),
				Backup: content.BackupConfig{
					Timeout:  util.Duration(time.Minute * 5),
					Attempts: 3,
				},
				Initializer: content.InitializerConfig{
					Command: "/app/content-initializer",
				},
			},
			Uidmapper: iws.UidmapperConfig{
				ProcLocation: "/proc",
				RootRange: iws.UIDRange{
					Start: 33333,
					Size:  1,
				},
				UserRange: []iws.UIDRange{{
					Start: 100000,
					Size:  70000,
				}},
			},
			CPULimit:  cpuLimitConfig,
			IOLimit:   ioLimitConfig,
			ProcLimit: procLimit,
			NetLimit:  networkLimitConfig,
			OOMScores: oomScoreAdjConfig,
			DiskSpaceGuard: diskguard.Config{
				Enabled:  true,
				Interval: util.Duration(5 * time.Minute),
				Locations: []diskguard.LocationConfig{{
					Path:          ContainerWorkingAreaMk2,
					MinBytesAvail: 21474836480,
				}},
			},
			WorkspaceController: wscontroller,
		},
		Service: baseserver.ServerConfiguration{
			Address: fmt.Sprintf("0.0.0.0:%d", ServicePort),
			TLS: &baseserver.TLSConfiguration{
				CAPath:   "/certs/ca.crt",
				CertPath: "/certs/tls.crt",
				KeyPath:  "/certs/tls.key",
			},
		},
	}
	fc, err := common.ToJSONString(wsdcfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ws-daemon config: %w", err)
	}

	return []runtime.Object{&corev1.ConfigMap{
		TypeMeta: common.TypeMetaConfigmap,
		ObjectMeta: metav1.ObjectMeta{
			Name:        Component,
			Namespace:   ctx.Namespace,
			Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
			Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
		},
		Data: map[string]string{
			"config.json": string(fc),
		},
	}}, nil
}
