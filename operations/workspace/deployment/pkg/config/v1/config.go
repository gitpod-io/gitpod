// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
	validation "github.com/go-ozzo/ozzo-validation"
	"golang.org/x/xerrors"
)

// Config is the input configuration to create and manage lifecycle of a cluster
//
// Here is a sample representation of yaml configuration
//
// version: v1
// environment: production
// project: gitpod-staging
// #TODO(prs): gcpSecretPath: /var/gcp/gitpod-sa.json
//
// metaClusters:
//   - name: prod-meta-eu00
//     region: europe-west1
//   - name: prod-meta-us01
//     region: us-west-1
// workspaceClusters:
//   - region: europe-west1
//     prefix: eu
//     governedBy: prod-meta-eu01
//     create: true
//     type: gke
//   - region: us-east1
//     prefix: us
//     governedBy: prod-meta-us01
//     create: true
//     type: gke
type Config struct {
	// We do not support cross project deployment
	// All deployments would be in the same GCP project
	Project     string             `yaml:"project"`
	Version     string             `yaml:"version"`
	Environment common.Environment `yaml:"environment"`
	// MetaClusters is optional as we may not want to register the cluster
	MetaClusters      []*common.MetaCluster     `yaml:"metaClusters"`
	WorkspaceClusters []common.WorkspaceCluster `yaml:"workspaceClusters"`
	// TODO(princerachit): Add gitpod version here when we decide to use installed instead of relying solely on ops repository
}

// Validate validates if this config is right
func (c *Config) Validate() error {
	err := validation.ValidateStruct(&c,
		validation.Field(c.Version, validation.Required),
		validation.Field(c.Environment, validation.Required),
		validation.Field(c.WorkspaceClusters, validation.Required),
		validation.Field(&c.MetaClusters, validation.By(common.AreValidMetaClusters)),
		validation.Field(&c.WorkspaceClusters, validation.By(common.AreValidWorkspaceClusters)),
	)
	if err != nil {
		return xerrors.Errorf("invalid configuration: %w", err)
	}
	return nil
}

// initializes workspace cluster names based on the config provided
func (c *Config) InitializeWorkspaceClusterNames(id string) {
	panic("I am not implemented yet!")
}
