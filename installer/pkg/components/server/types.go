// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import "github.com/gitpod-io/gitpod/installer/pkg/config/v1"

// These types are from TypeScript files

// ConfigSerialized interface from components/server/src/config.ts
type ConfigSerialized struct {
	Version                           string   `json:"version"`
	HostURL                           string   `json:"hostUrl"`
	InstallationShortname             string   `json:"installationShortname"`
	Stage                             string   `json:"stage"`
	DevBranch                         string   `json:"devBranch"`
	InsecureNoDomain                  bool     `json:"insecureNoDomain"`
	License                           string   `json:"license"`
	LicenseFile                       string   `json:"licenseFile"`
	DefinitelyGpDisabled              bool     `json:"definitelyGpDisabled"`
	EnableLocalApp                    bool     `json:"enableLocalApp"`
	BuiltinAuthProvidersConfigured    bool     `json:"builtinAuthProvidersConfigured"`
	DisableDynamicAuthProviderLogin   bool     `json:"disableDynamicAuthProviderLogin"`
	MaxEnvvarPerUserCount             int32    `json:"maxEnvvarPerUserCount"`
	MaxConcurrentPrebuildsPerRef      int32    `json:"maxConcurrentPrebuildsPerRef"`
	MakeNewUsersAdmin                 bool     `json:"makeNewUsersAdmin"`
	TheiaPluginsBucketNameOverride    string   `json:"theiaPluginsBucketNameOverride"`
	DefaultBaseImageRegistryWhitelist []string `json:"defaultBaseImageRegistryWhitelist"`
	RunDbDeleter                      bool     `json:"runDbDeleter"`
	ContentServiceAddr                string   `json:"contentServiceAddr"`
	ImageBuilderAddr                  string   `json:"imageBuilderAddr"`
	VSXRegistryUrl                    string   `json:"vsxRegistryUrl"`
	ChargebeeProviderOptionsFile      string   `json:"chargebeeProviderOptionsFile"`
	EnablePayment                     bool     `json:"enablePayment"`

	WorkspaceHeartbeat         WorkspaceHeartbeat           `json:"workspaceHeartbeat"`
	WorkspaceDefaults          WorkspaceDefaults            `json:"workspaceDefaults"`
	Session                    Session                      `json:"session"`
	GitHubApp                  GitHubApp                    `json:"githubApp"`
	WorkspaceGarbageCollection WorkspaceGarbageCollection   `json:"workspaceGarbageCollection"`
	AuthProviderConfigs        []config.AuthProviderConfigs `json:"authProviderConfigs"`
	BrandingConfig             BrandingConfig               `json:"brandingConfig"`
	IncrementalPrebuilds       IncrementalPrebuilds         `json:"incrementalPrebuilds"`
	BlockNewUsers              config.BlockNewUsers         `json:"blockNewUsers"`
	OAuthServer                OAuthServer                  `json:"oauthServer"`
	RateLimiter                RateLimiter                  `json:"rateLimiter"`
	CodeSync                   CodeSync                     `json:"codeSync"`
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

type Link struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type SocialLink struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

type IDE struct {
	Logo             string `json:"logo"`
	ShowReleaseNotes bool   `json:"showReleaseNotes"`
	HelpMenu         []Link `json:"helpMenu"`
}

type BrandingLinks struct {
	Header []Link       `json:"header"`
	Footer []Link       `json:"footer"`
	Social []SocialLink `json:"social"`
	Legal  []Link       `json:"legal"`
}

type BrandingConfig struct {
	Name                          string        `json:"name"`
	Favicon                       string        `json:"favicon"`
	Logo                          string        `json:"logo"`
	StartupLogo                   string        `json:"startupLogo"`
	ShowProductivityTips          bool          `json:"showProductivityTips"`
	RedirectUrlIfNotAuthenticated string        `json:"redirectUrlIfNotAuthenticated"`
	RedirectUrlAfterLogout        string        `json:"redirectUrlAfterLogout"`
	Homepage                      string        `json:"homepage"`
	IDE                           IDE           `json:"ide"`
	Links                         BrandingLinks `json:"links"`
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
}

type NamedWorkspaceFeatureFlag string

const (
	NamedWorkspaceFeatureFlagFullWorkspaceBackup NamedWorkspaceFeatureFlag = "full_workspace_backup"
	NamedWorkspaceFeatureFlagFixedResources      NamedWorkspaceFeatureFlag = "fixed_resources"
)
