// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

type Enforcement struct {
	Default         *EnforcementRules           `json:"default,omitempty"`
	PerRepo         map[string]EnforcementRules `json:"perRepo,omitempty"`
	CPULimitPenalty string                      `json:"cpuLimitPenalty,omitempty"`
}

type ExcessiveCPUCheck struct {
	Threshold   float32 `json:"threshold"`
	AverageOver int     `json:"averageOverMinutes"`
}

type GitpodAPI struct {
	HostURL  string `json:"hostURL"`
	APIToken string `json:"apiToken"`
}

type Kubernetes struct {
	Enabled    bool   `json:"enabled"`
	Kubeconfig string `json:"kubeconfig,omitempty"`
}

// Config configures Agent Smith
type Config struct {
	GitpodAPI           GitpodAPI          `json:"gitpodAPI"`
	KubernetesNamespace string             `json:"namespace"`
	Blacklists          *Blacklists        `json:"blacklists,omitempty"`
	AllowList           *AllowList         `json:"allowList,omitempty"`
	EgressTraffic       *EgressTraffic     `json:"egressTraffic,omitempty"`
	Enforcement         Enforcement        `json:"enforcement,omitempty"`
	ExcessiveCPUCheck   *ExcessiveCPUCheck `json:"excessiveCPUCheck,omitempty"`
	SlackWebhooks       *SlackWebhooks     `json:"slackWebhooks,omitempty"`
	Kubernetes          Kubernetes         `json:"kubernetes"`

	ProbePath string `json:"probePath,omitempty"`
}
