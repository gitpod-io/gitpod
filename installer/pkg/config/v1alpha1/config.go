// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

type Config struct {
	Kind       InstallationKind `json:"kind"`
	Domain     string           `json:"domain"`
	Metadata   Metadata         `json:"metadata"`
	Repository string           `json:"repository"`

	Observability Observability `json:"observability"`

	Database Database `json:"database"`

	ObjectStorage ObjectStorage `json:"objectStorage"`

	ContainerRegistry ContainerRegistry `json:"containerRegistry"`

	Certificate ObjectRef `json:"certificate"`

	ImagePullSecrets []ObjectRef `json:"imagePullSecrets"`

	InstallNetworkPolicies bool `json:"installNetworkPolicies"`

	WorkspaceRuntime WorkspaceRuntime `json:"workspaceRuntime"`
}

type Metadata struct {
	Region string `json:"region"`
}

type Observability struct {
	LogLevel LogLevel `json:"logLevel"`
	Tracing  *Tracing `json:"tracing"`
}

type Tracing struct {
	Endpoint  *string `json:"endpoint,omitempty"`
	AgentHost *string `json:"agentHost,omitempty"`
}

type Database struct {
	InCluster *bool             `json:"inCluster,omitempty"`
	RDS       *DatabaseRDS      `json:"rds"`
	CloudSQL  *DatabaseCloudSQL `json:"cloudSQL"`
}

type DatabaseRDS struct {
	Certificate ObjectRef `json:"certificate"`
}

type DatabaseCloudSQL struct {
	Certificate ObjectRef `json:"certificate"`
}

type ObjectStorage struct {
	InCluster    *bool                      `json:"inCluster,omitempty"`
	S3           *ObjectStorageS3           `json:"s3"`
	CloudStorage *ObjectStorageCloudStorage `json:"cloudStorage"`
}

type ObjectStorageS3 struct {
	Certificate ObjectRef `json:"certificate"`
}

type ObjectStorageCloudStorage struct {
	Certificate ObjectRef `json:"certificate"`
}

type InstallationKind string

const (
	InstallationMeta      InstallationKind = "Meta"
	InstallationWorkspace InstallationKind = "Workspace"
	InstallationFull      InstallationKind = "Full"
)

type ObjectRef struct {
	Kind CertificateRefKind `json:"kind"`
	Name string             `json:"name"`
}

type CertificateRefKind string

const (
	CertificateRefSecret CertificateRefKind = "secret"
)

type ContainerRegistry struct {
	InCluster *bool                      `json:"inCluster"`
	External  *ContainerRegistryExternal `json:"external"`
}

type ContainerRegistryExternal struct {
	URL         string    `json:"url"`
	Certificate ObjectRef `json:"certificate"`
}

type LogLevel string

type WorkspaceRuntime struct {
	FSShiftMethod        FSShiftMethod `json:"fsShiftMethod"`
	ContainerDRuntimeDir string        // @todo
}

type FSShiftMethod string

const (
	FSShiftFuseFS  FSShiftMethod = "fuse"
	FSShiftShiftFS FSShiftMethod = "shiftfs"
)
