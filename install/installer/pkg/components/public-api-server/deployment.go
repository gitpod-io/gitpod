// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package public_api_server

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"k8s.io/apimachinery/pkg/runtime"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	var experimentalCfg *experimental.Config

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		experimentalCfg = ucfg
		return nil
	})

	if experimentalCfg == nil || experimentalCfg.WebApp == nil || experimentalCfg.WebApp.PublicAPI == nil {
		// We don't want to render anything for this deployment
		return nil, nil
	}

	publicAPIConfig := experimentalCfg.WebApp.PublicAPI
	log.Debug("Detected experimental.WebApp.PublicApi configuration", publicAPIConfig)

	return nil, nil
}
