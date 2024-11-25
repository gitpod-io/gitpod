// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// experimental bundles all internal bits of configuration for which we do not offer
// support. We use those flags internally to operate SaaS, but do not expect anyone
// outside of Gitpod to use.
//
// Changes in this section will NOT be backwards compatible change at will without prior notice.
// If you use any setting herein, you forfeit support from Gitpod.
package experimental

import (
	"time"

	agentSmith "github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/common-go/grpc"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Config contains all experimental configuration.
type Config struct {
	Workspace  *WorkspaceConfig   `json:"workspace,omitempty"`
	WebApp     *WebAppConfig      `json:"webapp,omitempty"`
	IDE        *IDEConfig         `json:"ide,omitempty"`    // @deprecated
	Common     *CommonConfig      `json:"common,omitempty"` // @deprecated
	Overrides  *[]Overrides       `json:"overrides,omitempty"`
	AgentSmith *agentSmith.Config `json:"agentSmith,omitempty"` // @deprecated
}

type CommonConfig struct {
	// Deprecated.
	PodConfig map[string]*PodConfig `json:"podConfig,omitempty"`
}

type PodConfig struct {
	Replicas  *int32                                  `json:"replicas,omitempty"`
	Resources map[string]*corev1.ResourceRequirements `json:"resources,omitempty"`
}

type NodeToContainerMappingValues struct {
	Path  string `json:"path"`
	Value string `json:"value"`
}

type WorkspaceConfig struct {
	Tracing                  *Tracing `json:"tracing,omitempty"`
	Stage                    string   `json:"stage,omitempty"`
	SchedulerName            string   `json:"schedulerName,omitempty"`
	HostURL                  string   `json:"hostURL,omitempty"`
	WorkspaceClusterHost     string   `json:"workspaceClusterHost,omitempty"`
	WorkspaceURLTemplate     string   `json:"workspaceURLTemplate,omitempty"`
	WorkspacePortURLTemplate string   `json:"workspacePortURLTemplate,omitempty"`

	WorkspaceCIDR string `json:"workspaceCIDR,omitempty"`

	CPULimits struct {
		Enabled          bool              `json:"enabled"`
		NodeCPUBandwidth resource.Quantity `json:"nodeBandwidth"`
		Limit            resource.Quantity `json:"limit"`
		BurstLimit       resource.Quantity `json:"burstLimit"`
	}
	IOLimits struct {
		WriteBWPerSecond resource.Quantity `json:"writeBandwidthPerSecond"`
		ReadBWPerSecond  resource.Quantity `json:"readBandwidthPerSecond"`
		WriteIOPS        int64             `json:"writeIOPS"`
		ReadIOPS         int64             `json:"readIOPS"`
	} `json:"ioLimits"`
	NetworkLimits struct {
		Enabled              bool  `json:"enabled"`
		Enforce              bool  `json:"enforce"`
		ConnectionsPerMinute int64 `json:"connectionsPerMinute"`
		BucketSize           int64 `json:"bucketSize"`
	} `json:"networkLimits"`
	OOMScores struct {
		Enabled bool `json:"enabled"`
		Tier1   int  `json:"tier1"`
		Tier2   int  `json:"tier2"`
	} `json:"oomScores"`

	ProcLimit int64 `json:"procLimit"`

	WSManagerRateLimits map[string]grpc.RateLimit `json:"wsManagerRateLimits,omitempty"`

	RegistryFacade struct {
		IPFSCache struct {
			Enabled  bool   `json:"enabled"`
			IPFSAddr string `json:"ipfsAddr"`
		} `json:"ipfsCache"`
		RedisCache struct {
			Enabled            bool   `json:"enabled"`
			SingleHostAddress  string `json:"singleHostAddr"`
			Username           string `json:"username"`
			PasswordSecret     string `json:"passwordSecret"`
			UseTLS             bool   `json:"useTLS"`
			InsecureSkipVerify bool   `json:"insecureSkipVerify"`
		} `json:"redisCache"`
	} `json:"registryFacade"`

	WSDaemon struct {
		Runtime struct {
			NodeToContainerMapping []NodeToContainerMappingValues `json:"nodeToContainerMapping"`
		} `json:"runtime"`
	} `json:"wsDaemon"`

	WorkspaceClasses        map[string]WorkspaceClass `json:"classes,omitempty"`
	PreferredWorkspaceClass string                    `json:"preferredWorkspaceClass,omitempty"`

	WSProxy struct {
		IngressHeader                              string `json:"ingressHeader"`
		BlobServeHost                              string `json:"blobServeHost"`
		GitpodInstallationHostName                 string `json:"gitpodInstallationHostName"`
		GitpodInstallationWorkspaceHostSuffix      string `json:"gitpodInstallationWorkspaceHostSuffix"`
		GitpodInstallationWorkspaceHostSuffixRegex string `json:"gitpodInstallationWorkspaceHostSuffixRegex"`
	} `json:"wsProxy"`

	ContentService struct {
		// Deprecated
		UsageReportBucketName string `json:"usageReportBucketName"`
	} `json:"contentService"`

	EnableProtectedSecrets *bool `json:"enableProtectedSecrets"`

	ImageBuilderMk3 struct {
		BaseImageRepositoryName      string `json:"baseImageRepositoryName"`
		WorkspaceImageRepositoryName string `json:"workspaceImageRepositoryName"`
	} `json:"imageBuilderMk3"`
}

type WorkspaceClass struct {
	Name        string             `json:"name" validate:"required"`
	Description string             `json:"description"`
	Resources   WorkspaceResources `json:"resources" validate:"required"`
	Templates   WorkspaceTemplates `json:"templates,omitempty"`
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

type StripePriceIDs struct {
	EUR string `json:"eur"`
	USD string `json:"usd"`
}

type StripeConfig struct {
	IndividualUsagePriceIDs StripePriceIDs `json:"individualUsagePriceIds"`
	TeamUsagePriceIDs       StripePriceIDs `json:"teamUsagePriceIds"`
}

type IAMConfig struct {
	OIDCClientsSecretName string `json:"oidsClientsConfigSecret,omitempty"`
}

type SpiceDBConfig struct {
	Enabled bool `json:"enabled"`

	DisableMigrations bool `json:"disableMigrations"`

	// Reference to a k8s secret which contains a "presharedKey" for authentication with SpiceDB
	// Required.
	SecretRef string `json:"secretRef"`
}

type RedisConfig struct {
	Address   string `json:"address,omitempty"`
	Username  string `json:"username,omitempty"`
	SecretRef string `json:"secretRef,omitempty"`
}

type WebAppConfig struct {
	PublicAPI *PublicAPIConfig `json:"publicApi,omitempty"`

	// PublicURL lets you override the publically reachable endpoints of gitpod (currently only public api endpoint)
	// If not set, default will be api.${Domain}
	PublicURL string `json:"publicUrl,omitempty"`

	Server                       *ServerConfig          `json:"server,omitempty"`
	ProxyConfig                  *ProxyConfig           `json:"proxy,omitempty"`
	WorkspaceManagerBridge       *WsManagerBridgeConfig `json:"wsManagerBridge,omitempty"`
	Tracing                      *Tracing               `json:"tracing,omitempty"`
	UsePodAntiAffinity           bool                   `json:"usePodAntiAffinity"`
	DisableMigration             bool                   `json:"disableMigration"`
	Usage                        *UsageConfig           `json:"usage,omitempty"`
	ConfigcatKey                 string                 `json:"configcatKey"`
	WorkspaceClasses             []WebAppWorkspaceClass `json:"workspaceClasses"`
	Stripe                       *StripeConfig          `json:"stripe,omitempty"`
	IAM                          *IAMConfig             `json:"iam,omitempty"`
	SpiceDB                      *SpiceDBConfig         `json:"spicedb,omitempty"`
	CertmanagerNamespaceOverride string                 `json:"certmanagerNamespaceOverride,omitempty"`
	Redis                        *RedisConfig           `json:"redis"`

	// ProxySettings is used if the gitpod cell uses some proxy for connectivity
	ProxySettings *ProxySettings `json:"proxySettings"`
}

type ProxySettings struct {
	HttpProxy  string `json:"http_proxy"`
	HttpsProxy string `json:"https_proxy"`
	// NoProxy setting should be used for the CIDRs and hostnames that should be not using the proxy URLs
	NoProxy string `json:"no_proxy"`
}

type WorkspaceDefaults struct {
	// @deprecated use workspace.workspaceImage instead
	WorkspaceImage string `json:"workspaceImage"`
}

type OAuthServer struct {
	JWTSecret string `json:"jwtSecret"`
}

type Session struct {
	Secret string `json:"secret"`
}

type GithubApp struct {
	AppId           int32  `json:"appId"`
	AuthProviderId  string `json:"authProviderId"`
	BaseUrl         string `json:"baseUrl"`
	CertPath        string `json:"certPath"`
	Enabled         bool   `json:"enabled"`
	LogLevel        string `json:"logLevel"`
	MarketplaceName string `json:"marketplaceName"`
	WebhookSecret   string `json:"webhookSecret"`
	CertSecretName  string `json:"certSecretName"`
}

type WsManagerBridgeConfig struct {
	SkipSelf bool `json:"skipSelf"`
}

type ServerConfig struct {
	WorkspaceDefaults                 WorkspaceDefaults `json:"workspaceDefaults"`
	OAuthServer                       OAuthServer       `json:"oauthServer"`
	Session                           Session           `json:"session"`
	GithubApp                         *GithubApp        `json:"githubApp"`
	StripeSecret                      string            `json:"stripeSecret"`
	StripeConfig                      string            `json:"stripeConfig"`
	LinkedInSecret                    string            `json:"linkedInSecret"`
	DisableDynamicAuthProviderLogin   bool              `json:"disableDynamicAuthProviderLogin"`
	EnableLocalApp                    *bool             `json:"enableLocalApp"`
	RunDbDeleter                      *bool             `json:"runDbDeleter"`
	DisableWorkspaceGarbageCollection bool              `json:"disableWorkspaceGarbageCollection"`
	DisableCompleteSnapshotJob        bool              `json:"disableCompleteSnapshotJob"`
	InactivityPeriodForReposInDays    *int              `json:"inactivityPeriodForReposInDays"`
	// deprecated: use IsDedicatedInstallation instead
	IsSingleOrgInstallation bool `json:"isSingleOrgInstallation"`
	IsDedicatedInstallation bool `json:"isDedicatedInstallation"`

	// @deprecated use containerRegistry.privateBaseImageAllowList instead
	DefaultBaseImageRegistryWhiteList []string `json:"defaultBaseImageRegistryWhitelist"`

	GoogleCloudProfilerEnabled bool `json:"gcpProfilerEnabled,omitempty"`
}

type ProxyConfig struct {
	StaticIP           string            `json:"staticIP"`
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`

	// @deprecated use components.proxy.service.serviceType instead
	ServiceType *corev1.ServiceType `json:"serviceType,omitempty" validate:"omitempty,service_config_type"`

	Configcat *ConfigcatProxyConfig `json:"configcat,omitempty"`

	AnalyticsPlugin *AnalyticsPluginConfig `json:"analyticsPlugin,omitempty"`

	FrontendDevEnabled bool `json:"frontendDevEnabled"`
}

type ConfigcatProxyConfig struct {
	BaseUrl       string `json:"baseUrl"`
	PollInterval  string `json:"pollInterval"`
	FromConfigMap string `json:"fromConfigMap"`
}

type AnalyticsPluginConfig struct {
	TrustedSegmentKey   string `json:"trustedSegmentKey"`
	UntrustedSegmentKey string `json:"untrustedSegmentKey"`
	SegmentEndpoint     string `json:"segmentEndpoint,omitempty"`
}

type PublicAPIConfig struct {
	// Name of the kubernetes secret to use for Stripe secrets
	StripeSecretName string `json:"stripeSecretName"`

	// Name of the kubernetes secret to use for signature of Personal Access Tokens
	PersonalAccessTokenSigningKeySecretName string `json:"personalAccessTokenSigningKeySecretName"`
}

type UsageConfig struct {
	Enabled                          bool                     `json:"enabled"`
	Schedule                         string                   `json:"schedule"`
	ResetUsageSchedule               string                   `json:"resetUsageSchedule"`
	BillInstancesAfter               *time.Time               `json:"billInstancesAfter"`
	DefaultSpendingLimit             *db.DefaultSpendingLimit `json:"defaultSpendingLimit"`
	CreditsPerMinuteByWorkspaceClass map[string]float64       `json:"creditsPerMinuteByWorkspaceClass"`
}

type WebAppWorkspaceClass struct {
	Id          string                 `json:"id"`
	Category    string                 `json:"category"`
	DisplayName string                 `json:"displayName"`
	Description string                 `json:"description"`
	PowerUps    uint32                 `json:"powerups"`
	IsDefault   bool                   `json:"isDefault"`
	Deprecated  bool                   `json:"deprecated"`
	Marker      map[string]bool        `json:"marker,omitempty"`
	Credits     *WorkspaceClassCredits `json:"credits,omitempty"`
}

type WorkspaceClassCredits struct {
	PerMinute float64 `json:"perMinute,omitempty"`
}

// @deprecated
type IDEConfig struct {
	// Disable resolution of latest images and use bundled latest versions instead
	ResolveLatest    *bool             `json:"resolveLatest,omitempty"`
	IDEProxyConfig   *IDEProxyConfig   `json:"ideProxy,omitempty"`
	VSXProxyConfig   *VSXProxyConfig   `json:"openvsxProxy,omitempty"`
	IDEMetricsConfig *IDEMetricsConfig `json:"ideMetrics,omitempty"`
}

// @deprecated
type IDEProxyConfig struct {
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`
}

// @deprecated
type IDEMetricsConfig struct {
	EnabledErrorReporting bool `json:"enabledErrorReporting,omitempty"`
}

// @deprecated
type VSXProxyConfig struct {
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`
}

type TracingSampleType string

type Tracing struct {
	SamplerType  *TracingSampleType `json:"samplerType,omitempty" validate:"omitempty,tracing_sampler_type"`
	SamplerParam *float64           `json:"samplerParam,omitempty" validate:"required_with=SamplerType"`
}

// Values taken from https://github.com/jaegertracing/jaeger-client-go/blob/967f9c36f0fa5a2617c9a0993b03f9a3279fadc8/config/config.go#L71
const (
	TracingSampleTypeConst         TracingSampleType = "const"
	TracingSampleTypeProbabilistic TracingSampleType = "probabilistic"
	TracingSampleTypeRateLimiting  TracingSampleType = "rateLimiting"
	TracingSampleTypeRemote        TracingSampleType = "remote"
)

type Overrides struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ObjectMeta `json:"metadata"`
	Override        map[string]any    `json:"override"`
}
