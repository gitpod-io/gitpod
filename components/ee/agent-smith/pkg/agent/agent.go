// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/cilium/ebpf/perf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/bpf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/procfs"
	"golang.org/x/xerrors"

	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
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
	Kubernetes       kubernetes.Interface
	metrics          *metrics

	notifiedInfringements *lru.Cache
	perfHandler           chan perfHandlerFunc
	pidsMap               syncMapCounter

	egressTrafficCheckHandler func(pid int) (int64, error)
	timeElapsedHandler        func(t time.Time) time.Duration
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

	// establish default CPU limit penalty
	if cfg.Enforcement.CPULimitPenalty == "" {
		cfg.Enforcement.CPULimitPenalty = "500m"
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

	var clientset kubernetes.Interface
	if cfg.Kubernetes.Enabled {
		if cfg.Kubernetes.Kubeconfig != "" {
			res, err := clientcmd.BuildConfigFromFlags("", cfg.Kubernetes.Kubeconfig)
			if err != nil {
				return nil, xerrors.Errorf("cannot connect to kubernetes: %w", err)
			}
			clientset, err = kubernetes.NewForConfig(res)
			if err != nil {
				return nil, xerrors.Errorf("cannot connect to kubernetes: %w", err)
			}
		} else {
			k8s, err := rest.InClusterConfig()
			if err != nil {
				return nil, xerrors.Errorf("cannot connect to kubernetes: %w", err)
			}
			clientset, err = kubernetes.NewForConfig(k8s)
			if err != nil {
				return nil, xerrors.Errorf("cannot connect to kubernetes: %w", err)
			}
		}
	}

	m := newAgentMetrics()
	pidsMap := syncMapCounter{}
	pidsMap.WithCounter(m.currentlyMonitoredPIDS)

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
		Config:                    cfg,
		GitpodAPI:                 api,
		Kubernetes:                clientset,
		notifiedInfringements:     notificationCache,
		perfHandler:               make(chan perfHandlerFunc, 10),
		metrics:                   m,
		egressTrafficCheckHandler: getEgressTraffic,
		timeElapsedHandler:        time.Since,
		pidsMap:                   pidsMap,
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
func (ws InfringingWorkspace) DescribeInfringements(charCount int) string {
	res := make([]string, len(ws.Infringements))
	for i, v := range ws.Infringements {
		res[i] = fmt.Sprintf("%s: %s", v.Kind, v.Description)
	}

	infringements := strings.Join(res, "\n")
	if len(infringements) > charCount {
		infringements = infringements[:charCount]
	}

	return infringements
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
	if len(severity) == 0 {
		return GradedInfringementKind(kind)
	}
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
func (agent *Smith) Start(ctx context.Context, callback func(InfringingWorkspace, []PenaltyKind)) {
	// todo(fntlnz): do the bpf loading here before running Run so that we have everything sorted out
	abpf, err := bpf.LoadAndAttach(agent.Config.ProbePath)

	if err != nil {
		log.WithError(err).Fatal("error while loading and attaching bpf program")
	}

	defer abpf.Close()

	go agent.cleanupDeadPIDS(ctx)

	egressTicker := time.NewTicker(30 * time.Second)

	for i := 0; i < 10; i++ {
		go func(i int) {
			for {
				select {
				case <-egressTicker.C:
					agent.pidsMap.Range(func(key, value interface{}) bool {
						p := key.(int)
						t := value.(time.Time)
						infr, err := agent.checkEgressTrafficCallback(p, t)
						if err != nil {
							return true
						}
						if infr == nil {
							return true
						}
						var res []Infringement
						v, err := getWorkspaceFromProcess(p)
						if err != nil {
							return true
						}
						res = append(res, *infr)
						v.Infringements = res
						ps, err := agent.Penalize(*v)
						if err != nil {
							log.WithError(err).WithField("infringement", v).Warn("error while reacting to infringement")
						}
						alreadyNotified, _ := agent.notifiedInfringements.ContainsOrAdd(v.VID(), nil)
						if alreadyNotified {
							return true
						}
						callback(*v, ps)
						return true
					})
				case h := <-agent.perfHandler:
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
				case <-ctx.Done():
					return
				}
			}
		}(i)
	}

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

func (agent *Smith) cleanupDeadPIDS(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			agent.cleanupDeadPidsCallback()
		case <-ctx.Done():
			return
		}
	}
}

// cleanupDeadPidsCallback removes from pidsMap all the process IDs
// that are not active anymore or don't have a workspace associated
func (agent *Smith) cleanupDeadPidsCallback() {
	agent.pidsMap.Range(func(key, value interface{}) bool {
		p := key.(int)

		process, _ := os.FindProcess(p)
		if process == nil {
			agent.pidsMap.Delete(p)
			return true
		}

		err := process.Signal(syscall.Signal(0))
		if err != nil {
			agent.pidsMap.Delete(p)
			return true
		}

		_, err = getWorkspaceFromProcess(p)
		if err != nil {
			agent.pidsMap.Delete(p)
			return true
		}

		return true
	})
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
	return -1
}

type Execve struct {
	Filename string
	Argv     []string
	TID      int
}

// todo(fntlnz): move this to a package for parsers and write a test
// todo(fntlnz): finish parsing arguments
func parseExecveExit(evtHdr EventHeader, buffer []byte) Execve {
	var i int16
	dataOffsetPtr := unsafe.Sizeof(evtHdr) + unsafe.Sizeof(i)*uintptr(evtHdr.NParams) - 6 // todo(fntlnz): check why this -6 is necessary
	scratchHeaderOffset := uint32(dataOffsetPtr)

	//lint:ignore SA4006 this is used with unsafe.Sizeof
	retval := int64(buffer[scratchHeaderOffset])

	// einfo := bpf.EventTable[bpf.PPME_SYSCALL_EXECVE_19_X]

	scratchHeaderOffset += uint32(unsafe.Sizeof(retval))
	command := buffer[scratchHeaderOffset:]
	commandLen := cStrLen(command)
	command = command[0:commandLen]

	scratchHeaderOffset += uint32(commandLen) + 1
	var argv []string
	rawParams := buffer[scratchHeaderOffset:]
	byteSlice := bytes.Split(rawParams, rawParams[len(rawParams)-1:])
	for _, b := range byteSlice {
		if len(b) == 0 || bytes.HasPrefix(b, []byte("\\x")) {
			break
		}
		if len(b) > 0 {
			argv = append(argv, string(b))
		}
	}

	execve := Execve{
		Filename: string(command[:]),
		Argv:     argv,
		TID:      int(evtHdr.Tid),
	}

	return execve
}

// Run continuously queries the perf event array to determine if there was an
// infringement
func (agent *Smith) processPerfRecord(rec perf.Record) {
	if rec.LostSamples != 0 {
		log.WithField("lost-samples", rec.LostSamples).Warn("event buffer is full, events dropped")
	}

	var evtHdr EventHeader
	if err := binary.Read(bytes.NewBuffer(rec.RawSample), binary.LittleEndian, &evtHdr); err != nil {
		log.WithError(err).Warn("cannot parse perf record")
	}

	switch evtHdr.Type {
	case uint16(bpf.PPME_SYSCALL_EXECVE_19_X):
		execve := parseExecveExit(evtHdr, rec.RawSample)
		agent.perfHandler <- agent.handleExecveEvent(execve)
	}
}

// isSupervisor checks if the execve syscall
// is relative to a supervisor process
// This check must be very fast to avoid blocking the
// reading of the perf buffer so no library have been used
// like prometheus/procfs which reads the whole process tree before
// allowing to read the executable path
// What does it do
// - check if the binary name is supervisor
// - check if it is the actual supervisor we ship in the workspace
func isSupervisor(execve Execve) bool {
	if execve.Filename == "supervisor" {
		exePath := path.Join("/proc", strconv.Itoa(execve.TID), "exe")

		// error checking is skipped because the readlink syscall will not find
		// the destiantion path since its in another mount namespace.
		absPath, _ := os.Readlink(exePath)
		if absPath == "/.supervisor/supervisor" {
			return true
		}
	}
	return false
}

// handles an execve event checks if it's infringing
func (agent *Smith) handleExecveEvent(execve Execve) func() (*InfringingWorkspace, error) {

	if isSupervisor(execve) {
		// this is not the exact process startup time
		// but for the type of comparison we need to do is enough
		agent.pidsMap.Store(execve.TID, time.Now())
	}

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
					infr := Infringement{
						Description: fmt.Sprintf("user ran %s blacklisted command: %s %v", s, execve.Filename, execve.Argv),
						Kind:        GradeKind(InfringementExecBlacklistedCmd, s),
					}
					res = append(res, infr)
				}
			}
		}

		if len(res) == 0 {
			fd, err := os.Open(filepath.Join("/proc", strconv.Itoa(execve.TID), "exe"))
			if err != nil {
				if os.IsNotExist(err) || strings.Contains(err.Error(), "no such process") {
					// This happens often enough to be too spammy in the logs. Thus we use a metric instead.
					// If agent-smith does not work as intended, this metric can be indicative of the reason.
					agent.metrics.signatureCheckMiss.Inc()
				} else {
					log.WithError(err).WithField("path", execve.Filename).Warn("cannot open executable to check signatures")
				}

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
						// We use a metric instead of logging this because this happens very often for a barage of reasons.
						// If agent-smith does not work as intended, this metric can be indicative of the reason.
						agent.metrics.signatureCheckFailures.Inc()
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
			// do not log errors about processes not running.
			if !errors.Is(err, &os.PathError{}) {
				log.WithField("tid", execve.TID).WithError(err).Warn("cannot get workspace details from process")
			}
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

// RegisterMetrics registers prometheus metrics for this driver
func (agent *Smith) RegisterMetrics(reg prometheus.Registerer) error {
	return agent.metrics.Register(reg)
}

func (agent *Smith) checkEgressTrafficCallback(pid int, pidCreationTime time.Time) (*Infringement, error) {
	if agent.Config.EgressTraffic == nil {
		return nil, nil
	}

	podLifetime := agent.timeElapsedHandler(pidCreationTime)
	resp, err := agent.egressTrafficCheckHandler(pid)
	if err != nil {
		return nil, err
	}

	if resp <= 0 {
		log.WithField("total egress bytes", resp).Warn("GetEgressTraffic returned <= 0 value")
		return nil, nil
	}

	type level struct {
		V GradedInfringementKind
		T *PerLevelEgressTraffic
	}
	levels := make([]level, 0, 2)
	if agent.Config.EgressTraffic.VeryExcessiveLevel != nil {
		levels = append(levels, level{V: GradeKind(InfringementExcessiveEgress, InfringementSeverityVery), T: agent.Config.EgressTraffic.VeryExcessiveLevel})
	}
	if agent.Config.EgressTraffic.ExcessiveLevel != nil {
		levels = append(levels, level{V: GradeKind(InfringementExcessiveEgress, InfringementSeverityAudit), T: agent.Config.EgressTraffic.ExcessiveLevel})
	}

	dt := int64(podLifetime / time.Duration(agent.Config.EgressTraffic.WindowDuration))
	for _, lvl := range levels {
		allowance := dt*lvl.T.Threshold.Value() + lvl.T.BaseBudget.Value()
		excess := resp - allowance

		if excess > 0 {
			return &Infringement{Description: fmt.Sprintf("egress traffic is %.3f megabytes over limit", float64(excess)/(1024.0*1024.0)), Kind: lvl.V}, nil
		}
	}

	return nil, nil
}
