// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package hosts

import (
	"golang.org/x/xerrors"
	"k8s.io/client-go/kubernetes"
)

// Config configures the hosts controller
type Config struct {
	Enabled       bool              `json:"enabled"`
	NodeHostsFile string            `json:"nodeHostsFile"`
	FixedHosts    map[string][]Host `json:"fixedHosts"`
}

// FromConfig produces a hosts controller from configuration.
func FromConfig(cfg Config, clientset kubernetes.Interface, kubernetesNamespace string) (res Controller, err error) {
	if !cfg.Enabled {
		return
	}

	var provider []HostSource
	for alias, entry := range cfg.FixedHosts {
		provider = append(provider, NewFixedIPSource(alias, entry))
	}
	hg, err := NewDirectController(kubernetesNamespace, cfg.NodeHostsFile, provider...)
	if err != nil {
		return nil, xerrors.Errorf("cannot create hosts controller: %w", err)
	}
	return hg, nil
}
