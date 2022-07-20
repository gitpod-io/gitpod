// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
)

// These types are from TypeScript files

// ConfigSerialized interface from components/server/src/config.ts
type ConfigSerialized struct {
	Version                           string   `json:"version"`
	HostURL                           string   `json:"hostUrl"`
	InstallationShortname             string   `json:"installationShortname"`
	DevBranch                         string   `json:"devBranch"`
	InsecureNoDomain                  bool     `json:"insecureNoDomain"`
	License                           string   `json:"license"`
	LicenseFile                       string   `json:"licenseFile"`
	DefinitelyGpDisabled              bool     `json:"definitelyGpDisabled"`
	EnableLocalApp                    bool     `json:"enableLocalApp"`
	DisableDynamicAuthProviderLogin   bool     `json:"disableDynamicAuthProviderLogin"`
	MaxEnvvarPerUserCount             int32    `json:"maxEnvvarPerUserCount"`
	MaxConcurrentPrebuildsPerRef      int32    `json:"maxConcurrentPrebuildsPerRef"`
	MakeNewUsersAdmin                 bool     `json:"makeNewUsersAdmin"`
	DefaultBaseImageRegistryWhitelist []string `json:"defaultBaseImageRegistryWhitelist"`
	RunDbDeleter                      bool     `json:"runDbDeleter"`
	ContentServiceAddr                string   `json:"contentServiceAddr"`
	ImageBuilderAddr                  string   `json:"imageBuilderAddr"`
	UsageServiceAddr                  string   `json:"usageServiceAddr"`
	VSXRegistryUrl                    string   `json:"vsxRegistryUrl"`
	ChargebeeProviderOptionsFile      string   `json:"chargebeeProviderOptionsFile"`
	StripeSecretsFile                 string   `json:"stripeSecretsFile"`
	StripeConfigFile                  string   `json:"stripeConfigFile"`
	EnablePayment                     bool     `json:"enablePayment"`

	WorkspaceHeartbeat         WorkspaceHeartbeat         `json:"workspaceHeartbeat"`
	WorkspaceDefaults          WorkspaceDefaults          `json:"workspaceDefaults"`
	Session                    Session                    `json:"session"`
	GitHubApp                  GitHubApp                  `json:"githubApp"`
	WorkspaceGarbageCollection WorkspaceGarbageCollection `json:"workspaceGarbageCollection"`
	AuthProviderConfigFiles    []string                   `json:"authProviderConfigFiles"`
	IncrementalPrebuilds       IncrementalPrebuilds       `json:"incrementalPrebuilds"`
	BlockNewUsers              config.BlockNewUsers       `json:"blockNewUsers"`
	BlockedRepositories        []BlockedRepository        `json:"blockedRepositories,omitempty"`
	OAuthServer                OAuthServer                `json:"oauthServer"`
	RateLimiter                RateLimiter                `json:"rateLimiter"`
	CodeSync                   CodeSync                   `json:"codeSync"`
	// PrebuildLimiter defines the number of prebuilds allowed for each cloneURL in a given 1 minute interval
	// Key of "*" defines the default limit, unless there exists a cloneURL in the map which overrides it.
	PrebuildLimiter  map[string]int   `json:"prebuildLimiter"`
	WorkspaceClasses []WorkspaceClass `json:"workspaceClasses"`
}

type BlockedRepository struct {
	UrlRegExp string `json:"urlRegExp"`
	BlockUser bool   `json:"blockUser"`
}

type CodeSyncResources struct {
	RevLimit int32 `json:"revLimit"`
}

type CodeSync struct {
	RevLimit     int32                        `json:"revLimit"`
	ContentLimit int32                        `json:"contentLimit"`
	Resources    map[string]CodeSyncResources `json:"resources"`
}

type GroupsConfig struct {
	Points       int32 `json:"points"`
	DurationsSec int32 `json:"durationsSec"`
}

type FunctionsConfig struct {
	Group  string `json:"group"`
	Points int32  `json:"points"`
}

type RateLimiter struct {
	Groups    map[string]GroupsConfig    `json:"groups"`
	Functions map[string]FunctionsConfig `json:"functions"`
}

type OAuthServer struct {
	Enabled   bool   `json:"enabled"`
	JWTSecret string `json:"jwtSecret"`
}

type IncrementalPrebuilds struct {
	RepositoryPasslist []string `json:"repositoryPasslist"`
	CommitHistory      int32    `json:"commitHistory"`
}

type WorkspaceGarbageCollection struct {
	Disabled                   bool  `json:"disabled"`
	StartDate                  int32 `json:"startDate"`
	ChunkLimit                 int32 `json:"chunkLimit"`
	MinAgeDays                 int32 `json:"minAgeDays"`
	MinAgePrebuildDays         int32 `json:"minAgePrebuildDays"`
	ContentRetentionPeriodDays int32 `json:"contentRetentionPeriodDays"`
	ContentChunkLimit          int32 `json:"contentChunkLimit"`
}

type GitHubApp struct {
	Enabled         bool   `json:"enabled"`
	AppId           int32  `json:"appId"`
	BaseUrl         string `json:"baseUrl"`
	WebhookSecret   string `json:"webhookSecret"`
	AuthProviderId  string `json:"authProviderId"`
	CertPath        string `json:"certPath"`
	MarketplaceName string `json:"marketplaceName"`
	LogLevel        string `json:"logLevel"`
	CertSecretName  string `json:"certSecretName"`
}

type Session struct {
	MaxAgeMs int32  `json:"maxAgeMs"`
	Secret   string `json:"secret"`
}

type WorkspaceHeartbeat struct {
	IntervalSeconds int32 `json:"intervalSeconds"`
	TimeoutSeconds  int32 `json:"timeoutSeconds"`
}

type WorkspaceDefaults struct {
	WorkspaceImage      string                      `json:"workspaceImage"`
	PreviewFeatureFlags []NamedWorkspaceFeatureFlag `json:"previewFeatureFlags"`
	DefaultFeatureFlags []NamedWorkspaceFeatureFlag `json:"defaultFeatureFlags"`
	TimeoutDefault      *util.Duration              `json:"timeoutDefault,omitempty"`
	TimeoutExtended     *util.Duration              `json:"timeoutExtended,omitempty"`
}

type WorkspaceClass struct {
	Id               string `json:"id"`
	DisplayName      string `json:"displayName"`
	IsDefault        bool   `json:"isDefault"`
	Deprecated       bool   `json:"deprecated"`
	CreditsPerMinute int32  `json:"creditsPerMinute"`
}

type NamedWorkspaceFeatureFlag string

const (
	NamedWorkspaceFeatureFlagFullWorkspaceBackup NamedWorkspaceFeatureFlag = "full_workspace_backup"
	NamedWorkspaceFeatureFlagFixedResources      NamedWorkspaceFeatureFlag = "fixed_resources"
)
