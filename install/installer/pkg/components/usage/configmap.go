// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package usage

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/usage/pkg/server"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/redis"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := server.Config{
		LedgerSchedule:     "", // By default controller is disabled
		ResetUsageSchedule: time.Duration(15 * time.Minute).String(),
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
		Redis: server.RedisConfiguration{
			Address: common.ClusterAddress(redis.Component, ctx.Namespace, redis.Port),
		},
		ServerAddress: common.ClusterAddress(common.ServerComponent, ctx.Namespace, common.ServerGRPCAPIPort),
	}

	expWebAppConfig := common.ExperimentalWebappConfig(ctx)
	if expWebAppConfig != nil && expWebAppConfig.Stripe != nil {
		cfg.StripePrices = stripe.StripePrices{
			IndividualUsagePriceIDs: stripe.PriceConfig{
				EUR: expWebAppConfig.Stripe.IndividualUsagePriceIDs.EUR,
				USD: expWebAppConfig.Stripe.IndividualUsagePriceIDs.USD,
			},
			TeamUsagePriceIDs: stripe.PriceConfig{
				EUR: expWebAppConfig.Stripe.TeamUsagePriceIDs.EUR,
				USD: expWebAppConfig.Stripe.TeamUsagePriceIDs.USD,
			},
		}
	}

	expUsageConfig := getExperimentalUsageConfig(ctx)

	if expUsageConfig != nil {
		if expUsageConfig.Schedule != "" {
			cfg.LedgerSchedule = expUsageConfig.Schedule
		}
		cfg.ResetUsageSchedule = expUsageConfig.ResetUsageSchedule
		if expUsageConfig.DefaultSpendingLimit != nil {
			cfg.DefaultSpendingLimit = *expUsageConfig.DefaultSpendingLimit
		}
	}

	workspaceClassConfig := getExperimentalWorkspaceClassConfig(ctx)

	cfg.CreditsPerMinuteByWorkspaceClass = make(map[string]float64)
	for _, v := range workspaceClassConfig {
		if v.Credits != nil {
			cfg.CreditsPerMinuteByWorkspaceClass[v.Id] = v.Credits.PerMinute
		}
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
