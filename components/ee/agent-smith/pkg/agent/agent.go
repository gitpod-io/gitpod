// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/cilium/ebpf/perf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/bpf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/bpf/event"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/procfs"
	"golang.org/x/xerrors"

	"k8s.io/apimachinery/pkg/api/resource"
)

const (
	// notificationCacheSize is the history size of notifications we don't want to get notified about again
	notificationCacheSize = 1000
)

type perfHandlerFunc func() (*InfringingWorkspace, error)

// Smith can perform operations within a users workspace and judge a user
type Smith struct {
	Config           Config
	GitpodAPI        gitpod.APIInterface
	EnforcementRules map[string]EnforcementRules
	metrics          *metrics

	notifiedInfringements *lru.Cache
	perfHandler           chan perfHandlerFunc
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

// Blacklists list s/signature blacklists for various levels of infringement
type Blacklists struct {
	Barely *PerLevelBlacklist `json:"barely,omitempty"`
	Audit  *PerLevelBlacklist `json:"audit,omitempty"`
	Very   *PerLevelBlacklist `json:"very,omitempty"`
}

func (b *Blacklists) Levels() map[InfringementSeverity]*PerLevelBlacklist {
	res := make(map[InfringementSeverity]*PerLevelBlacklist)
	if b.Barely != nil {
		res[InfringementSeverityBarely] = b.Barely
	}
	if b.Audit != nil {
		res[InfringementSeverityAudit] = b.Audit
	}
	if b.Very != nil {
		res[InfringementSeverityVery] = b.Very
	}
	return res
}

// PerLevelBlacklist lists blacklists for level of infringement
type PerLevelBlacklist struct {
	Binaries   []string               `json:"binaries,omitempty"`
	Signatures []*signature.Signature `json:"signatures,omitempty"`
}

// Slackwebhooks holds slack notification configuration for different levels of penalty severity
type SlackWebhooks struct {
	Audit   string `json:"audit,omitempty"`
	Warning string `json:"warning,omitempty"`
}

// NewAgentSmith creates a new agent smith
func NewAgentSmith(cfg Config) (*Smith, error) {
	notificationCache, err := lru.New(notificationCacheSize)
	if err != nil {
		return nil, err
	}

	var api gitpod.APIInterface
	if cfg.GitpodAPI.HostURL != "" {
		u, err := url.Parse(cfg.GitpodAPI.HostURL)
		if err != nil {
			return nil, xerrors.Errorf("cannot parse Gitpod API host url: %w", err)
		}
		endpoint := fmt.Sprintf("wss://%s/api/v1", u.Hostname())

		api, err = gitpod.ConnectToServer(endpoint, gitpod.ConnectToServerOpts{
			Context: context.Background(),
			Token:   cfg.GitpodAPI.APIToken,
			Log:     log.Log,
		})
		if err != nil {
			return nil, xerrors.Errorf("cannot connect to Gitpod API: %w", err)
		}
	}

	res := &Smith{
		EnforcementRules: map[string]EnforcementRules{
			defaultRuleset: {
				GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityBarely): PenaltyLimitCPU,
				GradeKind(InfringementHasBlacklistedFile, InfringementSeverityBarely): PenaltyLimitCPU,
				GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityAudit):  PenaltyStopWorkspace,
				GradeKind(InfringementHasBlacklistedFile, InfringementSeverityAudit):  PenaltyStopWorkspace,
				GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityVery):   PenaltyStopWorkspaceAndBlockUser,
				GradeKind(InfringementHasBlacklistedFile, InfringementSeverityVery):   PenaltyStopWorkspaceAndBlockUser,
				GradeKind(InfringementExcessiveEgress, InfringementSeverityVery):      PenaltyStopWorkspace,
			},
		},
		Config:                cfg,
		GitpodAPI:             api,
		notifiedInfringements: notificationCache,
		perfHandler:           make(chan perfHandlerFunc, 10),
		metrics:               newAgentMetrics(),
	}
	if cfg.Enforcement.Default != nil {
		if err := cfg.Enforcement.Default.Validate(); err != nil {
			return nil, err
		}
		res.EnforcementRules[defaultRuleset] = *cfg.Enforcement.Default
	}
	for repo, rules := range cfg.Enforcement.PerRepo {
		if err := rules.Validate(); err != nil {
			return nil, err
		}
		res.EnforcementRules[repo] = rules
	}

	return res, nil
}

