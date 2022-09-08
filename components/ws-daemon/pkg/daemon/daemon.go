// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cgroup"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/netlimit"
)

// NewDaemon produces a new daemon
func NewDaemon(config Config, reg prometheus.Registerer) (*Daemon, error) {
	clientset, err := newClientSet(config.Runtime.Kubeconfig)
	if err != nil {
		return nil, err
	}
	containerRuntime, err := container.FromConfig(config.Runtime.Container)
	if err != nil {
		return nil, err
	}
	if containerRuntime == nil {
		return nil, xerrors.Errorf("no container runtime configured")
	}

	nodename := os.Getenv("NODENAME")
	if nodename == "" {
		return nil, xerrors.Errorf("NODENAME env var isn't set")
	}

	markUnmountFallback, err := NewMarkUnmountFallback(reg)
	if err != nil {
		return nil, err
	}

	cgroupV1IOLimiter, err := cgroup.NewIOLimiterV1(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
	if err != nil {
		return nil, err
	}

	cgroupV2IOLimiter, err := cgroup.NewIOLimiterV2(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
	if err != nil {
		return nil, err
	}

	procV2Plugin, err := cgroup.NewProcLimiterV2(config.ProcLimit)
	if err != nil {
		return nil, err
	}

	cgroupPlugins, err := cgroup.NewPluginHost(config.CPULimit.CGroupBasePath,
		&cgroup.CacheReclaim{},
		&cgroup.FuseDeviceEnablerV1{},
		&cgroup.FuseDeviceEnablerV2{},
		cgroupV1IOLimiter,
		cgroupV2IOLimiter,
		&cgroup.ProcessPriorityV2{
			ProcessPriorities: map[cgroup.ProcessType]int{
				cgroup.ProcessSupervisor: -10,

				cgroup.ProcessIDE:          -10,
				cgroup.ProcessWebIDEHelper: -5,

				cgroup.ProcessCodeServer:       -10,
				cgroup.ProcessCodeServerHelper: -5,
			},
		},
		procV2Plugin,
	)
	if err != nil {
		return nil, err
	}

	err = reg.Register(cgroupPlugins)
	if err != nil {
		return nil, xerrors.Errorf("cannot register cgroup plugin metrics: %w", err)
	}

	var configReloader CompositeConfigReloader
	configReloader = append(configReloader, ConfigReloaderFunc(func(ctx context.Context, config *Config) error {
		cgroupV1IOLimiter.Update(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
		cgroupV2IOLimiter.Update(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
		procV2Plugin.Update(config.ProcLimit)
		return nil
	}))

	listener := []dispatch.Listener{
		cpulimit.NewDispatchListener(&config.CPULimit, reg),
		markUnmountFallback,
		cgroupPlugins,
	}

	if config.NetLimit.Enabled {
		listener = append(listener, netlimit.NewConnLimiter(config.NetLimit, reg))
	}

	dsptch, err := dispatch.NewDispatch(containerRuntime, clientset, config.Runtime.KubernetesNamespace, nodename, listener...)
	if err != nil {
		return nil, err
	}

	contentService, err := content.NewWorkspaceService(
		context.Background(),
		config.Content,
		config.Runtime.KubernetesNamespace,
		containerRuntime,
		dsptch.WorkspaceExistsOnNode,
		&iws.Uidmapper{Config: config.Uidmapper, Runtime: containerRuntime},
		config.CPULimit.CGroupBasePath,
		reg,
	)
	if err != nil {
		return nil, xerrors.Errorf("cannot create content service: %w", err)
	}

	dsk := diskguard.FromConfig(config.DiskSpaceGuard, clientset, nodename)

	hsts, err := hosts.FromConfig(config.Hosts, clientset, config.Runtime.KubernetesNamespace)
	if err != nil {
		return nil, err
	}

	return &Daemon{
		Config: config,

		dispatch:       dsptch,
		content:        contentService,
		diskGuards:     dsk,
		hosts:          hsts,
		configReloader: configReloader,
	}, nil
}

func newClientSet(kubeconfig string) (res *kubernetes.Clientset, err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("cannot create clientset: %w", err)
		}
	}()

	if kubeconfig != "" {
		res, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
		return kubernetes.NewForConfig(res)
	}

	k8s, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}
	return kubernetes.NewForConfig(k8s)
}

// Daemon connects all the individual bits and bobs that make up the workspace daemon
type Daemon struct {
	Config Config

	dispatch       *dispatch.Dispatch
	content        *content.WorkspaceService
	diskGuards     []*diskguard.Guard
	hosts          hosts.Controller
	configReloader ConfigReloader
}

func (d *Daemon) ReloadConfig(ctx context.Context, cfg *Config) error {
	return d.configReloader.ReloadConfig(ctx, cfg)
}

// Start runs all parts of the daemon until stop is called
func (d *Daemon) Start() error {
	err := d.dispatch.Start()
	if err != nil {
		return xerrors.Errorf("cannot start dispatch: %w", err)
	}

	go d.content.Start()
	for _, dsk := range d.diskGuards {
		go dsk.Start()
	}
	if d.hosts != nil {
		go d.hosts.Start()
	}

	return nil
}

// Register registers all gRPC services provided by this daemon
func (d *Daemon) Register(srv *grpc.Server) {
	api.RegisterWorkspaceContentServiceServer(srv, d.content)
}

// Stop gracefully shuts down the daemon. Once stopped, it
// cannot be started again.
func (d *Daemon) Stop() error {
	var errs []error
	errs = append(errs, d.dispatch.Close())
	errs = append(errs, d.content.Close())
	if d.hosts != nil {
		errs = append(errs, d.hosts.Close())
	}

	for _, err := range errs {
		if err != nil {
			return err
		}
	}

	return nil
}

func (d *Daemon) ReadinessProbe() func() error {
	return func() error {
		if d.hosts != nil && !d.hosts.DidUpdate() {
			err := fmt.Errorf("host controller not ready yet")
			log.WithError(err).Errorf("readiness probe failure")
			return err
		}

		// use 2 second timeout to ensure that IsContainerdReady() will not block indefinetely
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(2*time.Second))
		defer cancel()
		isContainerdReady, err := d.dispatch.Runtime.IsContainerdReady(ctx)
		if err != nil {
			log.WithError(err).Errorf("readiness probe failure: containerd error")
			return fmt.Errorf("containerd error: %v", err)
		}

		if !isContainerdReady {
			err := fmt.Errorf("containerd is not ready")
			log.WithError(err).Error("readiness probe failure")
			return err
		}

		return nil
	}
}
