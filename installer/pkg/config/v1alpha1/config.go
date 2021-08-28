// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

type Config struct {
	Kind     InstallationKind `json:"kind"`
	Domain   string           `json:"domain"`
	Metadata struct {
		Region string `json:"region"`
	} `json:"metadata"`
	Repository string `json:"repository"`

	Observability struct {
		LogLevel *LogLevel `json:"logLevel"`
		Tracing  *struct {
			Endpoint  *string `json:"endpoint,omitempty"`
			AgentHost *string `json:"agentHost,omitempty"`
		} `json:"tracing"`
	} `json:"observability"`

	Database struct {
		InCluster *bool `json:"inCluster,omitempty"`
		RDS       *struct {
			Certificate ObjectRef `json:"certificate"`
		} `json:"rds"`
		CloudSQL *struct {
			Certificate ObjectRef `json:"certificate"`
		} `json:"cloudSQL"`
	} `json:"database"`

	ObjectStorage struct {
		InCluster *bool `json:"inCluster,omitempty"`
		S3        *struct {
			Certificate ObjectRef `json:"certificate"`
		} `json:"s3"`
		CloudStorage *struct {
			Certificate ObjectRef `json:"certificate"`
		} `json:"cloudStorage"`
	} `json:"objectStorage"`

	ContainerRegistry struct {
		InCluster *bool                      `json:"inCluster"`
		External  *ContainerRegistryExternal `json:"external"`
	} `json:"containerRegistry"`

	Certificate ObjectRef `json:"certificate"`

	ImagePullSecrets []ObjectRef `json:"imagePullSecrets"`

	WorkspaceRuntime WorkspaceRuntime `json:"workspaceRuntime"`
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

type ContainerRegistryExternal struct {
	URL         string    `json:"url"`
	Certificate ObjectRef `json:"certificate"`
}

type LogLevel string

type WorkspaceRuntime struct {
	FSShiftMethod FSShiftMethod `json:"fsShiftMethod"`
}

type FSShiftMethod string

const (
	FSShiftFuseFS  FSShiftMethod = "fuse"
	FSShiftShiftFS FSShiftMethod = "shiftfs"
)
