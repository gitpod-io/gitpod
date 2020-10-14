// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"github.com/gitpod-io/gitpod/common-go/cri"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/hosts"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/uidmap"
)

// Config configures the workspace node daemon
type Config struct {
	Runtime struct {
		CRI                 *cri.Config `json:"containerRuntime"`
		Kubeconfig          string      `json:"kubeconfig"`
		KubernetesNamespace string      `json:"namespace"`
	} `json:"runtime"`

	Content        content.Config   `json:"content"`
	Uidmapper      uidmap.Config    `json:"uidmapper"`
	Resources      resources.Config `json:"resources"`
	Hosts          hosts.Config     `json:"hosts"`
	DiskSpaceGuard diskguard.Config `json:"disk"`
}
