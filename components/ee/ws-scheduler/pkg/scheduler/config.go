// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	validation "github.com/go-ozzo/ozzo-validation"
)

// Configuration is the configuration of ws-scheduler
type Configuration struct {
	// SchedulerName is the name of this scheduler - pods need to have the scheduler name configured to be scheduled by us
	SchedulerName string `json:"schedulerName"`
	// Namespace we listen for pods to schedule in
	// Technically, the pods namespace is irrelevant to the scheduler: it does not assign namespaces nor does it operate on namespaced objects.
	// This only for being able to deploy multiple schedulers into the same cluster without having them interfer with each other.
	Namespace string `json:"namespace"`
	// NodeLabelSelector is the selector thrown at Kubernetes to return the nodes that are meant for scheduling workspaces on
	NodeLabelSelector map[string]string `json:"nodeLabelSelector"`
	// StrategyName is the name of the strategy to use
	StrategyName StrategyName `json:"strategyName"`
	// DensityAndExperienceConfig is the (optional) config for the DensityAndExperience strategy
	DensityAndExperienceConfig *DensityAndExperienceConfig `json:"densityAndExperienceConfig,omitempty"`
	// RAMSafetyBuffer reduces the amount of available RAM per node and is meant to make sure we do not overbook nodes
	RAMSafetyBuffer string `json:"ramSafetyBuffer,omitempty"`
	// RateLimit configures the scheduling rate limit. Optional to ease deployment problems.
	RateLimit *RateLimitConfig `json:"rateLimit,omitempty"`
}

// DensityAndExperienceConfig is the config for the DensityAndExperience strategy
type DensityAndExperienceConfig struct {
	WorkspaceFreshPeriodSeconds int `json:"workspaceFreshPeriodSeconds"`
	NodeFreshWorkspaceLimit     int `json:"nodeFreshWorkspaceLimit"`
}

type RateLimitConfig struct {
	MaxRPS uint `json:"maxRPS"`
}

// DefaultDensityAndExperienceConfig creates the config with default values
func DefaultDensityAndExperienceConfig() *DensityAndExperienceConfig {
	return &DensityAndExperienceConfig{
		WorkspaceFreshPeriodSeconds: 120,
		NodeFreshWorkspaceLimit:     2,
	}
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *Configuration) Validate() error {
	err := validation.ValidateStruct(c)
	return err
}
