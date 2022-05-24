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
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

// Config contains all experimental configuration.
type Config struct {
	Workspace *WorkspaceConfig `json:"workspace,omitempty"`
	WebApp    *WebAppConfig    `json:"webapp,omitempty"`
	IDE       *IDEConfig       `json:"ide,omitempty"`
	Common    *CommonConfig    `json:"common,omitempty"`
}

type CommonConfig struct {
	PodConfig                map[string]*PodConfig `json:"podConfig,omitempty"`
	StaticMessagebusPassword string                `json:"staticMessagebusPassword"`
}

type PodConfig struct {
	Replicas  *int32                                  `json:"replicas,omitempty"`
	Resources map[string]*corev1.ResourceRequirements `json:"resources,omitempty"`
}

type WorkspaceConfig struct {
	Tracing *Tracing `json:"tracing,omitempty"`
	Stage   string   `json:"stage"`

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

	RegistryFacade struct {
		IPFSCache struct {
			Enabled  bool   `json:"enabled"`
			IPFSAddr string `json:"ipfsAddr"`
		} `json:"ipfsCache"`
		RedisCache struct {
			Enabled        bool     `json:"enabled"`
			MasterName     string   `json:"masterName"`
			SentinelAddrs  []string `json:"sentinelAddrs"`
			Username       string   `json:"username"`
			PasswordSecret string   `json:"passwordSecret"`
		} `json:"redisCache"`
	} `json:"registryFacade"`

	WorkspaceClasses map[string]WorkspaceClass `json:"classes,omitempty"`
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
	Resources struct {
		Requests corev1.ResourceList `json:"requests" validate:"required"`
		Limits   corev1.ResourceList `json:"limits,omitempty"`
	} `json:"resources" validate:"required"`
	Templates WorkspaceTemplates    `json:"templates,omitempty"`
	PVC       PersistentVolumeClaim `json:"pvc" validate:"required"`
}

type WorkspaceTemplates struct {
	Default    *corev1.Pod `json:"default"`
	Prebuild   *corev1.Pod `json:"prebuild"`
	ImageBuild *corev1.Pod `json:"imagebuild"`
	Regular    *corev1.Pod `json:"regular"`
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
}

type WorkspaceDefaults struct {
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
	WorkspaceDefaults                 WorkspaceDefaults   `json:"workspaceDefaults"`
	OAuthServer                       OAuthServer         `json:"oauthServer"`
	Session                           Session             `json:"session"`
	GithubApp                         *GithubApp          `json:"githubApp"`
	ChargebeeSecret                   string              `json:"chargebeeSecret"`
	DisableDynamicAuthProviderLogin   bool                `json:"disableDynamicAuthProviderLogin"`
	EnableLocalApp                    *bool               `json:"enableLocalApp"`
	RunDbDeleter                      *bool               `json:"runDbDeleter"`
	DefaultBaseImageRegistryWhiteList []string            `json:"defaultBaseImageRegistryWhitelist"`
	DisableWorkspaceGarbageCollection bool                `json:"disableWorkspaceGarbageCollection"`
	BlockedRepositories               []BlockedRepository `json:"blockedRepositories,omitempty"`
}

type BlockedRepository struct {
	UrlRegExp string `json:"urlRegExp"`
	BlockUser bool   `json:"blockUser"`
}

type ProxyConfig struct {
	StaticIP           string            `json:"staticIP"`
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`
}

type PublicAPIConfig struct {
	Enabled bool `json:"enabled"`
}

type UsageConfig struct {
	Enabled bool `json:"enabled"`
}

type IDEConfig struct {
	// Disable resolution of latest images and use bundled latest versions instead
	ResolveLatest  *bool           `json:"resolveLatest,omitempty"`
	IDEProxyConfig *IDEProxyConfig `json:"ideProxy,omitempty"`
	VSXProxyConfig *VSXProxyConfig `json:"openvsxProxy,omitempty"`
}

type IDEProxyConfig struct {
	ServiceAnnotations map[string]string `json:"serviceAnnotations"`
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
