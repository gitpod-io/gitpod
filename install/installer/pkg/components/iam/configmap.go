// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package iam

import (
	"fmt"
	"net"
	"strconv"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/iam/pkg/config"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

const (
	configJSONFilename = "config.json"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {

	_, _, databaseSecretMountPath := common.DatabaseEnvSecret(ctx.Config)

	cfg := config.ServiceConfig{
		Server: &baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf("0.0.0.0:%d", GRPCContainerPort),
				},
				HTTP: &baseserver.ServerConfiguration{
					Address: fmt.Sprintf("0.0.0.0:%d", HTTPContainerPort),
				},
			},
		},

		SessionServiceAddress: net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", common.ServerComponent, ctx.Namespace), strconv.Itoa(common.ServerIAMSessionPort)),

		DatabaseConfigPath: databaseSecretMountPath,
	}

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		_, _, path, ok := getOIDCClientsConfig(ucfg)
		if !ok {
			return nil
		}

		cfg.OIDCClientsConfigFile = path
		return nil
	})

	fc, err := common.ToJSONString(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
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
				configJSONFilename: string(fc),
			},
		},
	}, nil
}
