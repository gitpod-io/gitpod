// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"
)

// Config configures the workspace node daemon
type Config struct {
	Runtime         RuntimeConfig         `json:"runtime"`
	ReadinessSignal ReadinessSignalConfig `json:"readiness"`

	Content        content.Config      `json:"content"`
	Uidmapper      iws.UidmapperConfig `json:"uidmapper"`
	Resources      resources.Config    `json:"resources"`
	Hosts          hosts.Config        `json:"hosts"`
	DiskSpaceGuard diskguard.Config    `json:"disk"`
}

type RuntimeConfig struct {
	Container           *container.Config `json:"containerRuntime"`
	Kubeconfig          string            `json:"kubeconfig"`
	KubernetesNamespace string            `json:"namespace"`
}

type ReadinessSignalConfig struct {
	Enabled bool   `json:"enabled"`
	Addr    string `json:"addr"`
	Path    string `json:"path"`
}
