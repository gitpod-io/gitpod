// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"github.com/go-playground/validator/v10"
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
