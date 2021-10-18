// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"github.com/go-playground/validator/v10"
)

func Validate(version ConfigVersion, cfg interface{}) ([]validator.FieldError, error) {
	validate := validator.New()
	err := version.LoadValidationFuncs(validate)
	if err != nil {
		return nil, err
	}

	err = validate.Struct(cfg)

	if err != nil {
		validationErrors := err.(validator.ValidationErrors)

		return validationErrors, nil
	}

	return nil, nil
}
