// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cellv1

import (
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/go-playground/validator/v10"
)

type Version struct{}

func (v Version) Factory() interface{} {
	return &InstallerConfigTemplateParameter{}
}

// Defaults fills in the defaults for this version.
// obj is expected to be the return value of Factory()
func (v Version) Defaults(obj interface{}) error { return nil }

// LoadValidationFuncs loads the custom validation functions
func (v Version) LoadValidationFuncs(*validator.Validate) error { return nil }

// ClusterValidation introduces configuration specific cluster validation checks
func (v Version) ClusterValidation(cfg interface{}) cluster.ValidationChecks { return nil }

// CheckDeprecated checks for deprecated config params.
// Returns key/value pair of deprecated params/values and any error messages (used for conflicting params)
func (v Version) CheckDeprecated(cfg interface{}) (map[string]interface{}, []string) { return nil, nil }

// InstallerConfigTemplateParameter are the parameters handed to the installer config template
type InstallerConfigTemplateParameter struct {
	Region      string `json:"region"`
	ClusterName string `json:"clusterName"`
	DomainName  string `json:"domainName"`

	Secrets InstallerConfigTemplateParameterSecrets `json:"secrets"`

	WorkspaceImageRepo string `json:"wokspaceImageRepo"`

	StorageBucket string `json:"storageBucket"`
	UsageBucket   string `json:"usageBucket"`

	RegistryFacadeCacheHost string `json:"registryFacadeCacheHost"`
}

type InstallerConfigTemplateParameterSecrets struct {
	MessageBusPassword string
	JWTSecret          string
	SessionSecret      string
}
