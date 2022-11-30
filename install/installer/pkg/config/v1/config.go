// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/containerd"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

const (
	defaultRepositoryUrl  = "eu.gcr.io/gitpod-core-dev/build"
	defaultOpenVSXURL     = "https://open-vsx.org"
	defaultMetadataRegion = "local"
)

func (v version) Defaults(in interface{}) error {
	cfg, ok := in.(*Config)
	if !ok {
		return config.ErrInvalidType
	}

	cfg.Kind = InstallationFull
	cfg.Repository = defaultRepositoryUrl
	cfg.Observability = Observability{
		LogLevel: LogLevelInfo,
	}
	cfg.Certificate.Kind = ObjectRefSecret
	cfg.Certificate.Name = "https-certificates"
	cfg.PersonalAccessTokenSigningKey.Kind = ObjectRefSecret
	cfg.PersonalAccessTokenSigningKey.Name = "personal-access-token-signing-key"
	cfg.Database.InCluster = pointer.Bool(true)
	cfg.Metadata.Region = defaultMetadataRegion
	cfg.Metadata.InstallationShortname = InstallationShortNameOldDefault // TODO(gpl): we're tied to "default" here because that's what we put into static bridges in the past
	cfg.ObjectStorage.InCluster = pointer.Bool(true)
	cfg.ObjectStorage.Resources = &Resources{
		Requests: corev1.ResourceList{
			corev1.ResourceMemory: resource.MustParse("2Gi"),
		},
	}
	cfg.ContainerRegistry.InCluster = pointer.Bool(true)
	cfg.ContainerRegistry.PrivateBaseImageAllowList = []string{}
	cfg.Workspace.Resources.Requests = corev1.ResourceList{
		corev1.ResourceCPU:    resource.MustParse("1000m"),
		corev1.ResourceMemory: resource.MustParse("2Gi"),
	}
	cfg.Workspace.Runtime.FSShiftMethod = FSShiftFuseFS
	cfg.Workspace.Runtime.ContainerDSocket = containerd.ContainerdSocketLocationDefault.String()
	cfg.Workspace.Runtime.ContainerDRuntimeDir = containerd.ContainerdLocationDefault.String()
	cfg.Workspace.MaxLifetime = util.Duration(36 * time.Hour)
	cfg.Workspace.PrebuildPVC.Size = resource.MustParse("30Gi")
	cfg.Workspace.PrebuildPVC.StorageClass = ""
	cfg.Workspace.PrebuildPVC.SnapshotClass = ""
	cfg.Workspace.PVC.Size = resource.MustParse("30Gi")
	cfg.Workspace.PVC.StorageClass = ""
	cfg.Workspace.PVC.SnapshotClass = ""
	cfg.OpenVSX.URL = defaultOpenVSXURL
	cfg.DisableDefinitelyGP = true

	return nil
}

