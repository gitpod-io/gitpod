// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/go-playground/validator/v10"
)

func init() {
	config.AddVersion("v2", version{})
}

type version struct{}

func (v version) BuildFromEnvvars(cfg interface{}) error {
	return nil
}

func (v version) CheckDeprecated(cfg interface{}) (map[string]interface{}, []string) {
	return map[string]interface{}{}, []string{}
}

func (v version) ClusterValidation(rcfg interface{}) cluster.ValidationChecks {
	return []cluster.ValidationCheck{}
}

func (v version) Defaults(obj interface{}) error {
	return nil
}

func (v version) Factory() interface{} {
	return nil
}

func (v version) LoadValidationFuncs(*validator.Validate) error {
	return nil
}