// InfringingWorkspace reports a user's wrongdoing in a workspace
type InfringingWorkspace struct {
	SupervisorPID int
	Namespace     string
	Pod           string
	Owner         string
	InstanceID    string
	WorkspaceID   string
	Infringements []Infringement
	GitRemoteURL  []string
}

// VID is an ID unique to this set of infringements
func (ws InfringingWorkspace) VID() string {
	vt := make([]string, len(ws.Infringements))
	for i, v := range ws.Infringements {
		vt[i] = string(v.Kind)
	}
	sort.Slice(vt, func(i, j int) bool { return vt[i] < vt[j] })

	return fmt.Sprintf("%s/%s", ws.Pod, strings.Join(vt, ":"))
}

// DescibeInfringements returns a string representation of all infringements of this workspace
func (ws InfringingWorkspace) DescibeInfringements() string {
	res := make([]string, len(ws.Infringements))
	for i, v := range ws.Infringements {
		res[i] = fmt.Sprintf("%s: %s", v.Kind, v.Description)
	}
	return strings.Join(res, "\n")
}

// Infringement reports a users particular wrongdoing
type Infringement struct {
	Description string
	Kind        GradedInfringementKind
}

// InfringementKind describes the kind of infringement
type InfringementKind string

const (
	// InfringementExecBlacklistedCmd means a user executed a blacklisted command
	InfringementExecBlacklistedCmd InfringementKind = "blacklisted command"
	// InfringementHasBlacklistedFile means a user has a blacklisted file in the workspace
	InfringementHasBlacklistedFile InfringementKind = "blacklisted file"
	// InfringementExcessiveEgress means a user produced too much egress traffic
	InfringementExcessiveEgress InfringementKind = "excessive egress"
	// InfringementVeryExcessiveEgress means a user produced way too much egress traffic
	InfringementVeryExcessiveEgress InfringementKind = "very excessive egress"
	// InfringementExcessiveCPUUse means the user consumes a lot of CPU
	InfringementExcessiveCPUUse InfringementKind = "excessive CPU use"
)

// InfringementSeverity describes the severity of the infringement
type InfringementSeverity string

