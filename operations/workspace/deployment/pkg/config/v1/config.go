// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	"strings"

	"github.com/gitpod-io/gitpod/ws-deployment/pkg/common"
)

// Config is the input configuration to create and manage lifecycle of a cluster
//
// Here is a sample representation of yaml configuration
//
// version: v1
// project:
//   id: gitpod-dev-staging
//   gcpSACredFile: /mnt/secrets/gcp-sa/service-account.json
//   network: gitpod-dev-staging
//   dnsZone: gitpod-dev-staging-com
//   bucket: gitpod-dev-staging-bucket
// metaClusters:
// - name: dev-stag-meta-eu01
//   region: europe-west1
// - name: dev-stag-meta-us01
//   region: us-west1
// workspaceClusters:
// - region: europe-west1
//   prefix: eu
//   governedBy: dev-stag-meta-eu01
//   type: gke
//   valuesFiles:
//   - values.dev-staging.yaml
//   - values.ws-cluster.yaml
// - region: us-west1
//   prefix: us
//   governedBy: dev-stag-meta-us01
//   type: gke
//   valuesFiles:
//   - values.dev-staging.yaml
//   - values.ws-cluster.yaml
type Config struct {
	Version string                `yaml:"version"`
	Project common.ProjectContext `yaml:"project"`
	// MetaClusters is optional as we may not want to register the cluster
	MetaClusters      []*common.MetaCluster      `yaml:"metaClusters"`
	WorkspaceClusters []*common.WorkspaceCluster `yaml:"workspaceClusters"`
	// TODO(princerachit): Add gitpod version here when we decide to use installed instead of relying solely on ops repository
}

// initializes workspace cluster names based on the config provided
func (c *Config) InitializeWorkspaceClusterNames(id string) {
	for _, wc := range c.WorkspaceClusters {
		// Initialize workspace cluster names only if it is missing
		if strings.TrimSpace(wc.Name) == "" {
			wc.Name = wc.Prefix + id
		}
	}
}