func (v version) CheckDeprecated(rawCfg interface{}) (map[string]interface{}, []string) {
	warnings := make(map[string]interface{}, 0)
	conflicts := make([]string, 0)
	cfg := rawCfg.(*Config)

	if cfg.Experimental != nil {
		if cfg.Experimental.Common != nil && cfg.Experimental.Common.UsePodSecurityPolicies {
			warnings["experimental.common.usePodSecurityPolicies"] = "true"
		}

		if cfg.Experimental.WebApp != nil {
			// service type of proxy is now configurable from main config
			if cfg.Experimental.WebApp.ProxyConfig != nil && cfg.Experimental.WebApp.ProxyConfig.ServiceType != nil {
				warnings["experimental.webapp.proxy.serviceType"] = *cfg.Experimental.WebApp.ProxyConfig.ServiceType

				if cfg.Components != nil && cfg.Components.Proxy != nil && cfg.Components.Proxy.Service != nil && cfg.Components.Proxy.Service.ServiceType != nil {
					conflicts = append(conflicts, "Cannot set proxy service type in both components and experimental")
				} else {
					// Promote the experimental value to the components
					if cfg.Components == nil {
						cfg.Components = &Components{}
					}
					if cfg.Components.Proxy == nil {
						cfg.Components.Proxy = &ProxyComponent{}
					}
					if cfg.Components.Proxy.Service == nil {
						cfg.Components.Proxy.Service = &ComponentTypeService{}
					}
					cfg.Components.Proxy.Service.ServiceType = cfg.Experimental.WebApp.ProxyConfig.ServiceType
				}
			}

			if cfg.Experimental.WebApp.PublicAPI != nil {
				// personalAccessTokenSigningKey is now configurable from main config
				PATkey := cfg.Experimental.WebApp.PublicAPI.PersonalAccessTokenSigningKeySecretName
				if PATkey != "" {
					// override the value in the main config and warn
					// This is performed irrespective of whether the value being default or not
					warnings["experimental.webapp.publicAPI.personalAccessTokenSigningKeySecretName"] = PATkey
					cfg.PersonalAccessTokenSigningKey.Name = PATkey
					cfg.PersonalAccessTokenSigningKey.Kind = ObjectRefSecret
				}
			}

			// default workspace base image is now configurable from main config
			if cfg.Experimental.WebApp.Server != nil {

				workspaceImage := cfg.Experimental.WebApp.Server.WorkspaceDefaults.WorkspaceImage
				if workspaceImage != "" {
					warnings["experimental.webapp.server.workspaceDefaults.workspaceImage"] = workspaceImage

					if cfg.Workspace.WorkspaceImage != "" {
						conflicts = append(conflicts, "Cannot set default workspace image in both workspaces and experimental")
					} else {
						cfg.Workspace.WorkspaceImage = workspaceImage
					}
				}

				registryAllowList := cfg.Experimental.WebApp.Server.DefaultBaseImageRegistryWhiteList
				if registryAllowList != nil {
					warnings["experimental.webapp.server.defaultBaseImageRegistryWhitelist"] = registryAllowList

					if len(cfg.ContainerRegistry.PrivateBaseImageAllowList) > 0 {
						conflicts = append(conflicts, "Cannot set allow list for private base image in both containerRegistry and experimental")
					} else {
						cfg.ContainerRegistry.PrivateBaseImageAllowList = registryAllowList
					}
				}
			}
		}
	}

	if cfg.ObjectStorage.MaximumBackupCount != nil {
		warnings["objectStorage.maximumBackupCount"] = cfg.ObjectStorage.MaximumBackupCount
	}

	return warnings, conflicts
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

	// Name of the kubernetes object to use for signature of Personal Access Tokens
	PersonalAccessTokenSigningKey ObjectRef `json:"personalAccessTokenSigningKey" validate:"required"`

	HTTPProxy *ObjectRef `json:"httpProxy,omitempty"`

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

	Customization *[]Customization `json:"customization,omitempty"`

	Components *Components `json:"components,omitempty"`

	Experimental *experimental.Config `json:"experimental,omitempty"`
}

type Metadata struct {
	// Location for your objectStorage provider
	Region string `json:"region" validate:"required"`
	// InstallationShortname establishes the "identity" of the (application) cluster.
	InstallationShortname string `json:"shortname"`
}

const (
	InstallationShortNameOldDefault string = "default"
)

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
	// Name of the kubernetes secret to use for Jaeger authentication
	// The secret should contains two definitions: JAEGER_USER and JAEGER_PASSWORD
	SecretName *string `json:"secretName,omitempty"`
}

type Database struct {
	InCluster *bool             `json:"inCluster,omitempty"`
	External  *DatabaseExternal `json:"external,omitempty"`
	CloudSQL  *DatabaseCloudSQL `json:"cloudSQL,omitempty"`
	SSL       *SSLOptions       `json:"ssl,omitempty"`
}

type DatabaseExternal struct {
	Certificate ObjectRef `json:"certificate"`
}

type DatabaseCloudSQL struct {
	ServiceAccount ObjectRef `json:"serviceAccount"`
	Instance       string    `json:"instance" validate:"required"`
}

type SSLOptions struct {
	CaCert *ObjectRef `json:"caCert,omitempty"`
}

type ObjectStorage struct {
	InCluster    *bool                      `json:"inCluster,omitempty"`
	S3           *ObjectStorageS3           `json:"s3,omitempty"`
	CloudStorage *ObjectStorageCloudStorage `json:"cloudStorage,omitempty"`
	Azure        *ObjectStorageAzure        `json:"azure,omitempty"`
	// DEPRECATED
	MaximumBackupCount *int       `json:"maximumBackupCount,omitempty"`
	BlobQuota          *int64     `json:"blobQuota,omitempty"`
	Resources          *Resources `json:"resources,omitempty"`
}

