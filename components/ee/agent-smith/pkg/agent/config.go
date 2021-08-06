// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

// Config configures Agent Smith
type Config struct {
	GitpodAPI struct {
		HostURL  string `json:"hostURL"`
		APIToken string `json:"apiToken"`
	} `json:"gitpodAPI"`
	KubernetesNamespace string         `json:"namespace"`
	Blacklists          *Blacklists    `json:"blacklists,omitempty"`
	EgressTraffic       *EgressTraffic `json:"egressTraffic,omitempty"`
	Enforcement         struct {
		Default         *EnforcementRules           `json:"default,omitempty"`
		PerRepo         map[string]EnforcementRules `json:"perRepo,omitempty"`
		CPULimitPenalty string                      `json:"cpuLimitPenalty,omitempty"`
	} `json:"enforcement,omitempty"`
	ExcessiveCPUCheck *struct {
		Threshold   float32 `json:"threshold"`
		AverageOver int     `json:"averageOverMinutes"`
	} `json:"excessiveCPUCheck,omitempty"`
	SlackWebhooks *SlackWebhooks `json:"slackWebhooks,omitempty"`
	Kubernetes    struct {
		Enabled    bool   `json:"enabled"`
		Kubeconfig string `json:"kubeconfig,omitempty"`
	} `json:"kubernetes"`

	ProbePath string `json:"probePath,omitempty"`
}
