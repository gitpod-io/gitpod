// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/utils/pointer"
)

func init() {
	config.AddVersion("v1", version{})
}

type version struct{}

func (v version) Factory() interface{} {
	return &Config{
		AuthProviders: []AuthProviderConfigs{},
		BlockNewUsers: BlockNewUsers{
			Enabled:  false,
			Passlist: []string{},
		},
	}
}
func (v version) Defaults(in interface{}) error {
	cfg, ok := in.(*Config)
	if !ok {
		return config.ErrInvalidType
	}

	cfg.Kind = InstallationFull
	cfg.Domain = "gitpod.example.com"
	cfg.Repository = "eu.gcr.io/gitpod-core-dev/build"
	cfg.Observability = Observability{
		LogLevel: LogLevelInfo,
	}
	cfg.Certificate.Kind = ObjectRefSecret
	cfg.Certificate.Name = "https-certificates"
	cfg.Database.InCluster = pointer.Bool(true)
	cfg.Metadata.Region = "local"
	cfg.ObjectStorage.InCluster = pointer.Bool(true)
	cfg.ContainerRegistry.InCluster = pointer.Bool(true)
	cfg.Jaeger.InCluster = pointer.Bool(true)
	cfg.Workspace.Resources.Requests = corev1.ResourceList{
		corev1.ResourceCPU:    resource.MustParse("1000m"),
		corev1.ResourceMemory: resource.MustParse("2Gi"),
	}
	cfg.Workspace.Runtime.FSShiftMethod = FSShiftFuseFS
	cfg.Workspace.Runtime.ContainerDSocket = "/run/containerd/containerd.sock"
	cfg.Workspace.Runtime.ContainerDRuntimeDir = "/run/containerd/io.containerd.runtime.v2.task/k8s.io"

	return nil
}

type Config struct {
	Kind       InstallationKind `json:"kind" validate:"required,installation_kind"`
	Domain     string           `json:"domain" validate:"required,fqdn"`
	Metadata   Metadata         `json:"metadata"`
	Repository string           `json:"repository" validate:"required,ascii"`

	Observability Observability `json:"observability"`
	Analytics     *Analytics    `json:"analytics,omitempty"`

	Database Database `json:"database" validate:"required"`

	ObjectStorage ObjectStorage `json:"objectStorage" validate:"required"`

	ContainerRegistry ContainerRegistry `json:"containerRegistry" validate:"required"`

	Jaeger Jaeger `json:"jaegerOperator" validate:"required"`

	Certificate ObjectRef `json:"certificate" validate:"required"`

	ImagePullSecrets []ObjectRef `json:"imagePullSecrets"`

	Workspace Workspace `json:"workspace" validate:"required"`

	AuthProviders []AuthProviderConfigs `json:"authProviders" validate:"dive"`
	BlockNewUsers BlockNewUsers         `json:"blockNewUsers"`
}

type Metadata struct {
	Region string `json:"region" validate:"required"`
}

type Observability struct {
	LogLevel LogLevel `json:"logLevel" validate:"required,log_level"`
	Tracing  *Tracing `json:"tracing,omitempty"`
}

type Analytics struct {
	SegmentKey string `json:"segmentKey"`
	Writer     string `json:"writer"`
}

type Tracing struct {
	Endpoint  *string `json:"endpoint,omitempty"`
	AgentHost *string `json:"agentHost,omitempty"`
}

type Database struct {
	InCluster *bool             `json:"inCluster,omitempty"`
	External  *DatabaseExternal `json:"external,omitempty"`
	CloudSQL  *DatabaseCloudSQL `json:"cloudSQL,omitempty"`
}

type DatabaseExternal struct {
	Certificate ObjectRef `json:"certificate"`
}

type DatabaseCloudSQL struct {
	ServiceAccount ObjectRef `json:"serviceAccount"`
	Instance       string    `json:"instance" validate:"required"`
}

type ObjectStorage struct {
	InCluster    *bool                      `json:"inCluster,omitempty"`
	S3           *ObjectStorageS3           `json:"s3,omitempty"`
	CloudStorage *ObjectStorageCloudStorage `json:"cloudStorage,omitempty"`
	Azure        *ObjectStorageAzure        `json:"azure,omitempty"`
}

type ObjectStorageS3 struct {
	Endpoint    string    `json:"endpoint" validate:"required"`
	Credentials ObjectRef `json:"credentials" validate:"required"`
}

type ObjectStorageCloudStorage struct {
	ServiceAccount ObjectRef `json:"serviceAccount" validate:"required"`
	Project        string    `json:"project" validate:"required"`
}

