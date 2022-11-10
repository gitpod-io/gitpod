// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package toxiproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	servicePorts := []common.ServicePort{
		{
			Name:          HttpPortName,
			ContainerPort: HttpContainerPort,
			ServicePort:   HttpServicePort,
		},
		{
			Name:          MySqlProxyPortName,
			ContainerPort: MySqlProxyContainerPort,
			ServicePort:   MySqlProxyServicePort,
		},
	}

	return common.GenerateService(Component, servicePorts)(ctx)
}
