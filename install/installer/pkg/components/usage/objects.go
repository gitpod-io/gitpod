// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := getExperimentalConfig(ctx)
	if cfg == nil {
		return nil, nil
	}

	log.Debug("Detected experimental.WebApp.Usage configuration", cfg)
	return common.CompositeRenderFunc(
		deployment,
		rolebinding,
		common.DefaultServiceAccount(Component),
	)(ctx)
}

func getExperimentalConfig(ctx *common.RenderContext) *experimental.UsageConfig {
	var experimentalCfg *experimental.Config

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		experimentalCfg = ucfg
		return nil
	})

	if experimentalCfg == nil || experimentalCfg.WebApp == nil || experimentalCfg.WebApp.Usage == nil {
		return nil
	}

	return experimentalCfg.WebApp.Usage
}
