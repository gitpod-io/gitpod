// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/go-playground/validator/v10"
)

type ValidationResult struct {
	Valid    bool     `json:"valid"`
	Warnings []string `json:"warn,omitempty"`
	Fatal    []string `json:"fatal,omitempty"`
}

func Validate(version ConfigVersion, cfg interface{}) (r *ValidationResult, err error) {
	defer func() {
		if r != nil {
			r.Valid = len(r.Fatal) == 0
		}
	}()

	validate := validator.New()
	err = version.LoadValidationFuncs(validate)
	if err != nil {
		return nil, err
	}

	var res ValidationResult
	err = validate.Struct(cfg)
	if err != nil {
		validationErrors := err.(validator.ValidationErrors)

		if len(validationErrors) > 0 {
			for _, v := range validationErrors {
				switch v.Tag() {
				case "required":
					res.Fatal = append(res.Fatal, fmt.Sprintf("Field '%s' is required", v.Namespace()))
				case "required_if", "required_unless", "required_with":
					tag := strings.Replace(v.Tag(), "_", " ", -1)
					res.Fatal = append(res.Fatal, fmt.Sprintf("Field '%s' is %s '%s'", v.Namespace(), tag, v.Param()))
				case "startswith":
					res.Fatal = append(res.Fatal, fmt.Sprintf("Field '%s' must start with '%s'", v.Namespace(), v.Param()))
				default:
					// General error message
					res.Fatal = append(res.Fatal, fmt.Sprintf("Field '%s' failed %s validation", v.Namespace(), v.Tag()))
				}
			}
			return &res, nil
		}
	}

	return &res, nil
}

// Marshal marshals this result to JSON
func (r *ValidationResult) Marshal(w io.Writer) {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.Encode(r)
}
