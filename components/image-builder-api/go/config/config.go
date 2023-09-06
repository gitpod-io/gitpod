// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
)

type ServiceConfig struct {
	Orchestrator Configuration `json:"orchestrator"`

	Server *baseserver.Configuration `json:"server"`
}

// Configuration configures the orchestrator
type Configuration struct {
	WorkspaceManager WorkspaceManagerConfig `json:"wsman"`

	// PullSecret names a Kubernetes secret which contains a `.dockerconfigjson` entry
	// carrying the Docker authentication credentials to interact with the baseImageRepository
	// and workspaceImageRepository.
	PullSecret string `json:"pullSecret,omitempty"`

	// PullSecretFile points to a mount of the .dockerconfigjson file of the PullSecret.
	PullSecretFile string `json:"pullSecretFile,omitempty"`

	// BaseImageRepository configures repository where we'll push base images to.
	BaseImageRepository string `json:"baseImageRepository"`

	// WorkspaceImageRepository configures the repository where we'll push the final workspace images to.
	// Note that the workspace nodes/kubelets need access to this repository.
	WorkspaceImageRepository string `json:"workspaceImageRepository"`

	// BuilderImage is an image ref to the workspace builder image
	BuilderImage string `json:"builderImage"`

	// EnableAdditionalECRAuth adds additional ECR auth using IRSA.
	// This will attempt to add ECR auth for any ECR repo a user is
	// trying to access.
	EnableAdditionalECRAuth bool `json:"enableAdditionalECRAuth"`

	// EnableSOCIIndex builds the index required by the SOCI Snapshotter to allow lazy pulling of container images
	EnableSOCIIndex bool `json:"enableSOCIIndex"`
}

type TLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

// WorkspaceManagerConfig configures the workspace manager connection
type WorkspaceManagerConfig struct {
	Address string `json:"address"`
	TLS     TLS    `json:"tls,omitempty"`
	// expected to be a wsmanapi.WorkspaceManagerClient - use to avoid dependency on wsmanapi
	// this field is used for testing only
	Client interface{} `json:"-"`
}