type ObjectStorageAzure struct {
	Credentials ObjectRef `json:"credentials" validate:"required"`
}

type InstallationKind string

const (
	InstallationMeta      InstallationKind = "Meta"
	InstallationWorkspace InstallationKind = "Workspace"
	InstallationFull      InstallationKind = "Full"
)

type ObjectRef struct {
	Kind ObjectRefKind `json:"kind" validate:"required,objectref_kind"`
	Name string        `json:"name" validate:"required"`
}

type ObjectRefKind string

const (
	ObjectRefSecret ObjectRefKind = "secret"
)

type ContainerRegistry struct {
	InCluster *bool                      `json:"inCluster,omitempty" validate:"required"`
	External  *ContainerRegistryExternal `json:"external,omitempty" validate:"required_if=InCluster false"`
}

type ContainerRegistryExternal struct {
	URL         string    `json:"url" validate:"required"`
	Certificate ObjectRef `json:"certificate" validate:"required"`
}

type Jaeger struct {
	InCluster *bool                   `json:"inCluster,omitempty" validate:"required"`
	External  *JaegerOperatorExternal `json:"external,omitempty" validate:"required_if=InCluster false"`
}

type JaegerOperatorExternal struct {
	Certificate ObjectRef `json:"certificate" validate:"required"`
}

type LogLevel string

// Taken from github.com/gitpod-io/gitpod/components/gitpod-protocol/src/util/logging.ts
const (
	LogLevelTrace   LogLevel = "trace"
	LogLevelDebug   LogLevel = "debug"
	LogLevelInfo    LogLevel = "info"
	LogLevelWarning LogLevel = "warning"
	LogLevelError   LogLevel = "error"
	LogLevelFatal   LogLevel = "fatal"
	LogLevelPanic   LogLevel = "panic"
)

type Resources struct {
	// todo(sje): add custom validation to corev1.ResourceList
	Requests      corev1.ResourceList `json:"requests" validate:"required"`
	Limits        corev1.ResourceList `json:"limits,omitempty"`
	DynamicLimits *struct {
		CPU []resources.Bucket // todo(sje): add custom validation
	} `json:"dynamicLimits,omitempty"`
}

type WorkspaceRuntime struct {
	FSShiftMethod        FSShiftMethod `json:"fsShiftMethod" validate:"required,fs_shift_method"`
	ContainerDRuntimeDir string        `json:"containerdRuntimeDir" validate:"required,startswith=/"`
	ContainerDSocket     string        `json:"containerdSocket" validate:"required,startswith=/"`
}

type WorkspaceTemplates struct {
	Default    *corev1.Pod `json:"default"`
	Prebuild   *corev1.Pod `json:"prebuild"`
	Ghost      *corev1.Pod `json:"ghost"`
	ImageBuild *corev1.Pod `json:"image_build"`
	Regular    *corev1.Pod `json:"regular"`
	Probe      *corev1.Pod `json:"probe"`
}

type Workspace struct {
	Runtime   WorkspaceRuntime    `json:"runtime" validate:"required"`
	Resources Resources           `json:"resources" validate:"required"`
	Templates *WorkspaceTemplates `json:"templates,omitempty"`
}

type FSShiftMethod string

const (
	FSShiftFuseFS  FSShiftMethod = "fuse"
	FSShiftShiftFS FSShiftMethod = "shiftfs"
)

// todo(sje): I don't know if we want to put this in the config YAML
type AuthProviderConfigs struct {
	ID                  string            `json:"id" validate:"required"`
	Host                string            `json:"host" validate:"required"`
	Type                string            `json:"type" validate:"required"`
	BuiltIn             string            `json:"builtin"`
	Verified            string            `json:"verified"`
	OAuth               OAuth             `json:"oauth" validate:"required"`
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
	ClientId            string            `json:"clientId" validate:"required"`
	ClientSecret        string            `json:"clientSecret" validate:"required"`
	CallBackUrl         string            `json:"callBackUrl" validate:"required"`
	AuthorizationUrl    string            `json:"authorizationUrl"`
	TokenUrl            string            `json:"tokenUrl"`
	Scope               string            `json:"scope"`
	ScopeSeparator      string            `json:"scopeSeparator"`
	SettingsUrl         string            `json:"settingsUrl"`
	AuthorizationParams map[string]string `json:"authorizationParams"`
	ConfigURL           string            `json:"configURL"`
	ConfigFn            string            `json:"configFn"`
}
