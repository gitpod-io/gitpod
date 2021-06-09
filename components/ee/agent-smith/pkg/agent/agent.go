// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"unsafe"

	"github.com/cilium/ebpf/perf"
	"github.com/davecgh/go-spew/spew"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/bpf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"

	"k8s.io/apimachinery/pkg/api/resource"
)

const (
	// notificationCacheSize is the history size of notifications we don't want to get notified about again
	notificationCacheSize = 1000
)

// Smith can perform operations within a users workspace and judge a user
type Smith struct {
	Config           Config
	GitpodAPI        gitpod.APIInterface
	EnforcementRules map[string]EnforcementRules
	metrics          *metrics

	notifiedInfringements *lru.Cache
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
				GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityAudit):  PenaltyStopWorkspaceAndBlockUser,
				GradeKind(InfringementHasBlacklistedFile, InfringementSeverityAudit):  PenaltyStopWorkspaceAndBlockUser,
				GradeKind(InfringementExcessiveEgress, InfringementSeverityVery):      PenaltyStopWorkspace,
			},
		},
		Config:                cfg,
		GitpodAPI:             api,
		notifiedInfringements: notificationCache,
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
		v := agent.Run(rec)

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
			err := agent.stopWorkspace(ws.Pod)
			if err != nil {
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case PenaltyStopWorkspaceAndBlockUser:
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspaceAndBlockUser(ws.Pod, ws.Owner)
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

// Event is the Go representation of ppm_event_hdr
type EventHeader struct {
	Ts      uint64 /* timestamp, in nanoseconds from epoch */
	Tid     uint64 /* the tid of the thread that generated this event */
	Len     uint32 /* the event len, including the header */
	Type    uint16 /* the event type */
	NParams uint32 /* the number of parameters of the event */
}

func cStrLen(n []byte) int {
	for i := 0; i < len(n); i++ {
		if n[i] == 0 {
			return i
		}
	}
	return len(n)
}

type Execve struct {
	Filename string
	Argv     []string
	Envp     []string
}

// todo(fntlnz): move this to a package for parsers and write a test
// todo(fntlnz): finish parsing arguments
func parseExecveExit(evtHdr EventHeader, buffer []byte) *Execve {
	var i int16
	dataOffsetPtr := unsafe.Sizeof(evtHdr) + unsafe.Sizeof(i)*uintptr(evtHdr.NParams) - 6 // todo(fntlnz): check why this -6 is necessary
	scratchHeaderOffset := uint32(dataOffsetPtr)

	retval := int64(buffer[scratchHeaderOffset])

	// einfo := bpf.EventTable[bpf.PPME_SYSCALL_EXECVE_19_X]
	// einfo.Params[0].

	scratchHeaderOffset += uint32(unsafe.Sizeof(retval))
	spew.Dump(scratchHeaderOffset)
	command := buffer[scratchHeaderOffset:]
	commandLen := cStrLen(command)
	command = command[0:commandLen]

	scratchHeaderOffset += uint32(commandLen) + 1
	argv := buffer[scratchHeaderOffset:]
	argv = argv[0:cStrLen(argv)]
	spew.Dump(argv)

	execve := &Execve{
		Filename: string(command[:]),
	}

	spew.Dump(execve)

	return execve
}

// Run continuously queries the perf event array to determine if there was an
// infringement
func (agent *Smith) Run(rec perf.Record) *InfringingWorkspace {
	if rec.LostSamples != 0 {
		log.WithField("lost-samples", rec.LostSamples).Warn("event buffer is full, events dropped")
	}

	var evtHdr EventHeader
	if err := binary.Read(bytes.NewBuffer(rec.RawSample), binary.LittleEndian, &evtHdr); err != nil {
		log.Printf("parsing perf event: %s", err)
		return nil
	}

	switch evtHdr.Type {
	case uint16(bpf.PPME_SYSCALL_EXECVE_19_X):
		parseExecveExit(evtHdr, rec.RawSample)
	default:
		return nil
	}
	return &InfringingWorkspace{
		Pod:           "test-lore",
		Owner:         "lore",
		InstanceID:    "",
		WorkspaceID:   "",
		Infringements: []Infringement{},
		GitRemoteURL:  []string{},
	}
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
