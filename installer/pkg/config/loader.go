// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"fmt"
	"io/ioutil"

	v1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"sigs.k8s.io/yaml"
)

var (
	versions = map[string]interface{}{
		"v1": &v1.Config{},
	}
)

func Load(fn string) (interface{}, error) {
	fc, err := ioutil.ReadFile(fn)
	if err != nil {
		return nil, nil
	}
	var vs struct {
		APIVersion string `json:"apiVersion"`
	}
	err = yaml.Unmarshal(fc, &vs)
	if err != nil {
		return nil, nil
	}

	cfg, ok := versions[vs.APIVersion]
	if !ok {
		return nil, fmt.Errorf("unsupprted API version: %s", vs.APIVersion)
	}
	err = yaml.Unmarshal(fc, cfg)
	if err != nil {
		return nil, nil
	}

	return cfg, nil
}
