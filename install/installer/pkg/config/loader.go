// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/go-playground/validator/v10"

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

	// ClusterValidation introduces configuration specific cluster validation checks
	ClusterValidation(cfg interface{}) cluster.ValidationChecks
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

// Load takes a config string and overrides that onto the default
// config for that version (passed in the config). If no config version
// is passed, It overrides it onto the default CurrentVersion of the binary
func Load(overrideConfig string) (cfg interface{}, version string, err error) {
	var overrideVS struct {
		APIVersion string `json:"apiVersion"`
	}
	err = yaml.Unmarshal([]byte(overrideConfig), &overrideVS)
	if err != nil {
		return
	}

	apiVersion := overrideVS.APIVersion
	// fall-back to default CurrentVersion if no apiVersion was passed
	if version == "" {
		apiVersion = CurrentVersion
	}

	v, err := LoadConfigVersion(apiVersion)
	if err != nil {
		return
	}

	// Load default configuration
	cfg = v.Factory()
	err = v.Defaults(cfg)
	if err != nil {
		return
	}

	// Override passed configuration onto the default
	err = yaml.Unmarshal([]byte(overrideConfig), cfg)
	if err != nil {
		return
	}

	return cfg, apiVersion, nil
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
