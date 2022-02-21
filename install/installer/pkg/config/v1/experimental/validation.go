// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package experimental

import "github.com/go-playground/validator/v10"

var TracingSampleTypeList = map[TracingSampleType]struct{}{
	TracingSampleTypeConst:         {},
	TracingSampleTypeProbabilistic: {},
	TracingSampleTypeRateLimiting:  {},
	TracingSampleTypeRemote:        {},
}

var ValidationChecks = map[string]validator.Func{
	"tracing_sampler_type": func(fl validator.FieldLevel) bool {
		_, ok := TracingSampleTypeList[TracingSampleType(fl.Field().String())]
		return ok
	},
}
