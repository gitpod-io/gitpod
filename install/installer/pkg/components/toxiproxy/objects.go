// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package toxiproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := getExperimentalWebAppConfig(ctx)
	if cfg == nil || !cfg.SlowDatabase {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		deployment,
		service,
		configmap,
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
