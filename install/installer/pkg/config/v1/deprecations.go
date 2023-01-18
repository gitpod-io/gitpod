// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"errors"
)

type deprecatedField struct {
	// Select the deprecated parameter. Returns whether param in use and it's value for the warning message - value should not be a pointer
	Selector func(cfg *Config) (isInUse bool, msgValue any)
	// Map the old value to the new value. If both are set, an error should be returned - this is optional
	MapValue func(cfg *Config) error
}

var deprecatedFields = map[string]deprecatedField{
	"experimental.agentSmith": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.AgentSmith
			return val != nil, val
		},
		MapValue: func(cfg *Config) error {
			if cfg.Components != nil && cfg.Components.AgentSmith != nil {
				return errors.New("cannot configure agent smith in both components and experimental")
			}
			if cfg.Components == nil {
				cfg.Components = &Components{}
			}
			cfg.Components.AgentSmith = cfg.Experimental.AgentSmith
			return nil
		},
	},
	"experimental.common.usePodSecurityPolicies": {
		Selector: func(cfg *Config) (bool, any) {
			usePSPs := cfg.Experimental.Common.UsePodSecurityPolicies
			return usePSPs, usePSPs
		},
	},
	"experimental.webapp.proxy.serviceType": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.WebApp.ProxyConfig.ServiceType
			return val != nil, *val
		},
		MapValue: func(cfg *Config) error {
			if cfg.Components != nil && cfg.Components.Proxy != nil && cfg.Components.Proxy.Service != nil && cfg.Components.Proxy.Service.ServiceType != nil {
				return errors.New("cannot set proxy service type in both components and experimental")
			} else {
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
			return nil
		},
	},
	"experimental.webapp.server.workspaceDefaults.workspaceImage": {
		Selector: func(cfg *Config) (bool, any) {
			workspaceImage := cfg.Experimental.WebApp.Server.WorkspaceDefaults.WorkspaceImage
			return workspaceImage != "", workspaceImage
		},
		MapValue: func(cfg *Config) error {
			if cfg.Workspace.WorkspaceImage != "" {
				return errors.New("cannot set default workspace image in both workspaces and experimental")
			}
			cfg.Workspace.WorkspaceImage = cfg.Experimental.WebApp.Server.WorkspaceDefaults.WorkspaceImage

			return nil
		},
	},
	"experimental.webapp.server.defaultBaseImageRegistryWhitelist": {
		Selector: func(cfg *Config) (bool, any) {
			registryAllowList := cfg.Experimental.WebApp.Server.DefaultBaseImageRegistryWhiteList
			return registryAllowList != nil, registryAllowList
		},
		MapValue: func(cfg *Config) error {
			if len(cfg.ContainerRegistry.PrivateBaseImageAllowList) > 0 {
				return errors.New("cannot set allow list for private base image in both containerRegistry and experimental")
			}
			cfg.ContainerRegistry.PrivateBaseImageAllowList = cfg.Experimental.WebApp.Server.DefaultBaseImageRegistryWhiteList

			return nil
		},
	},
	"experimental.telemetry.data.platform": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.Telemetry.Data.Platform
			return val != "", val
		},
		MapValue: func(cfg *Config) error {
			if cfg.Telemetry != nil && cfg.Telemetry.Data != nil && cfg.Telemetry.Data.Platform != "" {
				return errors.New("cannot set telemetry platform in both telemetry and experimental")
			}
			if cfg.Telemetry == nil {
				cfg.Telemetry = &TelemetryConfig{}
			}
			if cfg.Telemetry.Data == nil {
				cfg.Telemetry.Data = &TelemetryData{}
			}

			cfg.Telemetry.Data.Platform = cfg.Experimental.Telemetry.Data.Platform
			return nil
		},
	},
	"objectStorage.maximumBackupCount": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.ObjectStorage.MaximumBackupCount
			return val != nil, *val
		},
	},
}

// parseDeprecatedSelector recovers from a panic so we don't have to check for nested structs
func parseDeprecatedSelector(cfg *Config, field deprecatedField) (selected bool, val any) {
	defer func() {
		if r := recover(); r != nil {
			selected = false
			val = nil
		}
	}()

	return field.Selector(cfg)
}
