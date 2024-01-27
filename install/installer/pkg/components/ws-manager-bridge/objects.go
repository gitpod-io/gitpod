// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	deployment,
	rolebinding,
	common.DefaultServiceAccount(Component),
)

func WSManagerList(ctx *common.RenderContext) []WorkspaceCluster {
	skipSelf := false
	wsmanagerAddr := fmt.Sprintf("dns:///%s:%d", wsmanagermk2.Component, wsmanagermk2.RPCPort)
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.WorkspaceManagerBridge != nil {
			skipSelf = cfg.WebApp.WorkspaceManagerBridge.SkipSelf
		}

		if !common.WithLocalWsManager(ctx) {
			// Must skip self if cluster does not contain ws-manager.
			skipSelf = true
		}

		return nil
	})

	// Registering a local cluster ws-manager only makes sense when we actually deploy one,
	// (ie when we are doing a full self hosted installation rather than a SaaS install to gitpod.io).
	if skipSelf {
		return []WorkspaceCluster{}
	}

	return []WorkspaceCluster{{
		Name: ctx.Config.Metadata.InstallationShortname,
		URL:  wsmanagerAddr,
		TLS: WorkspaceClusterTLS{
			Authority:   "/ws-manager-client-tls-certs/ca.crt",
			Certificate: "/ws-manager-client-tls-certs/tls.crt",
			Key:         "/ws-manager-client-tls-certs/tls.key",
		},
		State:                WorkspaceClusterStateAvailable,
		MaxScore:             100,
		Score:                50,
		Govern:               true,
		AdmissionConstraints: nil,
		ApplicationCluster:   ctx.Config.Metadata.InstallationShortname,
	}}
}
