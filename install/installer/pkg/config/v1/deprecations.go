// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
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
	"experimental.common.podConfig": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.Common.PodConfig
			// Output message as JSON
			o, _ := json.Marshal(val)
			return len(val) > 0, string(o)
		},
		MapValue: func(cfg *Config) error {
			if cfg.Components != nil && cfg.Components.PodConfig != nil {
				return errors.New("cannot set pod config in both components and experimental")
			}
			if cfg.Components == nil {
				cfg.Components = &Components{}
			}
			// Need to convert types - same signature, but using the non-experimental object
			cfg.Components.PodConfig = make(map[string]*PodConfig, 0)
			for k, v := range cfg.Experimental.Common.PodConfig {
				cfg.Components.PodConfig[k] = &PodConfig{
					Replicas:  v.Replicas,
					Resources: v.Resources,
				}
			}
			return nil
		},
	},
	"experimental.ide.resolveLatest": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.IDE.ResolveLatest
			return val != nil, *val
		},
		MapValue: func(cfg *Config) error {
			if cfg.Components != nil && cfg.Components.IDE != nil && cfg.Components.IDE.ResolveLatest != nil {
				return errors.New("cannot set resolve latest ide in both components and experimental")
			}
			if cfg.Components == nil {
				cfg.Components = &Components{}
			}
			if cfg.Components.IDE == nil {
				cfg.Components.IDE = &IDEComponents{}
			}
			cfg.Components.IDE.ResolveLatest = cfg.Experimental.IDE.ResolveLatest
			return nil
		},
	},
	"experimental.ide.ideMetrics.enabledErrorReporting": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.IDE.IDEMetricsConfig
			return val != nil, val.EnabledErrorReporting
		},
		MapValue: func(cfg *Config) error {
			if cfg.Components != nil && cfg.Components.IDE != nil && cfg.Components.IDE.Metrics != nil {
				return errors.New("cannot set ide metrics in both component and experimental")
			}
			if cfg.Components == nil {
				cfg.Components = &Components{}
			}
			if cfg.Components.IDE == nil {
				cfg.Components.IDE = &IDEComponents{}
			}
			if cfg.Components.IDE.Metrics == nil {
				cfg.Components.IDE.Metrics = &IDEMetrics{}
			}
			cfg.Components.IDE.Metrics.ErrorReportingEnabled = cfg.Experimental.IDE.IDEMetricsConfig.EnabledErrorReporting
			return nil
		},
	},
	"experimental.ide.ideProxy.serviceAnnotations": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.IDE.IDEProxyConfig.ServiceAnnotations
			return len(val) > 0, val
		},
		MapValue: func(cfg *Config) error {
			if cfg.Components != nil && cfg.Components.IDE != nil && cfg.Components.IDE.Proxy != nil && len(cfg.Components.IDE.Proxy.ServiceAnnotations) > 0 {
				return errors.New("cannot set ide proxy service annotations in both components and experimental")
			}
			if cfg.Components == nil {
				cfg.Components = &Components{}
			}
			if cfg.Components.IDE == nil {
				cfg.Components.IDE = &IDEComponents{}
			}
			if cfg.Components.IDE.Proxy == nil {
				cfg.Components.IDE.Proxy = &Proxy{}
			}
			cfg.Components.IDE.Proxy.ServiceAnnotations = cfg.Experimental.IDE.IDEProxyConfig.ServiceAnnotations
			return nil
		},
	},
	"experimental.ide.openvsxProxy.serviceAnnotations": {
		Selector: func(cfg *Config) (bool, any) {
			val := cfg.Experimental.IDE.VSXProxyConfig.ServiceAnnotations
			return len(val) > 0, val
		},
		MapValue: func(cfg *Config) error {
			if cfg.OpenVSX.Proxy != nil && len(cfg.OpenVSX.Proxy.ServiceAnnotations) > 0 {
				return errors.New("cannot set openvsx proxy service annotations in both components and experimental")
			}
			if cfg.OpenVSX.Proxy == nil {
				cfg.OpenVSX.Proxy = &OpenVSXProxy{}
			}
			cfg.OpenVSX.Proxy.ServiceAnnotations = cfg.Experimental.IDE.VSXProxyConfig.ServiceAnnotations
			return nil
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
