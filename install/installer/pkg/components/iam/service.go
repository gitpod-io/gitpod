// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package iam

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	servicePorts := []common.ServicePort{
		{
			Name:          GRPCPortName,
			ContainerPort: GRPCContainerPort,
			ServicePort:   GRPCServicePort,
		},
		{
			Name:          HTTPPortName,
			ContainerPort: HTTPContainerPort,
			ServicePort:   HTTPServicePort,
		},
	}

	return common.GenerateService(Component, servicePorts)(ctx)
}
