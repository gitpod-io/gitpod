// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package public_api_server

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
	}

	if exp := getExperimentalPublicAPIConfig(ctx); exp != nil && exp.HttpPort != 0 {
		servicePorts = append(servicePorts, common.ServicePort{
			Name:          HTTPPortName,
			ContainerPort: exp.HttpPort,
			ServicePort:   HTTPServicePort,
		})
	}

	return common.GenerateService(Component, servicePorts)(ctx)
}
