// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

// Config contains all experimental configuration.
type Config struct {
	Workspace  *WorkspaceConfig   `json:"workspace,omitempty"`
	WebApp     *WebAppConfig      `json:"webapp,omitempty"`
	IDE        *IDEConfig         `json:"ide,omitempty"`
	Common     *CommonConfig      `json:"common,omitempty"`
	Telemetry  *TelemetryConfig   `json:"telemetry,omitempty"`
	AgentSmith *agentSmith.Config `json:"agentSmith,omitempty"`
}

type TelemetryConfig struct {
	Data struct {
		Platform string `json:"platform"`
	} `json:"data"`
}

type CommonConfig struct {
	PodConfig                map[string]*PodConfig `json:"podConfig,omitempty"`
	StaticMessagebusPassword string                `json:"staticMessagebusPassword"`
	// @deprecated PodSecurityPolicies are deprecated in k8s 1.21 and removed in 1.25
	UsePodSecurityPolicies bool `json:"usePodSecurityPolicies"`
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

	WorkspaceClasses map[string]WorkspaceClass `json:"classes,omitempty"`

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
}

type PersistentVolumeClaim struct {
	// Size is a size of persistent volume claim to use
	Size resource.Quantity `json:"size" validate:"required"`

	// StorageClass is a storage class of persistent volume claim to use
	StorageClass string `json:"storageClass"`

	// SnapshotClass is a snapshot class name that is used to create volume snapshot
	SnapshotClass string `json:"snapshotClass"`
}

type WorkspaceClass struct {
	Name      string                `json:"name" validate:"required"`
	Resources WorkspaceResources    `json:"resources" validate:"required"`
	Templates WorkspaceTemplates    `json:"templates,omitempty"`
	PVC       PersistentVolumeClaim `json:"pvc" validate:"required"`
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

type WebAppConfig struct {
	PublicAPI              *PublicAPIConfig       `json:"publicApi,omitempty"`
	Server                 *ServerConfig          `json:"server,omitempty"`
	ProxyConfig            *ProxyConfig           `json:"proxy,omitempty"`
	WorkspaceManagerBridge *WsManagerBridgeConfig `json:"wsManagerBridge,omitempty"`
	Tracing                *Tracing               `json:"tracing,omitempty"`
	UsePodAntiAffinity     bool                   `json:"usePodAntiAffinity"`
	DisableMigration       bool                   `json:"disableMigration"`
	Usage                  *UsageConfig           `json:"usage,omitempty"`
	ConfigcatKey           string                 `json:"configcatKey"`
	WorkspaceClasses       []WebAppWorkspaceClass `json:"workspaceClasses"`
	Stripe                 *StripeConfig          `json:"stripe,omitempty"`
	SlowDatabase           bool                   `json:"slowDatabase,omitempty"`
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
	ChargebeeSecret                   string            `json:"chargebeeSecret"`
	StripeSecret                      string            `json:"stripeSecret"`
	StripeConfig                      string            `json:"stripeConfig"`
	DisableDynamicAuthProviderLogin   bool              `json:"disableDynamicAuthProviderLogin"`
	EnableLocalApp                    *bool             `json:"enableLocalApp"`
	RunDbDeleter                      *bool             `json:"runDbDeleter"`
	DisableWorkspaceGarbageCollection bool              `json:"disableWorkspaceGarbageCollection"`
	InactivityPeriodForReposInDays    *int              `json:"inactivityPeriodForReposInDays"`

	// @deprecated use containerRegistry.privateBaseImageAllowList instead
	DefaultBaseImageRegistryWhiteList []string `json:"defaultBaseImageRegistryWhitelist"`
}

type ProxyConfig struct {
	StaticIP           string            `json:"staticIP"`
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`

	// @deprecated use components.proxy.service.serviceType instead
	ServiceType *corev1.ServiceType `json:"serviceType,omitempty" validate:"omitempty,service_config_type"`

	Configcat *ConfigcatProxyConfig `json:"configcat,omitempty"`
}

type ConfigcatProxyConfig struct {
	BaseUrl      string `json:"baseUrl"`
	PollInterval string `json:"pollInterval"`
}

type PublicAPIConfig struct {
	Enabled bool `json:"enabled"`
	// Name of the kubernetes secret to use for Stripe secrets
	StripeSecretName string `json:"stripeSecretName"`
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
	Id          string          `json:"id"`
	Category    string          `json:"category"`
	DisplayName string          `json:"displayName"`
	Description string          `json:"description"`
	PowerUps    uint32          `json:"powerups"`
	IsDefault   bool            `json:"isDefault"`
	Deprecated  bool            `json:"deprecated"`
	Marker      map[string]bool `json:"marker,omitempty"`
}

type IDEConfig struct {
	// Disable resolution of latest images and use bundled latest versions instead
	ResolveLatest    *bool             `json:"resolveLatest,omitempty"`
	IDEProxyConfig   *IDEProxyConfig   `json:"ideProxy,omitempty"`
	VSXProxyConfig   *VSXProxyConfig   `json:"openvsxProxy,omitempty"`
	IDEMetricsConfig *IDEMetricsConfig `json:"ideMetrics,omitempty"`
}

type IDEProxyConfig struct {
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`
}

type IDEMetricsConfig struct {
	EnabledErrorReporting bool `json:"enabledErrorReporting,omitempty"`
}

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
