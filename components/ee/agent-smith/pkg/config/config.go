// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"golang.org/x/xerrors"
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
	WorkspaceManager    WorkspaceManagerConfig `json:"wsman"`
	GitpodAPI           GitpodAPI              `json:"gitpodAPI"`
	KubernetesNamespace string                 `json:"namespace"`

	Blocklists *Blocklists `json:"blocklists,omitempty"`

	Enforcement        Enforcement         `json:"enforcement,omitempty"`
	ExcessiveCPUCheck  *ExcessiveCPUCheck  `json:"excessiveCPUCheck,omitempty"`
	Kubernetes         Kubernetes          `json:"kubernetes"`
	FilesystemScanning *FilesystemScanning `json:"filesystemScanning,omitempty"`

	ProbePath string `json:"probePath,omitempty"`
}

type TLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

type WorkspaceManagerConfig struct {
	Address string `json:"address"`
	TLS     TLS    `json:"tls,omitempty"`
}

// FilesystemScanning configures filesystem signature scanning
type FilesystemScanning struct {
	Enabled      bool     `json:"enabled"`
	ScanInterval Duration `json:"scanInterval"`
	MaxFileSize  int64    `json:"maxFileSize"`
	WorkingArea  string   `json:"workingArea"`
}

// Duration wraps time.Duration to provide JSON marshaling/unmarshaling
type Duration struct {
	time.Duration
}

// UnmarshalJSON implements json.Unmarshaler interface
func (d *Duration) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	duration, err := time.ParseDuration(s)
	if err != nil {
		return err
	}

	d.Duration = duration
	return nil
}

// MarshalJSON implements json.Marshaler interface
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.Duration.String())
}

// Slackwebhooks holds slack notification configuration for different levels of penalty severity
type SlackWebhooks struct {
	Audit   string `json:"audit,omitempty"`
	Warning string `json:"warning,omitempty"`
}

// Blocklists list s/signature blocklists for various levels of infringement
type Blocklists struct {
	Barely *PerLevelBlocklist `json:"barely,omitempty"`
	Audit  *PerLevelBlocklist `json:"audit,omitempty"`
	Very   *PerLevelBlocklist `json:"very,omitempty"`
}

func (b *Blocklists) Classifier() (res classifier.ProcessClassifier, err error) {
	defer func() {
		if res == nil {
			return
		}
		res = classifier.NewCountingMetricsClassifier("all", res)
	}()

	if b == nil {
		return classifier.NewCommandlineClassifier("empty", classifier.LevelAudit, nil, nil)
	}

	gres := make(classifier.GradedClassifier)
	for level, bl := range b.Levels() {
		lvl := classifier.Level(level)
		gres[lvl], err = bl.Classifier(string(level), lvl)
		if err != nil {
			return nil, err
		}
	}
	return gres, nil
}

// FileClassifier creates a classifier specifically for filesystem scanning
// This extracts only filesystem signatures from all blocklist levels and creates
// a clean classifier without any CountingMetricsClassifier wrapper
func (b *Blocklists) FileClassifier() (classifier.FileClassifier, error) {
	if b == nil {
		// Return a classifier with no signatures - will match nothing
		return classifier.NewSignatureMatchClassifier("filesystem-empty", classifier.LevelAudit, nil), nil
	}

	// Collect all filesystem signatures from all levels
	var allFilesystemSignatures []*classifier.Signature

	for _, bl := range b.Levels() {
		if bl == nil || bl.Signatures == nil {
			continue
		}

		for _, sig := range bl.Signatures {
			if sig.Domain == classifier.DomainFileSystem {
				fsSig := &classifier.Signature{
					Name:     sig.Name,
					Domain:   sig.Domain,
					Pattern:  sig.Pattern,
					Filename: sig.Filename,
					Regexp:   sig.Regexp,
				}
				allFilesystemSignatures = append(allFilesystemSignatures, fsSig)
			}
		}
	}

	// Create a single SignatureMatchClassifier with all filesystem signatures
	// Use LevelAudit as default - individual signatures can still have their own severity
	return classifier.NewSignatureMatchClassifier("filesystem", classifier.LevelAudit, allFilesystemSignatures), nil
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

func (p *PerLevelBlocklist) Classifier(name string, level classifier.Level) (classifier.ProcessClassifier, error) {
	if p == nil {
		return classifier.CompositeClassifier{}, nil
	}

	cmdl, err := classifier.NewCommandlineClassifier(name, level, p.AllowList, p.Binaries)
	if err != nil {
		return nil, err
	}
	cmdlc := classifier.NewCountingMetricsClassifier("cmd_"+name, cmdl)

	sigsc := classifier.NewCountingMetricsClassifier("sig_"+name,
		classifier.NewSignatureMatchClassifier(name, level, p.Signatures),
	)

	return classifier.CompositeClassifier{cmdlc, sigsc}, nil
}
