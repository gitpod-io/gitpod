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
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
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

	wsdcfg := wsdconfig.Config{
		Daemon: daemon.Config{
			Runtime: daemon.RuntimeConfig{
				KubernetesNamespace: ctx.Namespace,
				Container: &container.Config{
					Runtime: container.RuntimeContainerd,
					Mapping: map[string]string{
						ctx.Config.Workspace.Runtime.ContainerDRuntimeDir: "/mnt/node0",
					},
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
			Resources: resources.Config{
				// TODO(cw): how do we best expose this config?
				CPUBuckets: []resources.Bucket{
					{Budget: 90000, Limit: 500},
					{Budget: 120000, Limit: 400},
					{Budget: 54000, Limit: 200},
				},
				ControlPeriod:   "15m",
				SamplingPeriod:  "10s",
				CGroupsBasePath: "/mnt/node-cgroups",
				ProcessPriorities: map[resources.ProcessType]int{
					resources.ProcessSupervisor: 0,
					resources.ProcessTheia:      5,
					resources.ProcessShell:      6,
					resources.ProcessDefault:    10,
				},
			},
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
			ReadinessSignal: daemon.ReadinessSignalConfig{
				Enabled: true,
				Addr:    ":9999",
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
		Service: wsdconfig.AddrTLS{
			Addr: fmt.Sprintf(":%d", ServicePort),
			TLS: &wsdconfig.TLS{
				Authority:   "/certs/ca.crt",
				Certificate: "/certs/tls.crt",
				PrivateKey:  "/certs/tls.key",
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
		TypeMeta: common.TypeMetaConfigmap,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component, ctx),
		},
		Data: map[string]string{
			"config.json": string(fc),
		},
	}}, nil
}
