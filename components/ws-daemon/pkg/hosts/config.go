// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package hosts

import (
	"fmt"

	"golang.org/x/xerrors"
	"k8s.io/client-go/kubernetes"
)

// Config configures the hosts controller
type Config struct {
	Enabled       bool              `json:"enabled"`
	NodeHostsFile string            `json:"nodeHostsFile"`
	FromNodeIPs   map[string]string `json:"fromPodNodeIP"`
	ServiceProxy  struct {
		Enabled     bool `json:"enabled,omitempty"`
		PortMapping []struct {
			Selector  string `json:"selector"`
			Alias     string `json:"alias"`
			ProxyPort int    `json:"proxyPort"`
		} `json:"mapping"`
	} `json:"serviceProxy,omitempty"`
}

// FromConfig produces a hosts controller from configuration.
func FromConfig(cfg Config, clientset kubernetes.Interface, kubernetesNamespace string) (res Controller, err error) {
	if !cfg.Enabled {
		return
	}

	if cfg.ServiceProxy.Enabled {
		provider := make(map[string]HostSource)
		for _, portcfg := range cfg.ServiceProxy.PortMapping {
			provider[fmt.Sprintf(":%d", portcfg.ProxyPort)] = &ServiceClusterIPSource{
				ID:        portcfg.Alias,
				Clientset: clientset,
				Namespace: kubernetesNamespace,
				Selector:  portcfg.Selector,
				Alias:     portcfg.Alias,
			}
		}

		hg, err := NewProxyingController(kubernetesNamespace, cfg.NodeHostsFile, provider)
		if err != nil {
			return nil, xerrors.Errorf("cannot create hosts controller: %w", err)
		}
		return hg, nil
	}

	var provider []HostSource
	for src, alias := range cfg.FromNodeIPs {
		provider = append(provider, &PodHostIPSource{
			ID:        alias,
			Clientset: clientset,
			Namespace: kubernetesNamespace,
			Selector:  src,
			Alias:     alias,
		})
	}
	hg, err := NewDirectController(kubernetesNamespace, cfg.NodeHostsFile, provider...)
	if err != nil {
		return nil, xerrors.Errorf("cannot create hosts controller: %w", err)
	}
	return hg, nil
}
