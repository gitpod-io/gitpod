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

var CertificateRefKindList = map[CertificateRefKind]struct{}{
	CertificateRefSecret: {},
}

var FSShiftMethodList = map[FSShiftMethod]struct{}{
	FSShiftFuseFS:  {},
	FSShiftShiftFS: {},
}

// LoadValidationFuncs load custom validation functions for this version of the config API
func (v version) LoadValidationFuncs(validate *validator.Validate) error {
	var err error

	if err = validate.RegisterValidation("certificateKind", func(fl validator.FieldLevel) bool {
		_, ok := CertificateRefKindList[CertificateRefKind(fl.Field().String())]
		return ok
	}); err != nil {
		return err
	}

	if err = validate.RegisterValidation("fsShiftMethod", func(fl validator.FieldLevel) bool {
		_, ok := FSShiftMethodList[FSShiftMethod(fl.Field().String())]
		return ok
	}); err != nil {
		return err
	}

	if err = validate.RegisterValidation("installationKind", func(fl validator.FieldLevel) bool {
		_, ok := InstallationKindList[InstallationKind(fl.Field().String())]
		return ok
	}); err != nil {
		return err
	}

	if err = validate.RegisterValidation("logLevel", func(fl validator.FieldLevel) bool {
		_, ok := LogLevelList[LogLevel(fl.Field().String())]
		return ok
	}); err != nil {
		return err
	}

	return nil
}
