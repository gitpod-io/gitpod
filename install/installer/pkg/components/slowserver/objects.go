// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package slowserver

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := getExperimentalWebAppConfig(ctx)
	if cfg == nil || !cfg.SlowDatabase {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		configmap,
		deployment,
		func(ctx *common.RenderContext) ([]runtime.Object, error) {
			return server.Networkpolicy(ctx, Component)
		},
		func(ctx *common.RenderContext) ([]runtime.Object, error) {
			return server.Role(ctx, Component)
		},
		func(ctx *common.RenderContext) ([]runtime.Object, error) {
			return server.Rolebinding(ctx, Component)
		},
		common.GenerateService(Component, []common.ServicePort{
			{
				Name:          ContainerPortName,
				ContainerPort: ContainerPort,
				ServicePort:   ServicePort,
			},
			{
				Name:          baseserver.BuiltinMetricsPortName,
				ContainerPort: baseserver.BuiltinMetricsPort,
				ServicePort:   baseserver.BuiltinMetricsPort,
			},
			{
				Name:          InstallationAdminName,
				ContainerPort: InstallationAdminPort,
				ServicePort:   InstallationAdminPort,
			},
			{
				Name:          DebugPortName,
				ContainerPort: baseserver.BuiltinDebugPort,
				ServicePort:   baseserver.BuiltinDebugPort,
			},
			{
				Name:          DebugNodePortName,
				ContainerPort: common.DebugNodePort,
				ServicePort:   common.DebugNodePort,
			},
		}),
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
