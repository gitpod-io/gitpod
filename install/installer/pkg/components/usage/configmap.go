// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/server"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := server.Config{
		ControllerSchedule: "", // By default controller is disabled
		Server: &baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf("0.0.0.0:%d", gRPCContainerPort),
				},
			},
		},
		DefaultSpendingLimit: db.DefaultSpendingLimit{
			// because we only want spending limits in SaaS, if not configured we go with a very high (i.e. no) spending limit
			ForTeams:            1_000_000_000,
			ForUsers:            1_000_000_000,
			MinForUsersOnStripe: 0,
		},
	}

	expWebAppConfig := getExperimentalWebAppConfig(ctx)
	if expWebAppConfig != nil && expWebAppConfig.Stripe != nil {
		cfg.StripePrices = server.StripePrices{
			IndividualUsagePriceIDs: server.PriceConfig{
				EUR: expWebAppConfig.Stripe.IndividualUsagePriceIDs.EUR,
				USD: expWebAppConfig.Stripe.IndividualUsagePriceIDs.USD,
			},
			TeamUsagePriceIDs: server.PriceConfig{
				EUR: expWebAppConfig.Stripe.TeamUsagePriceIDs.EUR,
				USD: expWebAppConfig.Stripe.TeamUsagePriceIDs.USD,
			},
		}
	}

	expUsageConfig := getExperimentalUsageConfig(ctx)

	if expUsageConfig != nil {
		if expUsageConfig.Schedule != "" {
			cfg.ControllerSchedule = expUsageConfig.Schedule
		}
		if expUsageConfig.DefaultSpendingLimit != nil {
			cfg.DefaultSpendingLimit = *expUsageConfig.DefaultSpendingLimit
		}
		cfg.CreditsPerMinuteByWorkspaceClass = expUsageConfig.CreditsPerMinuteByWorkspaceClass
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
