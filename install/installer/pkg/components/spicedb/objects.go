// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"fmt"
	"net"
	"strconv"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {

	spiceDBConfig := getExperimentalSpiceDBConfig(ctx)
	if spiceDBConfig == nil {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		deployment,
		service,
		common.DefaultServiceAccount(Component),
		migrations,
		networkpolicy,
		bootstrap,
		role,
		rolebinding,
	)(ctx)
}

func getExperimentalSpiceDBConfig(ctx *common.RenderContext) *experimental.SpiceDBConfig {
	webappCfg := common.ExperimentalWebappConfig(ctx)

	if webappCfg == nil || webappCfg.SpiceDB == nil {
		return nil
	}

	return webappCfg.SpiceDB
}

func Env(ctx *common.RenderContext) []corev1.EnvVar {
	cfg := getExperimentalSpiceDBConfig(ctx)
	if cfg == nil {
		return nil
	}

	return []corev1.EnvVar{
		{
			Name:  "SPICEDB_ADDRESS",
			Value: net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", Component, ctx.Namespace), strconv.Itoa(ContainerGRPCPort)),
		},
		{
			Name: "SPICEDB_PRESHARED_KEY",
			ValueFrom: &corev1.EnvVarSource{
				SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: cfg.SecretRef,
					},
					Key: SecretPresharedKeyName,
				},
			},
		},
	}
}
