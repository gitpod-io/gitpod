// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"time"

	agentSmith "github.com/gitpod-io/gitpod/agent-smith/pkg/config"
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
	cfg.Workspace.Runtime.FSShiftMethod = FSShiftShiftFS
	cfg.Workspace.Runtime.ContainerDSocketDir = containerd.ContainerdSocketLocationDefault.String()
	cfg.Workspace.Runtime.ContainerDRuntimeDir = containerd.ContainerdLocationDefault.String()
	cfg.Workspace.MaxLifetime = util.Duration(36 * time.Hour)
	cfg.OpenVSX.URL = defaultOpenVSXURL
	cfg.DisableDefinitelyGP = true

	return nil
}

// Looks for deprecated parameters
func (v version) CheckDeprecated(rawCfg interface{}) (map[string]interface{}, []string) {
	warnings := make(map[string]interface{}, 0) // A warning is for when a deprecated field is used
	conflicts := make([]string, 0)
	cfg := rawCfg.(*Config) // A conflict is for when both the deprecated and current field is used

	for key, field := range deprecatedFields {
		// Check if the deprecated field is in use
		inUse, val := parseDeprecatedSelector(cfg, field)

		if inUse {
			// Deprecated field in use - print the value to the warnings
			warnings[key] = val

			if field.MapValue != nil {
				// There's a MapValue field
				if err := field.MapValue(cfg); err != nil {
					// There's a conflict on the mapped value - set in both old and new places
					conflicts = append(conflicts, err.Error())
				}
			}
		}
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

	// Deprecated.
	MessageBus *MessageBus `json:"messageBus,omitempty"`

	ObjectStorage ObjectStorage `json:"objectStorage" validate:"required"`

	ContainerRegistry ContainerRegistry `json:"containerRegistry" validate:"required"`

	Certificate ObjectRef `json:"certificate" validate:"required"`

	HTTPProxy *ObjectRef `json:"httpProxy,omitempty"`

	ImagePullSecrets []ObjectRef `json:"imagePullSecrets,omitempty"`

	Workspace Workspace `json:"workspace" validate:"required"`

	OpenVSX OpenVSX `json:"openVSX"`

	AuthProviders []ObjectRef   `json:"authProviders" validate:"dive"`
	BlockNewUsers BlockNewUsers `json:"blockNewUsers"`

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
	SegmentKey      string `json:"segmentKey"`
	Writer          string `json:"writer"`
	SegmentEndpoint string `json:"segmentEndpoint,omitempty"`
}

type Tracing struct {
	Endpoint  *string `json:"endpoint,omitempty"`
	AgentHost *string `json:"agentHost,omitempty"`
	// Name of the kubernetes secret to use for Jaeger authentication
	// The secret should contains two definitions: JAEGER_USER and JAEGER_PASSWORD
	SecretName *string `json:"secretName,omitempty"`
}

type MessageBus struct {
	Credentials *ObjectRef `json:"credentials"`
}

type Database struct {
	InCluster *bool             `json:"inCluster,omitempty"`
	External  *DatabaseExternal `json:"external,omitempty"`
	CloudSQL  *DatabaseCloudSQL `json:"cloudSQL,omitempty"`
	SSL       *SSLOptions       `json:"ssl,omitempty"`
	// A temporary flag to help debug for the migration to MySQL 8.0
	InClusterMysSQL_8_0 bool `json:"inClusterMySql_8_0,omitempty"`
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
	// DEPRECATED
	MaximumBackupCount *int       `json:"maximumBackupCount,omitempty"`
	BlobQuota          *int64     `json:"blobQuota,omitempty"`
	Resources          *Resources `json:"resources,omitempty"`
}

type ObjectStorageS3 struct {
	Endpoint    string     `json:"endpoint" validate:"required"`
	Credentials *ObjectRef `json:"credentials"`

	BucketName string `json:"bucket" validate:"required"`

	AllowInsecureConnection bool `json:"allowInsecureConnection"`
}

type ObjectStorageCloudStorage struct {
	ServiceAccount ObjectRef `json:"serviceAccount" validate:"required"`
	Project        string    `json:"project" validate:"required"`
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
	Certificate *ObjectRef `json:"certificate,omitempty"`
	Credentials *ObjectRef `json:"credentials,omitempty"`
}

type S3Storage struct {
	Bucket      string     `json:"bucket" validate:"required"`
	Region      string     `json:"region" validate:"required"`
	Endpoint    string     `json:"endpoint" validate:"required"`
	Certificate *ObjectRef `json:"certificate,omitempty"`
}

type ServiceAnnotations map[string]string

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
	ContainerDSocketDir string `json:"containerdSocketDir" validate:"required,startswith=/"`
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

type Workspace struct {
	Runtime   WorkspaceRuntime    `json:"runtime" validate:"required"`
	Resources Resources           `json:"resources" validate:"required"`
	Templates *WorkspaceTemplates `json:"templates,omitempty"`

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
	URL   string        `json:"url" validate:"url"`
	Proxy *OpenVSXProxy `json:"proxy,omitempty"`
}

type OpenVSXProxy struct {
	DisablePVC bool `json:"disablePVC"`
	Proxy      `json:",inline"`
}

type Proxy struct {
	ServiceAnnotations ServiceAnnotations `json:"serviceAnnotations"`
}

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
	AgentSmith *agentSmith.Config    `json:"agentSmith,omitempty"`
	IDE        *IDEComponents        `json:"ide"`
	PodConfig  map[string]*PodConfig `json:"podConfig,omitempty"`
	Proxy      *ProxyComponent       `json:"proxy,omitempty"`
}

type IDEComponents struct {
	Metrics       *IDEMetrics `json:"metrics,omitempty"`
	Proxy         *Proxy      `json:"proxy,omitempty"`
	ResolveLatest *bool       `json:"resolveLatest,omitempty"`
}

type IDEMetrics struct {
	ErrorReportingEnabled bool `json:"errorReportingEnabled,omitempty"`
}

type PodConfig struct {
	Replicas  *int32                                  `json:"replicas,omitempty"`
	Resources map[string]*corev1.ResourceRequirements `json:"resources,omitempty"`
}

type ProxyComponent struct {
	Service *ComponentTypeService `json:"service,omitempty"`
}

type ComponentTypeService struct {
	ServiceType *corev1.ServiceType `json:"serviceType,omitempty" validate:"omitempty,service_config_type"`
}
