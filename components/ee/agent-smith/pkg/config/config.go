// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/common-go/util"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/resource"
)

func GetConfig(cfgFile string) (*ServiceConfig, error) {
	if cfgFile == "" {
		return nil, xerrors.Errorf("missing --config")
	}

	fc, err := ioutil.ReadFile(cfgFile)
	if err != nil {
		return nil, xerrors.Errorf("cannot read config: %v", err)
	}

	var cfg ServiceConfig
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, xerrors.Errorf("cannot unmarshal config: %v", err)
	}

	if cfg.ProbePath == "" {
		cfg.ProbePath = "/app/probe.o"
	}

	return &cfg, nil
}

// ServiceConfig is the struct holding the configuration for agent-smith
// if you are considering changing this struct, remember
// to update the config schema using:
// $ go run main.go config-schema > config-schema.json
// And also update the examples accordingly.
type ServiceConfig struct {
	Config

	Namespace string `json:"namespace,omitempty"`

	PProfAddr      string `json:"pprofAddr,omitempty"`
	PrometheusAddr string `json:"prometheusAddr,omitempty"`

	// We have had memory leak issues with agent smith in the past due to experimental gRPC use.
	// This upper limit causes agent smith to stop itself should it go above this limit.
	MaxSysMemMib uint64 `json:"systemMemoryLimitMib,omitempty"`

	HostURL        string `json:"hostURL,omitempty"`
	GitpodAPIToken string `json:"gitpodAPIToken,omitempty"`
}

type Enforcement struct {
	Default         *EnforcementRules           `json:"default,omitempty"`
	PerRepo         map[string]EnforcementRules `json:"perRepo,omitempty"`
	CPULimitPenalty string                      `json:"cpuLimitPenalty,omitempty"`
}

// EnforcementRules matches a infringement with a particular penalty
type EnforcementRules map[GradedInfringementKind]PenaltyKind

// Validate returns an error if the enforcement rules are invalid for some reason
func (er EnforcementRules) Validate() error {
	for k := range er {
		if _, err := k.Kind(); err != nil {
			return xerrors.Errorf("%s: %w", k, err)
		}
	}

	validPenalties := map[PenaltyKind]struct{}{
		PenaltyLimitCPU:                  {},
		PenaltyNone:                      {},
		PenaltyStopWorkspace:             {},
		PenaltyStopWorkspaceAndBlockUser: {},
	}
	for _, v := range er {
		if _, ok := validPenalties[v]; !ok {
			return xerrors.Errorf("%s: unknown penalty", v)
		}
	}

	return nil
}

// InfringementKind describes the kind of infringement
type InfringementKind string

const (
	// InfringementExec means a user executed a blocklisted executable
	InfringementExec InfringementKind = "blocklisted executable"
	// InfringementExcessiveEgress means a user produced too much egress traffic
	InfringementExcessiveEgress InfringementKind = "excessive egress"
)

// PenaltyKind describes a kind of penalty for a violating workspace
type PenaltyKind string

const (
	// PenaltyNone means there's no penalty for a particular infringement
	PenaltyNone PenaltyKind = ""
	// PenaltyStopWorkspace stops a workspace hard
	PenaltyStopWorkspace PenaltyKind = "stop workspace"
	// PenaltyLimitCPU permanently limits the CPU a workspace can use
	PenaltyLimitCPU PenaltyKind = "limit CPU"
	// PenaltyLimitCPU permanently limits the CPU a workspace can use
	PenaltyStopWorkspaceAndBlockUser PenaltyKind = "stop workspace and block user"
)

// GradedInfringementKind is a combination of infringement kind and severity
type GradedInfringementKind string

// GradeKind produces a graded infringement kind from severity and kind
func GradeKind(kind InfringementKind, severity common.Severity) GradedInfringementKind {
	if len(severity) == 0 {
		return GradedInfringementKind(kind)
	}
	return GradedInfringementKind(fmt.Sprintf("%s %s", severity, kind))
}

// Severity returns the severity of the graded infringement kind
func (g GradedInfringementKind) Severity() common.Severity {
	for _, pfx := range []common.Severity{common.SeverityBarely, common.SeverityVery} {
		if strings.HasPrefix(string(g), string(pfx)) {
			return pfx
		}
	}

	return common.SeverityAudit
}

