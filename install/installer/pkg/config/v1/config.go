// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"

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
		AuthProviders: []ObjectRef{},
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
	cfg.Repository = "eu.gcr.io/gitpod-core-dev/build"
	cfg.Observability = Observability{
		LogLevel: LogLevelInfo,
	}
	cfg.Certificate.Kind = ObjectRefSecret
	cfg.Certificate.Name = "https-certificates"
	cfg.Database.InCluster = pointer.Bool(true)
	cfg.Metadata.Region = "local"
	cfg.Metadata.InstallationShortname = "default" // TODO(gpl): we're tied to "default" here because that's what we put into static bridges in the past
	cfg.ObjectStorage.InCluster = pointer.Bool(true)
	cfg.ObjectStorage.Resources = &Resources{
		Requests: corev1.ResourceList{
			corev1.ResourceMemory: resource.MustParse("2Gi"),
		},
	}
	cfg.ContainerRegistry.InCluster = pointer.Bool(true)
	cfg.Workspace.Resources.Requests = corev1.ResourceList{
		corev1.ResourceCPU:    resource.MustParse("1000m"),
		corev1.ResourceMemory: resource.MustParse("2Gi"),
	}
	cfg.Workspace.Runtime.FSShiftMethod = FSShiftFuseFS
	cfg.Workspace.Runtime.ContainerDSocket = "/run/containerd/containerd.sock"
	cfg.Workspace.Runtime.ContainerDRuntimeDir = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io"
	cfg.Workspace.MaxLifetime = util.Duration(36 * time.Hour)
	cfg.Workspace.PVC.Size = resource.MustParse("30Gi")
	cfg.Workspace.PVC.StorageClass = ""
	cfg.Workspace.PVC.SnapshotClass = ""
	cfg.OpenVSX.URL = "https://open-vsx.org"
	cfg.DisableDefinitelyGP = true

	return nil
}

// Config defines the v1 version structure of the gitpod config file
type Config struct {
	// Installation type to run - for most users, this will be Full
	Kind InstallationKind `json:"kind" validate:"required,installation_kind"`
	// The domain to deploy to
	Domain     string   `json:"domain" validate:"required,fqdn"`
	Metadata   Metadata `json:"metadata"`
	Repository string   `json:"repository" validate:"required,ascii"`

	Observability Observability `json:"observability"`
	Analytics     *Analytics    `json:"analytics,omitempty"`

	Database Database `json:"database" validate:"required"`

	ObjectStorage ObjectStorage `json:"objectStorage" validate:"required"`

	ContainerRegistry ContainerRegistry `json:"containerRegistry" validate:"required"`

	Certificate ObjectRef `json:"certificate" validate:"required"`

	ImagePullSecrets []ObjectRef `json:"imagePullSecrets,omitempty"`

	Workspace Workspace `json:"workspace" validate:"required"`

	OpenVSX OpenVSX `json:"openVSX"`

	AuthProviders []ObjectRef   `json:"authProviders" validate:"dive"`
	BlockNewUsers BlockNewUsers `json:"blockNewUsers"`
	License       *ObjectRef    `json:"license,omitempty"`

	SSHGatewayHostKey *ObjectRef `json:"sshGatewayHostKey,omitempty"`

	DisableDefinitelyGP bool `json:"disableDefinitelyGp"`

	CustomCACert *ObjectRef `json:"customCACert,omitempty"`

	DropImageRepo *bool `json:"dropImageRepo,omitempty"`

	Experimental *experimental.Config `json:"experimental,omitempty"`
}

type Metadata struct {
	// Location for your objectStorage provider
	Region string `json:"region" validate:"required"`
	// InstallationShortname establishes the "identity" of the (application) cluster.
	InstallationShortname string `json:"shortname"`
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
	InCluster          *bool                      `json:"inCluster,omitempty"`
	S3                 *ObjectStorageS3           `json:"s3,omitempty"`
	CloudStorage       *ObjectStorageCloudStorage `json:"cloudStorage,omitempty"`
	Azure              *ObjectStorageAzure        `json:"azure,omitempty"`
	MaximumBackupCount *int                       `json:"maximumBackupCount,omitempty"`
	BlobQuota          *int64                     `json:"blobQuota,omitempty"`
	Resources          *Resources                 `json:"resources,omitempty"`
}

