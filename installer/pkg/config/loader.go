// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"fmt"
	"github.com/go-playground/validator/v10"
	"io/ioutil"

	"sigs.k8s.io/yaml"
)

// CurrentVersion points to the latest config version
const CurrentVersion = "v1"

// NewDefaultConfig returns a new instance of the current config struct,
// with all defaults filled in.
func NewDefaultConfig() (interface{}, error) {
	v, ok := versions[CurrentVersion]
	if !ok {
		return nil, fmt.Errorf("current config version is invalid - this should never happen")
	}

	cfg := v.Factory()
	err := v.Defaults(cfg)
	if err != nil {
		return nil, err
	}

	return cfg, nil
}

type ConfigVersion interface {
	// Factory provides a new instance of the config struct
	Factory() interface{}

	// Defaults fills in the defaults for this version.
	// obj is expected to be the return value of Factory()
	Defaults(obj interface{}) error

	// LoadValidationFuncs loads the custom validation functions
	LoadValidationFuncs(*validator.Validate) error
}

// AddVersion adds a new version.
// Expected to be called from the init package of a config package.
func AddVersion(version string, v ConfigVersion) {
	if versions == nil {
		versions = make(map[string]ConfigVersion)
	}
	versions[version] = v
}

var (
	ErrInvalidType = fmt.Errorf("invalid type")
)

var versions map[string]ConfigVersion

func LoadConfigVersion(version string) (ConfigVersion, error) {
	v, ok := versions[version]
	if !ok {
		return nil, fmt.Errorf("unsupprted API version: %s", version)
	}

	return v, nil
}

func Load(fn string) (cfg interface{}, version string, err error) {
	fc, err := ioutil.ReadFile(fn)
	if err != nil {
		return
	}
	var vs struct {
		APIVersion string `json:"apiVersion"`
	}
	err = yaml.Unmarshal(fc, &vs)
	if err != nil {
		return
	}

	v, err := LoadConfigVersion(vs.APIVersion)
	if err != nil {
		return
	}

	cfg = v.Factory()
	version = vs.APIVersion
	err = yaml.Unmarshal(fc, cfg)
	if err != nil {
		return
	}

	return cfg, version, nil
}

func Marshal(version string, cfg interface{}) ([]byte, error) {
	if _, ok := versions[version]; !ok {
		return nil, fmt.Errorf("unsupported API version: %s", version)
	}

	b, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, err
	}

	return []byte(fmt.Sprintf("apiVersion: %s\n%s", version, string(b))), nil
}