// Kind returns the infringement kind
func (g GradedInfringementKind) Kind() (InfringementKind, error) {
	wopfx := strings.TrimSpace(strings.TrimPrefix(string(g), string(g.Severity())))

	validKinds := []InfringementKind{
		InfringementExcessiveEgress,
		InfringementExec,
	}
	for _, k := range validKinds {
		if string(k) == wopfx {
			return k, nil
		}
	}

	return "", xerrors.Errorf("unknown kind")
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
	GitpodAPI           GitpodAPI `json:"gitpodAPI"`
	KubernetesNamespace string    `json:"namespace"`

	Blocklists *Blocklists `json:"blocklists,omitempty"`

	EgressTraffic     *EgressTraffic     `json:"egressTraffic,omitempty"`
	Enforcement       Enforcement        `json:"enforcement,omitempty"`
	ExcessiveCPUCheck *ExcessiveCPUCheck `json:"excessiveCPUCheck,omitempty"`
	SlackWebhooks     *SlackWebhooks     `json:"slackWebhooks,omitempty"`
	Kubernetes        Kubernetes         `json:"kubernetes"`

	ProbePath string `json:"probePath,omitempty"`
}

// Slackwebhooks holds slack notification configuration for different levels of penalty severity
type SlackWebhooks struct {
	Audit   string `json:"audit,omitempty"`
	Warning string `json:"warning,omitempty"`
}

// EgressTraffic configures an upper limit of allowed egress traffic over time
type EgressTraffic struct {
	WindowDuration util.Duration `json:"dt"`

	ExcessiveLevel     *PerLevelEgressTraffic `json:"excessive"`
	VeryExcessiveLevel *PerLevelEgressTraffic `json:"veryExcessive"`
}

// PerLevelEgressTraffic configures the egress traffic threshold per level
type PerLevelEgressTraffic struct {
	BaseBudget resource.Quantity `json:"baseBudget"`
	Threshold  resource.Quantity `json:"perDtThreshold"`
}

// Blocklists list s/signature blocklists for various levels of infringement
type Blocklists struct {
	Barely *PerLevelBlocklist `json:"barely,omitempty"`
	Audit  *PerLevelBlocklist `json:"audit,omitempty"`
	Very   *PerLevelBlocklist `json:"very,omitempty"`
}

func (b *Blocklists) Classifier() (classifier.ProcessClassifier, error) {
	if b == nil {
		return classifier.NewCommandlineClassifier(nil, nil)
	}

	var err error
	res := make(classifier.GradedClassifier)

	res[classifier.LevelAudit], err = b.Audit.Classifier()
	if err != nil {
		return nil, err
	}
	res[classifier.LevelBarely], err = b.Barely.Classifier()
	if err != nil {
		return nil, err
	}
	res[classifier.LevelVery], err = b.Very.Classifier()
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (b *Blocklists) Levels() map[common.Severity]*PerLevelBlocklist {
	res := make(map[common.Severity]*PerLevelBlocklist)
	if b.Barely != nil {
		res[common.SeverityBarely] = b.Barely
	}
	if b.Audit != nil {
		res[common.SeverityAudit] = b.Audit
	}
	if b.Very != nil {
		res[common.SeverityVery] = b.Very
	}
	return res
}

// AllowList configures a list of commands that should not be blocked.
// The command could be the full path to the executable or a regular expression
type AllowList struct {
	Commands []string `json:"commands,omitempty"`
}

// PerLevelBlocklist lists blacklists for level of infringement
type PerLevelBlocklist struct {
	Binaries   []string                `json:"binaries,omitempty"`
	AllowList  []string                `json:"allowlist,omitempty"`
	Signatures []*classifier.Signature `json:"signatures,omitempty"`
}

func (p *PerLevelBlocklist) Classifier() (classifier.ProcessClassifier, error) {
	if p == nil {
		return classifier.CompositeClassifier{}, nil
	}

	cmdl, err := classifier.NewCommandlineClassifier(p.AllowList, p.Binaries)
	if err != nil {
		return nil, err
	}
	sigs := classifier.NewSignatureMatchClassifier(p.Signatures)

	return classifier.CompositeClassifier{cmdl, sigs}, nil
}
