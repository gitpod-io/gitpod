// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experimental

import (
	corev1 "k8s.io/api/core/v1"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/go-playground/validator/v10"
)

var TracingSampleTypeList = map[TracingSampleType]struct{}{
	TracingSampleTypeConst:         {},
	TracingSampleTypeProbabilistic: {},
	TracingSampleTypeRateLimiting:  {},
	TracingSampleTypeRemote:        {},
}

var ServiceTypeList = map[corev1.ServiceType]struct{}{
	corev1.ServiceTypeLoadBalancer: {},
	corev1.ServiceTypeClusterIP:    {},
	corev1.ServiceTypeNodePort:     {},
	corev1.ServiceTypeExternalName: {},
}

var ValidationChecks = map[string]validator.Func{
	"tracing_sampler_type": func(fl validator.FieldLevel) bool {
		_, ok := TracingSampleTypeList[TracingSampleType(fl.Field().String())]
		return ok
	},
	"service_config_type": func(fl validator.FieldLevel) bool {
		_, ok := ServiceTypeList[corev1.ServiceType(fl.Field().String())]
		return ok
	},
}

func ClusterValidation(cfg *Config) cluster.ValidationChecks {
	if cfg == nil {
		return nil
	}

	var res cluster.ValidationChecks
	if cfg.Workspace != nil {
		if scr := cfg.Workspace.RegistryFacade.RedisCache.PasswordSecret; scr != "" {
			res = append(res, cluster.CheckSecret(scr, cluster.CheckSecretRequiredData("password")))
		}

		if cfg.Workspace.WorkspaceCIDR != "" {
			res = append(res, cluster.CheckWorkspaceCIDR(cfg.Workspace.WorkspaceCIDR))
		}
	}

	return res
}
