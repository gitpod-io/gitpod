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

import "k8s.io/apimachinery/pkg/api/resource"

// Config contains all experimental configuration.
type Config struct {
	Workspace *WorkspaceConfig `json:"workspace,omitempty"`
	WebApp    *WebAppConfig    `json:"webapp,omitempty"`
	IDE       *IDEConfig       `json:"ide,omitempty"`
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
}

type WebAppConfig struct {
	PublicAPI *PublicAPIConfig `json:"publicApi,omitempty"`
	Server    *ServerConfig    `json:"server,omitempty"`
}

type ServerConfig struct {
	WorkspaceDefaults struct {
		WorkspaceImage string `json:"workspaceImage"`
	} `json:"workspaceDefaults"`
	OAuthServer struct {
		JWTSecret string `json:"jwtSecret"`
	} `json:"oauthServer"`
	Session struct {
		Secret string `json:"secret"`
	} `json:"session"`
	GithubApp *struct {
		AppId           int32  `json:"appId"`
		AuthProviderId  string `json:"authProviderId"`
		BaseUrl         string `json:"baseUrl"`
		CertPath        string `json:"certPath"`
		Enabled         bool   `json:"enabled"`
		LogLevel        string `json:"logLevel"`
		MarketplaceName string `json:"marketplaceName"`
		WebhookSecret   string `json:"webhookSecret"`
		CertSecretName  string `json:"certSecretName"`
	} `json:"githubApp"`
}

type PublicAPIConfig struct {
	Enabled bool `json:"enabled"`
}

type IDEConfig struct {
	// Disable resolution of latest images and use bundled latest versions instead
	ResolveLatest *bool `json:"resolveLatest,omitempty"`
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