type ObjectStorageS3 struct {
	Endpoint    string    `json:"endpoint" validate:"required"`
	Credentials ObjectRef `json:"credentials" validate:"required"`

	// BucketName sets the name of an existing bucket to enable the "single bucket mode"
	// If no name is configured, the old "one bucket per user" behaviour kicks in.
	BucketName string `json:"bucket"`
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
	S3Storage *S3Storage                 `json:"s3storage,omitempty"`
}

type ContainerRegistryExternal struct {
	URL         string    `json:"url" validate:"required"`
	Certificate ObjectRef `json:"certificate" validate:"required"`
}

type S3Storage struct {
	Bucket      string    `json:"bucket" validate:"required"`
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
		CPU []cpulimit.Bucket // todo(sje): add custom validation
	} `json:"dynamicLimits,omitempty"`
}

type WorkspaceRuntime struct {
	// File system
	FSShiftMethod FSShiftMethod `json:"fsShiftMethod" validate:"required,fs_shift_method"`
	// The location of containerd socket on the host machine
	ContainerDRuntimeDir string `json:"containerdRuntimeDir" validate:"required,startswith=/"`
	// The location of containerd socket on the host machine
	ContainerDSocket string `json:"containerdSocket" validate:"required,startswith=/"`
}

type WorkspaceTemplates struct {
	Default    *corev1.Pod `json:"default"`
	Prebuild   *corev1.Pod `json:"prebuild"`
	ImageBuild *corev1.Pod `json:"imagebuild"`
	Regular    *corev1.Pod `json:"regular"`
}

type PersistentVolumeClaim struct {
	// Size is a size of persistent volume claim to use
	Size resource.Quantity `json:"size" validate:"required"`

	// StorageClass is a storage class of persistent volume claim to use
	StorageClass string `json:"storageClass"`

	// SnapshotClass is a snapshot class name that is used to create volume snapshot
	SnapshotClass string `json:"snapshotClass"`
}

type Workspace struct {
	Runtime   WorkspaceRuntime    `json:"runtime" validate:"required"`
	Resources Resources           `json:"resources" validate:"required"`
	Templates *WorkspaceTemplates `json:"templates,omitempty"`

	// PVC is the struct that describes how to setup persistent volume claim for workspace
	PVC PersistentVolumeClaim `json:"pvc" validate:"required"`

	// MaxLifetime is the maximum time a workspace is allowed to run. After that, the workspace times out despite activity
	MaxLifetime util.Duration `json:"maxLifetime" validate:"required"`

	// TimeoutDefault is the default timeout of a regular workspace
	TimeoutDefault *util.Duration `json:"timeoutDefault,omitempty"`

	// TimeoutExtended is the workspace timeout that a user can extend to for one workspace
	TimeoutExtended *util.Duration `json:"timeoutExtended,omitempty"`

	// TimeoutAfterClose is the time a workspace timed out after it has been closed (“closed” means that it does not get a heartbeat from an IDE anymore)
	TimeoutAfterClose *util.Duration `json:"timeoutAfterClose,omitempty"`
}

type OpenVSX struct {
	URL string `json:"url" validate:"url"`
}

type LicensorType string

const (
	LicensorTypeGitpod     LicensorType = "gitpod"
	LicensorTypeReplicated LicensorType = "replicated"
)

type FSShiftMethod string

const (
	FSShiftFuseFS  FSShiftMethod = "fuse"
	FSShiftShiftFS FSShiftMethod = "shiftfs"
)

type BlockNewUsers struct {
	Enabled  bool     `json:"enabled"`
	Passlist []string `json:"passlist"`
}

// AuthProviderConfigs this only contains what is necessary for validation
type AuthProviderConfigs struct {
	ID    string `json:"id" validate:"required"`
	Host  string `json:"host" validate:"required"`
	Type  string `json:"type" validate:"required"`
	OAuth OAuth  `json:"oauth" validate:"required"`
}

// OAuth this only contains what is necessary for validation
type OAuth struct {
	ClientId     string `json:"clientId" validate:"required"`
	ClientSecret string `json:"clientSecret" validate:"required"`
	CallBackUrl  string `json:"callBackUrl" validate:"required"`
}
