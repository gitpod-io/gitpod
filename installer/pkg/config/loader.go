// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"fmt"
	"io/ioutil"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/go-playground/validator/v10"

	"sigs.k8s.io/yaml"
)

// CurrentVersion points to the latest config version
const CurrentVersion = "v1"

type migrationReg struct {
	From, To string
}

var (
	versions   map[string]ConfigVersion
	migrations map[migrationReg]Migration
)

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
// Expected to be called from the init function of a config package.
func AddVersion(version string, v ConfigVersion) {
	if versions == nil {
		versions = make(map[string]ConfigVersion)
	}
	versions[version] = v
}

// AddMigration adds a migration between two versions.
// Expected to be called from the init function of a config package.
func AddMigration(fromVersion, toVersion string, mig Migration) {
	if migrations == nil {
		migrations = make(map[migrationReg]Migration)
	}
	migrations[migrationReg{fromVersion, toVersion}] = mig
}

var (
	ErrInvalidType              = fmt.Errorf("invalid type")
	ErrNoMigrationPathAvailable = fmt.Errorf("no migration path available")
)

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

// Migrate migrates a configuration from one version to another.
func Migrate(fromVersion, toVersion string, old, new interface{}) error {
	if migrations == nil {
		return ErrNoMigrationPathAvailable
	}

	migration, ok := migrations[migrationReg{fromVersion, toVersion}]
	if !ok {
		return ErrNoMigrationPathAvailable
	}

	return migration(old, new)
}

// Migrate translates the from config to the new version.
// From is expected to be a pointer to the old config version.
// To is expected to be a pointer to the new config version.
//
// If the migration cannot happen automatically, return an NoAutomaticValidationError
type Migration func(from, to interface{}) error

type NoAutomaticValidationError struct {
	Message string `json:"message"`
}

func (e NoAutomaticValidationError) Error() string {
	return e.Message
}
