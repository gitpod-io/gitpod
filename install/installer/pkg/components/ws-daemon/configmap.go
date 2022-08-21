// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
	wsdconfig "github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/netlimit"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	var fsshift wsdapi.FSShiftMethod
	switch ctx.Config.Workspace.Runtime.FSShiftMethod {
	case config.FSShiftFuseFS:
		fsshift = wsdapi.FSShiftMethod_FUSE
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
		ConnectionsPerMinute: 3000,
		BucketSize:           1000,
	}

	runtimeMapping := make(map[string]string)
	// default runtime mapping
	runtimeMapping[ctx.Config.Workspace.Runtime.ContainerDRuntimeDir] = "/mnt/node0"

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
		networkLimitConfig.ConnectionsPerMinute = ucfg.Workspace.NetworkLimits.ConnectionsPerMinute
		networkLimitConfig.BucketSize = ucfg.Workspace.NetworkLimits.BucketSize

		if len(ucfg.Workspace.WSDaemon.Runtime.NodeToContainerMapping) > 0 {
			// reset map
			runtimeMapping = make(map[string]string)
			for _, value := range ucfg.Workspace.WSDaemon.Runtime.NodeToContainerMapping {
				runtimeMapping[value.Path] = value.Value
			}
		}

		procLimit = ucfg.Workspace.ProcLimit

		return nil
	})

	wsdcfg := wsdconfig.Config{
		Daemon: daemon.Config{
			Runtime: daemon.RuntimeConfig{
				KubernetesNamespace: ctx.Namespace,
				Container: &container.Config{
					Runtime: container.RuntimeContainerd,
					Mapping: runtimeMapping,
					Mounts: container.NodeMountsLookupConfig{
						ProcLoc: "/mnt/mounts",
					},
					Containerd: &container.ContainerdConfig{
						SocketPath: "/mnt/containerd.sock",
					},
				},
			},
			Content: content.Config{
				WorkingArea:     "/mnt/workingarea",
				WorkingAreaNode: HostWorkingArea,
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
			Hosts: hosts.Config{
				Enabled:       true,
				NodeHostsFile: "/mnt/hosts",
				FixedHosts: map[string][]hosts.Host{
					"registryFacade": {{
						Name: fmt.Sprintf("reg.%s", ctx.Config.Domain),
						Addr: "127.0.0.1",
					}},
				},
			},
			DiskSpaceGuard: diskguard.Config{
				Enabled:  true,
				Interval: util.Duration(5 * time.Minute),
				Locations: []diskguard.LocationConfig{{
					Path:          "/mnt/workingarea",
					MinBytesAvail: 21474836480,
				}},
			},
		},
		Service: baseserver.ServerConfiguration{
			Address: fmt.Sprintf(":%d", ServicePort),
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
