// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"
	corev1 "k8s.io/api/core/v1"
)

type Config struct {
	Kind       InstallationKind `json:"kind"`
	Domain     string           `json:"domain"`
	Metadata   Metadata         `json:"metadata"`
	Repository string           `json:"repository"`

	Observability Observability `json:"observability"`
	Analytics     *Analytics    `json:"analytics"`

	Database   Database   `json:"database"`
	MessageBus MessageBus `json:"messageBus"`

	ObjectStorage ObjectStorage `json:"objectStorage"`

	ContainerRegistry ContainerRegistry `json:"containerRegistry"`

	Certificate ObjectRef `json:"certificate"`

	ImagePullSecrets []ObjectRef `json:"imagePullSecrets"`

	InstallNetworkPolicies bool `json:"installNetworkPolicies"` // todo(sje): remove - this is always true

	Workspace Workspace `json:"workspace"`

	AuthProviders []AuthProviderConfigs `json:"authProviders"`
	BlockNewUsers BlockNewUsers         `json:"blockNewUsers"`
}

type Metadata struct {
	Region string `json:"region"`
}

type Observability struct {
	LogLevel LogLevel `json:"logLevel"`
	Tracing  *Tracing `json:"tracing"`
}

type Analytics struct {
	SegmentKey string `json:"segmentKey"`
	Writer     string `json:"writer"`
}

type Tracing struct {
	Endpoint  *string `json:"endpoint,omitempty"`
	AgentHost *string `json:"agentHost,omitempty"`
}

type MessageBus struct {
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

type Resources struct {
	// todo(sje): investigate using corev1.ResourceList
	Requests struct {
		CPU              string
		Memory           string
		Storage          string
		EphemeralStorage string
	}
	Limits struct {
		CPU              string
		Memory           string
		Storage          string
		EphemeralStorage string
	}
	DynamicLimits struct {
		CPU []resources.Bucket
	}
}

type WorkspaceRuntime struct {
	FSShiftMethod        FSShiftMethod `json:"fsShiftMethod"`
	ContainerDRuntimeDir string        `json:"containerdRuntimeDir"`
}

type WorkspaceTemplates struct {
	Default    *corev1.Pod `json:"default"`
	Prebuild   *corev1.Pod `json:"prebuild"`
	Ghost      *corev1.Pod `json:"ghost"`
	ImageBuild *corev1.Pod `json:"image_build"`
	Regular    *corev1.Pod `json:"regular"`
}

type Workspace struct {
	Runtime   WorkspaceRuntime   `json:"runtime"`
	Resources Resources          `json:"resources"`
	Templates WorkspaceTemplates `json:"templates"`
}

type FSShiftMethod string

const (
	FSShiftFuseFS  FSShiftMethod = "fuse"
	FSShiftShiftFS FSShiftMethod = "shiftfs"
)

// todo(sje): I don't know if we want to put this in the config YAML
type AuthProviderConfigs struct {
	BuiltIn             string            `json:"builtin"`
	Verified            string            `json:"verified"`
	OAuth               OAuth             `json:"oauth"`
	Params              map[string]string `json:"params"`
	HiddenOnDashboard   bool              `json:"hiddenOnDashboard"`
	LoginContextMatcher string            `json:"loginContextMatcher"`
	DisallowLogin       bool              `json:"disallowLogin"`
	RequireTOS          bool              `json:"requireTOS"`
	Description         string            `json:"description"`
	Icon                string            `json:"icon"`
}

type BlockNewUsers struct {
	Enabled  bool     `json:"enabled"`
	Passlist []string `json:"passlist"`
}

type OAuth struct {
	ClientId            string            `json:"clientId"`
	ClientSecret        string            `json:"clientSecret"`
	CallBackUrl         string            `json:"callBackUrl"`
	AuthorizationUrl    string            `json:"authorizationUrl"`
	TokenUrl            string            `json:"tokenUrl"`
	Scope               string            `json:"scope"`
	ScopeSeparator      string            `json:"scopeSeparator"`
	SettingsUrl         string            `json:"settingsUrl"`
	AuthorizationParams map[string]string `json:"authorizationParams"`
	ConfigURL           string            `json:"configURL"`
	ConfigFn            string            `json:"configFn"`
}
