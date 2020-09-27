// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/cri"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/hostsgov"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/resourcegov"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// New creates a new daemon for the given configuration
func New(cfg Configuration, reg prometheus.Registerer) (*Daemon, error) {
	clientset, err := newClientSet(cfg.Kubeconfig)
	if err != nil {
		return nil, err
	}
	containerRuntime, err := cri.FromConfig(cfg.ContainerRuntime)
	if err != nil {
		return nil, err
	}
	if containerRuntime == nil {
		return nil, xerrors.Errorf("no container runtime configured")
	}

	var listener []dispatch.Listener
	if cfg.Resources != nil {
		listener = append(listener, resourcegov.NewDispatchListener(cfg.Resources, reg))
	}

	disp, err := dispatch.NewDispatch(containerRuntime, clientset, cfg.KubernetesNamespace, listener...)
	if err != nil {
		return nil, err
	}

	d := &Daemon{
		Config:     cfg,
		Prometheus: reg,
		Dispatch:   disp,
		close:      make(chan struct{}),
	}

	if len(cfg.DiskSpaceGuard) > 0 {
		nodename := os.Getenv("NODENAME")
		if nodename == "" {
			return nil, xerrors.Errorf("no NODENAME envvar set but needed to set up disk guards")
		}

		for _, p := range d.Config.DiskSpaceGuard {
			d.DiskGuards = append(d.DiskGuards, &diskguard.Guard{
				Nodename:      nodename,
				Clientset:     clientset,
				MinBytesAvail: p.MinBytesAvail,
				Path:          p.Path,
			})
		}
	}
	if cfg.Hosts != nil {
		if cfg.Hosts.ServiceProxy.Enabled {
			provider := make(map[string]hostsgov.HostSource)
			for _, portcfg := range cfg.Hosts.ServiceProxy.PortMapping {
				provider[fmt.Sprintf(":%d", portcfg.ProxyPort)] = &hostsgov.ServiceClusterIPSource{
					ID:        portcfg.Alias,
					Clientset: clientset,
					Namespace: cfg.KubernetesNamespace,
					Selector:  portcfg.Selector,
					Alias:     portcfg.Alias,
				}
			}

			hg, err := hostsgov.NewProxyingGoverner(cfg.KubernetesNamespace, cfg.Hosts.NodeHostsFile, d.close, provider)
			if err != nil {
				return nil, xerrors.Errorf("cannot create hosts governer: %w", err)
			}
			d.Hosts = hg
		} else {
			var provider []hostsgov.HostSource
			for src, alias := range cfg.Hosts.FromNodeIPs {
				provider = append(provider, &hostsgov.PodHostIPSource{
					ID:        alias,
					Clientset: clientset,
					Namespace: cfg.KubernetesNamespace,
					Selector:  src,
					Alias:     alias,
				})
			}
			hg, err := hostsgov.NewDirectGoverner(cfg.KubernetesNamespace, cfg.Hosts.NodeHostsFile, d.close, provider...)
			if err != nil {
				return nil, xerrors.Errorf("cannot create hosts governer: %w", err)
			}
			d.Hosts = hg
		}

	}

	return d, nil
}

func newClientSet(kubeconfig string) (*kubernetes.Clientset, error) {
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

// Daemon runs on a node and ensure proper service of workspaces
type Daemon struct {
	Config     Configuration
	Prometheus prometheus.Registerer
	Dispatch   *dispatch.Dispatch
	DiskGuards []*diskguard.Guard
	Hosts      hostsgov.Governer

	closeOnce sync.Once
	close     chan struct{}
}

// Start begins observing workspace pods.
// This function does not return until Close() is called.
func (d *Daemon) Start() {
	err := d.Dispatch.Start()
	if err != nil {
		log.WithError(err).Fatal("cannot start dispatch")
	}

	for _, g := range d.DiskGuards {
		go g.Start(30 * time.Second)
		log.WithField("path", g.Path).Info("started disk guard")
	}
	if d.Hosts != nil {
		go d.Hosts.Start()
	}
}

// Close stops the daemon
func (d *Daemon) Close() error {
	d.closeOnce.Do(func() {
		d.Dispatch.Close()
		close(d.close)
	})
	return nil
}
