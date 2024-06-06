// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
	"sigs.k8s.io/controller-runtime/pkg/webhook"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cgroup"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/controller"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/netlimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

var (
	scheme = runtime.NewScheme()
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(workspacev1.AddToScheme(scheme))
}

// NewDaemon produces a new daemon
func NewDaemon(config Config) (*Daemon, error) {
	// Use the metrics registry from the controller manager. The manager's registry
	// isn't configurable so we use this instead of the baseserver's default registry.
	// Hack: cast the registry as a *prometheus.Registry, as that's the type required
	// by baseserver.
	registry, ok := metrics.Registry.(*prometheus.Registry)
	if ok {
		// These collectors are also registered by baseserver. Use the ones from baseserver
		// and remove the collectors registered by controller-manager, to prevent an error
		// for duplicate collectors.
		registry.Unregister(collectors.NewGoCollector())
		registry.Unregister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
	} else {
		log.Error("failed to use controller-runtime metrics registry, not of expected type. Using default registry instead, but will not collect controller metrics...")
		registry = prometheus.NewRegistry()
	}
	wrappedReg := prometheus.WrapRegistererWithPrefix("gitpod_ws_daemon_", registry)

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

	markUnmountFallback, err := NewMarkUnmountFallback(wrappedReg)
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
		&cgroup.FuseDeviceEnablerV2{},
		cgroupV2IOLimiter,
		&cgroup.ProcessPriorityV2{
			ProcessPriorities: map[cgroup.ProcessType]int{
				cgroup.ProcessWorkspaceKit: -10,
				cgroup.ProcessSupervisor:   -10,

				cgroup.ProcessIDE:          -10,
				cgroup.ProcessWebIDEHelper: -5,

				cgroup.ProcessCodeServer:       -10,
				cgroup.ProcessCodeServerHelper: -5,

				cgroup.ProcessJetBrainsIDE: -10,
			},
			EnableOOMScoreAdj: config.OOMScores.Enabled,
			OOMScoreAdj: map[cgroup.ProcessType]int{
				cgroup.ProcessWorkspaceKit:     config.OOMScores.Tier1,
				cgroup.ProcessSupervisor:       config.OOMScores.Tier1,
				cgroup.ProcessCodeServer:       config.OOMScores.Tier1,
				cgroup.ProcessIDE:              config.OOMScores.Tier1,
				cgroup.ProcessJetBrainsIDE:     config.OOMScores.Tier1,
				cgroup.ProcessCodeServerHelper: config.OOMScores.Tier2,
				cgroup.ProcessWebIDEHelper:     config.OOMScores.Tier2,
			},
		},
		procV2Plugin,
		cgroup.NewPSIMetrics(wrappedReg),
	)
	if err != nil {
		return nil, err
	}

	if cgroupPlugins.CGroupVersion != cgroup.Version2 {
		return nil, xerrors.Errorf("only cgroup v2 is supported")
	}

	err = wrappedReg.Register(cgroupPlugins)
	if err != nil {
		return nil, xerrors.Errorf("cannot register cgroup plugin metrics: %w", err)
	}

	listener := []dispatch.Listener{
		cpulimit.NewDispatchListener(&config.CPULimit, wrappedReg),
		markUnmountFallback,
		cgroupPlugins,
	}

	netlimiter := netlimit.NewConnLimiter(config.NetLimit, wrappedReg)
	if config.NetLimit.Enabled {
		listener = append(listener, netlimiter)
	}

	var configReloader CompositeConfigReloader
	configReloader = append(configReloader, ConfigReloaderFunc(func(ctx context.Context, config *Config) error {
		cgroupV2IOLimiter.Update(config.IOLimit.WriteBWPerSecond.Value(), config.IOLimit.ReadBWPerSecond.Value(), config.IOLimit.WriteIOPS, config.IOLimit.ReadIOPS)
		procV2Plugin.Update(config.ProcLimit)
		if config.NetLimit.Enabled {
			netlimiter.Update(config.NetLimit)
		}
		return nil
	}))

	var mgr manager.Manager

	mgr, err = ctrl.NewManager(restCfg, ctrl.Options{
		Scheme:                 scheme,
		HealthProbeBindAddress: "0",
		Metrics: metricsserver.Options{
			// Disable the metrics server.
			// We only need access to the reconciliation loop feature.
			BindAddress: "0",
		},
		Cache: cache.Options{
			DefaultNamespaces: map[string]cache.Config{
				config.Runtime.KubernetesNamespace: {},
				config.Runtime.SecretsNamespace:    {},
			},
		},
		WebhookServer: webhook.NewServer(webhook.Options{
			Port: 9443,
		}),
	})
	if err != nil {
		return nil, err
	}

	contentCfg := config.Content

	xfs, err := quota.NewXFS(contentCfg.WorkingArea)
	if err != nil {
		return nil, err
	}

	hooks := content.WorkspaceLifecycleHooks(
		contentCfg,
		config.Runtime.WorkspaceCIDR,
		&iws.Uidmapper{Config: config.Uidmapper, Runtime: containerRuntime},
		xfs,
		config.CPULimit.CGroupBasePath,
	)

	workspaceOps, err := controller.NewWorkspaceOperations(contentCfg, controller.NewWorkspaceProvider(contentCfg.WorkingArea, hooks), wrappedReg)
	if err != nil {
		return nil, err
	}

	wsctrl, err := controller.NewWorkspaceController(
		mgr.GetClient(), mgr.GetEventRecorderFor("workspace"), nodename, config.Runtime.SecretsNamespace, config.WorkspaceController.MaxConcurrentReconciles, workspaceOps, wrappedReg)
	if err != nil {
		return nil, err
	}
	err = wsctrl.SetupWithManager(mgr)
	if err != nil {
		return nil, err
	}

	ssctrl := controller.NewSnapshotController(
		mgr.GetClient(), mgr.GetEventRecorderFor("snapshot"), nodename, config.WorkspaceController.MaxConcurrentReconciles, workspaceOps)
	err = ssctrl.SetupWithManager(mgr)
	if err != nil {
		return nil, err
	}

	housekeeping := controller.NewHousekeeping(contentCfg.WorkingArea, 5*time.Minute)
	go housekeeping.Start(context.Background())

	dsptch, err := dispatch.NewDispatch(containerRuntime, clientset, config.Runtime.KubernetesNamespace, nodename, listener...)
	if err != nil {
		return nil, err
	}

	dsk := diskguard.FromConfig(config.DiskSpaceGuard, clientset, nodename)

	return &Daemon{
		Config:          config,
		dispatch:        dsptch,
		diskGuards:      dsk,
		configReloader:  configReloader,
		mgr:             mgr,
		metricsRegistry: registry,
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

	dispatch        *dispatch.Dispatch
	diskGuards      []*diskguard.Guard
	configReloader  ConfigReloader
	mgr             ctrl.Manager
	metricsRegistry *prometheus.Registry

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

	for _, dsk := range d.diskGuards {
		go dsk.Start()
	}

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

// Stop gracefully shuts down the daemon. Once stopped, it
// cannot be started again.
func (d *Daemon) Stop() error {
	d.cancel()

	var errs []error
	errs = append(errs, d.dispatch.Close())
	for _, err := range errs {
		if err != nil {
			return err
		}
	}

	return nil
}

func (d *Daemon) ReadinessProbe() func() error {
	return func() error {
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

func (d *Daemon) MetricsRegistry() *prometheus.Registry {
	return d.metricsRegistry
}
