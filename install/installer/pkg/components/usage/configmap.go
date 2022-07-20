// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/usage/pkg/server"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := server.Config{
		ControllerSchedule: time.Hour.String(),
		ContentServiceUrl:  fmt.Sprintf("%s:%d", content_service.Component, content_service.RPCPort),
		Server: &baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf(":%d", gRPCContainerPort),
				},
			},
		},
	}

	expConfig := getExperimentalConfig(ctx)
	if expConfig != nil {
		if expConfig.Schedule != "" {
			cfg.ControllerSchedule = expConfig.Schedule
		}

		cfg.CreditsPerMinuteByWorkspaceClass = expConfig.CreditsPerMinuteByWorkspaceClass
	}

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		_, _, path, ok := getStripeConfig(ucfg)
		if !ok {
			return nil
		}

		cfg.StripeCredentialsFile = path
		return nil
	})

	serialized, err := common.ToJSONString(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal usage config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        Component,
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				configJSONFilename: string(serialized),
			},
		},
	}, nil
}
