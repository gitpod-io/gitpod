// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"fmt"
	"os"
	"time"

	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cgroup"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/controller"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/netlimit"
)

var (
	scheme = runtime.NewScheme()
	// setupLog = ctrl.Log.WithName("setup")
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(workspacev1.AddToScheme(scheme))
}

// NewDaemon produces a new daemon
func NewDaemon(config Config, reg prometheus.Registerer) (*Daemon, error) {
	restCfg, err := newClientConfig(config.Runtime.Kubeconfig)
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(restCfg)
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
				cgroup.ProcessWorkspaceKit: -10,
				cgroup.ProcessSupervisor:   -10,

				cgroup.ProcessIDE:          -10,
				cgroup.ProcessWebIDEHelper: -5,

				cgroup.ProcessCodeServer:       -10,
				cgroup.ProcessCodeServerHelper: -5,
			},
			EnableOOMScoreAdj: config.OOMScores.Enabled,
			OOMScoreAdj: map[cgroup.ProcessType]int{
				cgroup.ProcessWorkspaceKit:     config.OOMScores.Tier1,
				cgroup.ProcessSupervisor:       config.OOMScores.Tier1,
				cgroup.ProcessCodeServer:       config.OOMScores.Tier1,
				cgroup.ProcessIDE:              config.OOMScores.Tier1,
				cgroup.ProcessCodeServerHelper: config.OOMScores.Tier2,
				cgroup.ProcessWebIDEHelper:     config.OOMScores.Tier2,
			},
		},
		procV2Plugin,
		cgroup.NewPSIMetrics(reg),
	)
	if err != nil {
		return nil, err
	}

	err = reg.Register(cgroupPlugins)
	if err != nil {
		return nil, xerrors.Errorf("cannot register cgroup plugin metrics: %w", err)
	}

	listener := []dispatch.Listener{
		cpulimit.NewDispatchListener(&config.CPULimit, reg),
		markUnmountFallback,
		cgroupPlugins,
	}

	netlimiter := netlimit.NewConnLimiter(config.NetLimit, reg)
	if config.NetLimit.Enabled {
		listener = append(listener, netlimiter)
	}

	var configReloader CompositeConfigReloader
	configReloader = append(configReloader, ConfigReloaderFunc(func(ctx context.Context, config *Config) error {
		cgroupV1IOLimiter.Update(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
		cgroupV2IOLimiter.Update(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
		procV2Plugin.Update(config.ProcLimit)
		if config.NetLimit.Enabled {
			netlimiter.Update(config.NetLimit)
		}
		return nil
	}))

	mgr, err := ctrl.NewManager(restCfg, ctrl.Options{
		Scheme:    scheme,
		Port:      9443,
		Namespace: config.Runtime.KubernetesNamespace,
	})
	if err != nil {
		return nil, err
	}

	dsptch, err := dispatch.NewDispatch(containerRuntime, clientset, config.Runtime.KubernetesNamespace, nodename, listener...)
	if err != nil {
		return nil, err
	}

	contentService, err := content.NewWorkspaceService(
		context.Background(),
		config.Content,
		containerRuntime,
		dsptch.WorkspaceExistsOnNode,
		&iws.Uidmapper{Config: config.Uidmapper, Runtime: containerRuntime},
		config.CPULimit.CGroupBasePath,
		reg,
	)
	if err != nil {
		return nil, xerrors.Errorf("cannot create content service: %w", err)
	}

	if config.WorkspaceController.Enabled {
		log.Info("enabling workspace CRD controller")

		contentCfg := config.Content
		contentCfg.WorkingArea += config.WorkspaceController.WorkingAreaSuffix
		contentCfg.WorkingAreaNode += config.WorkspaceController.WorkingAreaSuffix

		wsctrl, err := controller.NewWorkspaceController(mgr.GetClient(), controller.WorkspaceControllerOpts{
			NodeName:         nodename,
			ContentConfig:    contentCfg,
			UIDMapperConfig:  config.Uidmapper,
			ContainerRuntime: containerRuntime,
			CGroupMountPoint: config.CPULimit.CGroupBasePath,
			MetricsRegistry:  reg,
		})
		if err != nil {
			return nil, err
		}
		err = wsctrl.SetupWithManager(mgr)
		if err != nil {
			return nil, err
		}
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
		mgr:            mgr,
	}, nil
}

func newClientConfig(kubeconfig string) (*rest.Config, error) {
	if kubeconfig != "" {
		return clientcmd.BuildConfigFromFlags("", kubeconfig)
	}

	return rest.InClusterConfig()
}

// Daemon connects all the individual bits and bobs that make up the workspace daemon
type Daemon struct {
	Config Config

	dispatch       *dispatch.Dispatch
	content        *content.WorkspaceService
	diskGuards     []*diskguard.Guard
	hosts          hosts.Controller
	configReloader ConfigReloader
	mgr            ctrl.Manager

	cancel context.CancelFunc
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

	go d.hosts.Start()

	var ctx context.Context
	ctx, d.cancel = context.WithCancel(context.Background())
	go func() {
		err := d.mgr.Start(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot start controller")
		}
	}()

	return nil
}

// Register registers all gRPC services provided by this daemon
func (d *Daemon) Register(srv *grpc.Server) {
	api.RegisterWorkspaceContentServiceServer(srv, d.content)
}

// Stop gracefully shuts down the daemon. Once stopped, it
// cannot be started again.
func (d *Daemon) Stop() error {
	d.cancel()

	var errs []error
	errs = append(errs, d.dispatch.Close())
	errs = append(errs, d.content.Close())

	errs = append(errs, d.hosts.Close())

	for _, err := range errs {
		if err != nil {
			return err
		}
	}

	return nil
}

func (d *Daemon) ReadinessProbe() func() error {
	return func() error {
		if !d.hosts.DidUpdate() {
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