const (
	// InfringementSeverityBarely is a severity level no action is needed.
	InfringementSeverityBarely InfringementSeverity = "barely"
	// InfringementSeverityAudit is the severity level used when auditting is needed.
	InfringementSeverityAudit InfringementSeverity = ""
	// InfringementSeverityVery is the stronger severity level
	InfringementSeverityVery InfringementSeverity = "very"
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
func GradeKind(kind InfringementKind, severity InfringementSeverity) GradedInfringementKind {
	return GradedInfringementKind(fmt.Sprintf("%s %s", severity, kind))
}

// Severity returns the severity of the graded infringement kind
func (g GradedInfringementKind) Severity() InfringementSeverity {
	for _, pfx := range []InfringementSeverity{InfringementSeverityBarely, InfringementSeverityVery} {
		if strings.HasPrefix(string(g), string(pfx)) {
			return pfx
		}
	}

	return InfringementSeverityAudit
}

// Kind returns the infringement kind
func (g GradedInfringementKind) Kind() (InfringementKind, error) {
	wopfx := strings.TrimSpace(strings.TrimPrefix(string(g), string(g.Severity())))

	validKinds := []InfringementKind{
		InfringementExcessiveCPUUse,
		InfringementExcessiveEgress,
		InfringementExecBlacklistedCmd,
		InfringementHasBlacklistedFile,
	}
	for _, k := range validKinds {
		if string(k) == wopfx {
			return k, nil
		}
	}

	return "", fmt.Errorf("unknown kind")
}

// defaultRuleset is the name ("remote origin URL") of the default enforcement rules
const defaultRuleset = ""

// EnforcementRules matches a infringement with a particular penalty
type EnforcementRules map[GradedInfringementKind]PenaltyKind

// Validate returns an error if the enforcement rules are invalid for some reason
func (er EnforcementRules) Validate() error {
	for k := range er {
		if _, err := k.Kind(); err != nil {
			return fmt.Errorf("%s: %w", k, err)
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
			return fmt.Errorf("%s: unknown penalty", v)
		}
	}

	return nil
}

// Start gets a stream of Infringements from Run and executes a callback on them to apply a Penalty
func (agent *Smith) Start(callback func(InfringingWorkspace, []PenaltyKind)) {
	// todo(fntlnz): do the bpf loading here before running Run so that we have everything sorted out
	abpf, err := bpf.LoadAndAttach(agent.Config.ProbePath)

	if err != nil {
		log.WithError(err).Fatal("error while loading and attaching bpf program")
	}

	defer abpf.Close()

	for i := 0; i < 10; i++ {
		go func(i int) {
			for h := range agent.perfHandler {
				if h == nil {
					continue
				}

				v, err := h()
				if err != nil {
					log.WithError(err).Warn("error while running perf handler")
				}

				// event did not generate an infringement
				if v == nil {
					continue
				}
				ps, err := agent.Penalize(*v)
				if err != nil {
					log.WithError(err).WithField("infringement", v).Warn("error while reacting to infringement")
				}

				alreadyNotified, _ := agent.notifiedInfringements.ContainsOrAdd(v.VID(), nil)
				if alreadyNotified {
					continue
				}
				callback(*v, ps)
			}
		}(i)
	}

	// todo(fntlnz): use a channel to cancel this execution
	for {
		rec, err := abpf.Read()
		if err != nil {
			if perf.IsClosed(err) {
				log.Error("perf buffer is closed")
				return
			}
			log.WithError(err).Error("error reading from event perf buffer")
		}
		agent.processPerfRecord(rec)
	}
}

// Penalize acts on infringements and e.g. stops pods
func (agent *Smith) Penalize(ws InfringingWorkspace) ([]PenaltyKind, error) {
	var remoteURL string
	if len(ws.GitRemoteURL) > 0 {
		remoteURL = ws.GitRemoteURL[0]
	}

	penalty := getPenalty(agent.EnforcementRules[defaultRuleset], agent.EnforcementRules[remoteURL], ws.Infringements)
	for _, p := range penalty {
		switch p {
		case PenaltyStopWorkspace:
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspace(ws.SupervisorPID)
			if err != nil {
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case PenaltyStopWorkspaceAndBlockUser:
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspaceAndBlockUser(ws.SupervisorPID, ws.Owner)
			if err != nil {
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case PenaltyLimitCPU:
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.limitCPUUse(ws.Pod)
			if err != nil {
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		}
	}

	return penalty, nil
}

func findEnforcementRules(rules map[string]EnforcementRules, remoteURL string) EnforcementRules {
	res, ok := rules[remoteURL]
	if ok {
		return res
	}

	for k, v := range rules {
		hp, hs := strings.HasPrefix(k, "*"), strings.HasSuffix(k, "*")
		if hp && hs && strings.Contains(strings.ToLower(remoteURL), strings.Trim(k, "*")) {
			return v
		}
		if hp && strings.HasSuffix(strings.ToLower(remoteURL), strings.Trim(k, "*")) {
			return v
		}
		if hs && strings.HasPrefix(strings.ToLower(remoteURL), strings.Trim(k, "*")) {
			return v
		}
	}

	return nil
}

// getPenalty decides what kind of penalty should be applied for a set of infringements.
// The penalty list will never contain PenaltyNone, but may be empty
func getPenalty(defaultRules, perRepoRules EnforcementRules, vs []Infringement) []PenaltyKind {
	res := make(map[PenaltyKind]struct{})
	for _, v := range vs {
		p, ok := perRepoRules[v.Kind]
		if ok {
			res[p] = struct{}{}
			continue
		}
		p, ok = defaultRules[v.Kind]
		if ok {
			res[p] = struct{}{}
		}
	}

	var ps []PenaltyKind
	for k := range res {
		if k == PenaltyNone {
			continue
		}
		ps = append(ps, k)
	}
	return ps
}

// Run continuously queries the perf event array to determine if there was an
// infringement
func (agent *Smith) processPerfRecord(rec perf.Record) {
	if rec.LostSamples != 0 {
		log.WithField("lost-samples", rec.LostSamples).Warn("event buffer is full, events dropped")
		return
	}

	e, err := event.NewFromPerfRecord(rec)
	if err != nil {
		log.WithError(err).Error("error creating event from perf record")
		return
	}

	res, err := e.Unmarshal()
	if err != nil {
		log.WithError(err).Error("error unmarshaling event")
		return
	}

	handler, err := agent.handleEvent(res)
	if err != nil {
		log.WithError(err).Error("handler not found for event")
		return
	}
	agent.perfHandler <- handler
}

func (agent *Smith) handleEvent(res interface{}) (func() (*InfringingWorkspace, error), error) {
	if res == nil {
		return nil, fmt.Errorf("unable to process nil event")
	}
	switch v := res.(type) {
	case *event.Execve:
		return agent.handleExecveEvent(v), nil
	}

	return func() (*InfringingWorkspace, error) {
		return nil, nil
	}, fmt.Errorf("unable to handle event of unknown type")
}

// handles an execve event checks if it's infringing
func (agent *Smith) handleExecveEvent(execve *event.Execve) func() (*InfringingWorkspace, error) {
	return func() (*InfringingWorkspace, error) {
		if agent.Config.Blacklists == nil {
			return nil, nil
		}

		// Note: mind the order of severity here. We check, hence return very blacklisted command infringements first
		bls := agent.Config.Blacklists.Levels()
		var res []Infringement
		for s, bl := range bls {
			if bl == nil || len(bl.Binaries) == 0 {
				continue
			}

			for _, b := range bl.Binaries {
				if strings.Contains(execve.Filename, b) || strings.Contains(strings.Join(execve.Argv, "|"), b) {
					infr := Infringement{Description: fmt.Sprintf("user ran %s blacklisted command: %s", s, execve.Filename), Kind: GradeKind(InfringementExecBlacklistedCmd, s)}
					res = append(res, infr)
				}
			}
		}

		if len(res) == 0 {
			fd, err := os.Open(filepath.Join("/proc", strconv.Itoa(execve.TID), "exe"))
			if err != nil && !os.IsNotExist(err) {
				log.WithError(err).WithField("path", execve.Filename).Warn("cannot open executable to check signatures")
				return nil, nil
			}
			defer fd.Close()

			for severity, bl := range bls {
				if bl == nil || len(bl.Signatures) == 0 {
					continue
				}

				for _, sig := range bl.Signatures {
					if sig.Domain != signature.DomainProcess {
						continue
					}

					m, err := sig.Matches(fd)
					if err != nil {
						log.WithError(err).WithField("path", execve.Filename).WithField("signature", sig.Name).Warn("cannot check signature")
						continue
					}
					if !m {
						continue
					}

					infr := Infringement{Description: fmt.Sprintf("user ran %s blacklisted command: %s", sig.Name, execve.Filename), Kind: GradeKind(InfringementExecBlacklistedCmd, severity)}
					res = append(res, infr)
				}
			}
		}

		if len(res) == 0 {
			return nil, nil
		}

		ws, err := getWorkspaceFromProcess(execve.TID)
		if err != nil {
			log.WithField("tid", execve.TID).WithError(err).Warn("cannot get workspace details from process")
			ws = &InfringingWorkspace{}
		}
		ws.Infringements = res
		return ws, nil
	}
}

func getWorkspaceFromProcess(tid int) (res *InfringingWorkspace, err error) {
	proc, err := procfs.NewProc(tid)
	if err != nil {
		return nil, err
	}

	parent := func(proc procfs.Proc) (procfs.Proc, error) {
		stat, err := proc.Stat()
		if err != nil {
			return proc, err
		}
		return procfs.NewProc(stat.PPID)
	}

	// We need to get the workspace information from the process itself.
	// To do this, we aim to find the workspacekit process furthest up in the tree.
	var (
		supervisor   procfs.Proc
		workspacekit procfs.Proc
	)
	for ; err == nil; proc, err = parent(proc) {
		sl, err := proc.CmdLine()
		if err != nil {
			log.WithError(err).WithField("pid", proc.PID).Warn("cannot read command slice")
			continue
		}

		if supervisor.PID == 0 && len(sl) == 2 && sl[0] == "supervisor" && sl[1] == "run" {
			supervisor = proc
		} else if supervisor.PID != 0 && len(sl) >= 2 && sl[0] == "/proc/self/exe" && sl[1] == "ring1" {
			workspacekit = proc
			break
		}
	}
	if supervisor.PID == 0 || workspacekit.PID == 0 {
		return nil, fmt.Errorf("did not find supervisor or workspacekit parent")
	}

	env, err := workspacekit.Environ()
	if err != nil {
		return nil, err
	}
	var (
		ownerID, workspaceID, instanceID string
		gitURL                           string
	)
	for _, e := range env {
		if strings.HasPrefix(e, "GITPOD_OWNER_ID=") {
			ownerID = strings.TrimPrefix(e, "GITPOD_OWNER_ID=")
			continue
		}
		if strings.HasPrefix(e, "GITPOD_WORKSPACE_ID=") {
			workspaceID = strings.TrimPrefix(e, "GITPOD_WORKSPACE_ID=")
			continue
		}
		if strings.HasPrefix(e, "GITPOD_INSTANCE_ID=") {
			instanceID = strings.TrimPrefix(e, "GITPOD_INSTANCE_ID=")
			continue
		}
		if strings.HasPrefix(e, "GITPOD_WORKSPACE_CONTEXT_URL=") {
			gitURL = strings.TrimPrefix(e, "GITPOD_WORKSPACE_CONTEXT_URL=")
			continue
		}
	}
	return &InfringingWorkspace{
		SupervisorPID: supervisor.PID,
		Owner:         ownerID,
		WorkspaceID:   workspaceID,
		InstanceID:    instanceID,
		GitRemoteURL:  []string{gitURL},
	}, nil
}

//nolint:deadcode,unused
func mergeInfringingWorkspaces(vws []InfringingWorkspace) (vw InfringingWorkspace) {
	for _, r := range vws {
		if vw.Pod == "" {
			vw.Pod = r.Pod
		}
		if vw.Owner == "" {
			vw.Owner = r.Owner
		}
		if vw.InstanceID == "" {
			vw.InstanceID = r.InstanceID
		}
		if vw.WorkspaceID == "" {
			vw.WorkspaceID = r.WorkspaceID
		}

		// Note: the remote URL list is likekly to be very small hence the O^2 complexity is ok
		//       And just in case the remote URL list isn't small we have a circuit breaker
		if len(r.GitRemoteURL) < 100 && len(vw.GitRemoteURL) < 100 {
			for _, rr := range r.GitRemoteURL {
				var found bool
				for _, vr := range vw.GitRemoteURL {
					if rr == vr {
						found = true
						break
					}
				}
				if !found {
					vw.GitRemoteURL = append(vw.GitRemoteURL, rr)
				}
			}
		} else if len(vw.GitRemoteURL) == 0 {
			vw.GitRemoteURL = r.GitRemoteURL
		}

		vw.Infringements = append(vw.Infringements, r.Infringements...)
	}
	return
}

// RegisterMetrics registers prometheus metrics for this driver
func (agent *Smith) RegisterMetrics(reg prometheus.Registerer) error {
	return agent.metrics.Register(reg)
}
