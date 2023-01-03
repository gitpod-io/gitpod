// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package usage

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := getExperimentalUsageConfig(ctx)
	if cfg == nil {
		return nil, nil
	}

	log.Debug("Detected experimental.WebApp.Usage configuration", cfg)
	return common.CompositeRenderFunc(
		deployment,
		rolebinding,
		configmap,
		common.DefaultServiceAccount(Component),
		service,
		networkpolicy,
	)(ctx)
}

func getExperimentalWebAppConfig(ctx *common.RenderContext) *experimental.WebAppConfig {
	var experimentalCfg *experimental.Config

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		experimentalCfg = ucfg
		return nil
	})

	if experimentalCfg == nil || experimentalCfg.WebApp == nil {
		return nil
	}

	return experimentalCfg.WebApp
}

func getExperimentalUsageConfig(ctx *common.RenderContext) *experimental.UsageConfig {
	experimentalWebAppCfg := getExperimentalWebAppConfig(ctx)
	if experimentalWebAppCfg == nil || experimentalWebAppCfg.Usage == nil {

		return nil
	}

	return experimentalWebAppCfg.Usage
}

func getExperimentalWorkspaceClassConfig(ctx *common.RenderContext) []experimental.WebAppWorkspaceClass {
	experimentalWebAppCfg := getExperimentalWebAppConfig(ctx)
	if experimentalWebAppCfg == nil {
		return nil
	}

	return experimentalWebAppCfg.WorkspaceClasses
}
