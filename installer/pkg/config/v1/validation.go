// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"

	"github.com/go-playground/validator/v10"
	corev1 "k8s.io/api/core/v1"
)

var InstallationKindList = map[InstallationKind]struct{}{
	InstallationMeta:      {},
	InstallationWorkspace: {},
	InstallationFull:      {},
}

var LogLevelList = map[LogLevel]struct{}{
	LogLevelTrace:   {},
	LogLevelDebug:   {},
	LogLevelInfo:    {},
	LogLevelWarning: {},
	LogLevelError:   {},
	LogLevelFatal:   {},
	LogLevelPanic:   {},
}

var ObjectRefKindList = map[ObjectRefKind]struct{}{
	ObjectRefSecret: {},
}

var FSShiftMethodList = map[FSShiftMethod]struct{}{
	FSShiftFuseFS:  {},
	FSShiftShiftFS: {},
}

// LoadValidationFuncs load custom validation functions for this version of the config API
func (v version) LoadValidationFuncs(validate *validator.Validate) error {
	funcs := map[string]validator.Func{
		"objectref_kind": func(fl validator.FieldLevel) bool {
			_, ok := ObjectRefKindList[ObjectRefKind(fl.Field().String())]
			return ok
		},
		"fs_shift_method": func(fl validator.FieldLevel) bool {
			_, ok := FSShiftMethodList[FSShiftMethod(fl.Field().String())]
			return ok
		},
		"installation_kind": func(fl validator.FieldLevel) bool {
			_, ok := InstallationKindList[InstallationKind(fl.Field().String())]
			return ok
		},
		"log_level": func(fl validator.FieldLevel) bool {
			_, ok := LogLevelList[LogLevel(fl.Field().String())]
			return ok
		},
	}
	for n, f := range funcs {
		err := validate.RegisterValidation(n, f)
		if err != nil {
			return err
		}
	}

	return nil
}

// ClusterValidation introduces configuration specific cluster validation checks
func (v version) ClusterValidation(rcfg interface{}) cluster.ValidationChecks {
	cfg := rcfg.(*Config)

	var res cluster.ValidationChecks
	if cfg.ObjectStorage.CloudStorage != nil {
		secretName := cfg.ObjectStorage.CloudStorage.ServiceAccount.Name
		res = append(res, cluster.CheckSecret(secretName, func(s *corev1.Secret) ([]cluster.ValidationError, error) {
			key := "service-account.json"
			if _, exists := s.Data[key]; !exists {
				return []cluster.ValidationError{
					{
						Message: fmt.Sprintf("secret %s has no %s entry", secretName, key),
						Type:    cluster.ValidationStatusError,
					},
				}, nil
			}

			return nil, nil
		}))
	}

	return res
}
