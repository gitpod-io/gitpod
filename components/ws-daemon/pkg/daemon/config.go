// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package daemon

import (
	"context"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cgroup"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/diskguard"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/netlimit"
	"k8s.io/apimachinery/pkg/api/resource"
)

// Config configures the workspace node daemon
type Config struct {
	Runtime RuntimeConfig `json:"runtime"`

	Content             content.Config            `json:"content"`
	Uidmapper           iws.UidmapperConfig       `json:"uidmapper"`
	CPULimit            cpulimit.Config           `json:"cpulimit"`
	IOLimit             IOLimitConfig             `json:"ioLimit"`
	ProcLimit           int64                     `json:"procLimit"`
	NetLimit            netlimit.Config           `json:"netlimit"`
	OOMScores           cgroup.OOMScoreAdjConfig  `json:"oomScores"`
	DiskSpaceGuard      diskguard.Config          `json:"disk"`
	WorkspaceController WorkspaceControllerConfig `json:"workspaceController"`

	RegistryFacadeHost string `json:"registryFacadeHost,omitempty"`
}

type WorkspaceControllerConfig struct {
	MaxConcurrentReconciles int `json:"maxConcurrentReconciles,omitempty"`
}

type RuntimeConfig struct {
	Container           *container.Config `json:"containerRuntime"`
	Kubeconfig          string            `json:"kubeconfig"`
	KubernetesNamespace string            `json:"namespace"`
	SecretsNamespace    string            `json:"secretsNamespace"`

	WorkspaceCIDR string `json:"workspaceCIDR,omitempty"`
}

type IOLimitConfig struct {
	WriteBWPerSecond resource.Quantity `json:"writeBandwidthPerSecond"`
	ReadBWPerSecond  resource.Quantity `json:"readBandwidthPerSecond"`
	WriteIOPS        int64             `json:"writeIOPS"`
	ReadIOPS         int64             `json:"readIOPS"`
}

type ConfigReloader interface {
	ReloadConfig(context.Context, *Config) error
}

type ConfigReloaderFunc func(context.Context, *Config) error

func (f ConfigReloaderFunc) ReloadConfig(ctx context.Context, cfg *Config) error {
	return f(ctx, cfg)
}

type CompositeConfigReloader []ConfigReloader

func (cs CompositeConfigReloader) ReloadConfig(ctx context.Context, cfg *Config) error {
	for _, c := range cs {
		err := c.ReloadConfig(ctx, cfg)
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
	}
	return nil
}