type ObjectStorageS3 struct {
	Endpoint    string    `json:"endpoint" validate:"required"`
	Credentials ObjectRef `json:"credentials" validate:"required"`

	BucketName string `json:"bucket" validate:"required"`

	AllowInsecureConnection bool `json:"allowInsecureConnection"`
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
	InstallationIDE       InstallationKind = "IDE"
	InstallationWebApp    InstallationKind = "WebApp"
	InstallationMeta      InstallationKind = "Meta" // IDE plus WebApp components
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
	InCluster                 *bool                      `json:"inCluster,omitempty" validate:"required"`
	External                  *ContainerRegistryExternal `json:"external,omitempty" validate:"required_if=InCluster false"`
	S3Storage                 *S3Storage                 `json:"s3storage,omitempty"`
	PrivateBaseImageAllowList []string                   `json:"privateBaseImageAllowList"`
}

type ContainerRegistryExternal struct {
	URL         string     `json:"url" validate:"required"`
	Certificate ObjectRef  `json:"certificate" validate:"required"`
	Credentials *ObjectRef `json:"credentials,omitempty"`
}

type S3Storage struct {
	Bucket      string    `json:"bucket" validate:"required"`
	Region      string    `json:"region" validate:"required"`
	Endpoint    string    `json:"endpoint" validate:"required"`
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
	Requests corev1.ResourceList `json:"requests" validate:"required"`
	Limits   corev1.ResourceList `json:"limits,omitempty"`
}

type WorkspaceRuntime struct {
	// File system
	FSShiftMethod FSShiftMethod `json:"fsShiftMethod" validate:"required,fs_shift_method"`
	// The location of containerd socket on the host machine
	ContainerDRuntimeDir string `json:"containerdRuntimeDir" validate:"required,startswith=/"`
	// The location of containerd socket on the host machine
	ContainerDSocket string `json:"containerdSocket" validate:"required,startswith=/"`
}

type WorkspaceResources struct {
	Requests corev1.ResourceList `json:"requests" validate:"required"`
	Limits   WorkspaceLimits     `json:"limits,omitempty"`
}

type WorkspaceLimits struct {
	Cpu              WorkspaceCpuLimits `json:"cpu"`
	Memory           string             `json:"memory"`
	Storage          string             `json:"storage"`
	EphemeralStorage string             `json:"ephemeral-storage"`
}

type WorkspaceCpuLimits struct {
	Buckets    []cpulimit.Bucket `json:"buckets"`
	MinLimit   string            `json:"min"`
	BurstLimit string            `json:"burst"`
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

	// PrebuildPVC is the struct that describes how to setup persistent volume claim for prebuild workspace
	PrebuildPVC PersistentVolumeClaim `json:"prebuildPVC" validate:"required"`

	// PVC is the struct that describes how to setup persistent volume claim for regular workspace
	PVC PersistentVolumeClaim `json:"pvc" validate:"required"`

	// MaxLifetime is the maximum time a workspace is allowed to run. After that, the workspace times out despite activity
	MaxLifetime util.Duration `json:"maxLifetime" validate:"required"`

	// TimeoutDefault is the default timeout of a regular workspace
	TimeoutDefault *util.Duration `json:"timeoutDefault,omitempty"`

	// TimeoutExtended is the workspace timeout that a user can extend to for one workspace
	TimeoutExtended *util.Duration `json:"timeoutExtended,omitempty"`

	// TimeoutAfterClose is the time a workspace timed out after it has been closed (“closed” means that it does not get a heartbeat from an IDE anymore)
	TimeoutAfterClose *util.Duration `json:"timeoutAfterClose,omitempty"`

	WorkspaceImage string `json:"workspaceImage,omitempty"`
}

type OpenVSX struct {
	URL   string `json:"url" validate:"url"`
	Proxy *Proxy `json:"proxy,omitempty"`
}

type Proxy struct {
	DisablePVC bool `json:"disablePVC"`
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
	Enabled bool `json:"enabled"`
	// Passlist []string `json:"passlist" validate:"min=1,unique,dive,fqdn"`
	Passlist []string `json:"passlist" validate:"block_new_users_passlist"`
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

// Customization is a stripped-down version of the Kubernetes YAML
type Customization struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ObjectMeta `json:"metadata"`
	Spec            CustomizationSpec `json:"spec,omitempty"`
}

type CustomizationSpec struct {
	Env []corev1.EnvVar `json:"env"`
}

type Components struct {
	Proxy *ProxyComponent `json:"proxy,omitempty"`
}

type ProxyComponent struct {
	Service *ComponentTypeService `json:"service,omitempty"`
}

type ComponentTypeService struct {
	ServiceType *corev1.ServiceType `json:"serviceType,omitempty" validate:"omitempty,service_config_type"`
}
