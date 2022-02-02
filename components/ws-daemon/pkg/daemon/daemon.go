// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"
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
	cgCustomizer := &CgroupCustomizer{}
	cgCustomizer.WithCgroupBasePath(config.Resources.CGroupsBasePath)
	markUnmountFallback, err := NewMarkUnmountFallback(reg)
	if err != nil {
		return nil, err
	}
	dsptch, err := dispatch.NewDispatch(containerRuntime, clientset, config.Runtime.KubernetesNamespace, nodename,
		resources.NewDispatchListener(&config.Resources, reg),
		cgCustomizer,
		markUnmountFallback,
	)
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

		dispatch:   dsptch,
		content:    contentService,
		diskGuards: dsk,
		hosts:      hsts,
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

	dispatch   *dispatch.Dispatch
	content    *content.WorkspaceService
	diskGuards []*diskguard.Guard
	hosts      hosts.Controller
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

	if d.Config.ReadinessSignal.Enabled {
		go d.startReadinessSignal()
	}

	return nil
}

// Register registers all gRPC services provided by this daemon
func (d *Daemon) Register(srv *grpc.Server) {
	api.RegisterWorkspaceContentServiceServer(srv, d.content)
}

func (d *Daemon) startReadinessSignal() {
	path := d.Config.ReadinessSignal.Path
	if path == "" {
		path = "/"
	}

	mux := http.NewServeMux()
	mux.Handle(path, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if d.hosts != nil && !d.hosts.DidUpdate() {
			http.Error(w, "host controller not ready yet", http.StatusTooEarly)
			return
		}

		isContainerdReady, err := d.dispatch.Runtime.IsContainerdReady(context.Background())
		if err != nil {
			http.Error(w, fmt.Sprintf("containerd error: %v", err), http.StatusTooEarly)
			return
		}

		if !isContainerdReady {
			http.Error(w, "containerd is not ready", http.StatusServiceUnavailable)
			return
		}

		w.WriteHeader(http.StatusOK)
	}))
	log.WithField("addr", d.Config.ReadinessSignal.Addr).Info("started readiness signal")
	err := http.ListenAndServe(d.Config.ReadinessSignal.Addr, mux)
	if err != nil {
		log.WithError(err).Error("cannot start readiness probe")
	}
	log.Info("bla")
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
