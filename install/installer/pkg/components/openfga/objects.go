// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package openfga

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {

	openFGAConfig := getExperimentalOpenFGAConfig(ctx)
	if openFGAConfig == nil {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		deployment,
		service,
		common.DefaultServiceAccount(Component),
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

func getExperimentalOpenFGAConfig(ctx *common.RenderContext) *experimental.OpenFGAConfig {
	webappCfg := getExperimentalWebAppConfig(ctx)

	if webappCfg == nil || webappCfg.OpenFGA == nil {
		return nil
	}

	return webappCfg.OpenFGA
}
