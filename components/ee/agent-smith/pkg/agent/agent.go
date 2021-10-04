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
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/bpf"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	lru "github.com/hashicorp/golang-lru"
	"github.com/prometheus/client_golang/prometheus"
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

type policeFunc func() (*InfringingWorkspace, error)

// Smith can perform operations within a users workspace and judge a user
type Smith struct {
	Config           Config
	GitpodAPI        gitpod.APIInterface
	EnforcementRules map[string]EnforcementRules
	Kubernetes       kubernetes.Interface
	Runtime          container.Runtime
	metrics          *metrics

	notifiedInfringements *lru.Cache
	policeQueue           chan policeFunc

	egressTrafficCheckHandler func(pid int) (int64, error)
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

type Container struct {
	// Runtime marks the container runtime we ought to connect to.
	// Depending on the value set here we expect the corresponding config struct to have a value.
	Runtime container.RuntimeType `json:"runtime"`

	// Containerd contains the containerd CRI config if runtime == RuntimeContainerd
	Containerd *container.ContainerdConfig `json:"containerd,omitempty"`
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

	var runtime container.Runtime
	if cfg.Container != nil {
		runtime, err = container.NewContainerd(cfg.Container.Containerd, nil, make(map[string]string))
		if err != nil {
			return nil, xerrors.Errorf("cannot connect to containerd: %w", err)
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
		Runtime:                   runtime,
		notifiedInfringements:     notificationCache,
		policeQueue:               make(chan policeFunc, 10),
		metrics:                   m,
		egressTrafficCheckHandler: getEgressTraffic,
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

	return "", xerrors.Errorf("unknown kind")
}

// defaultRuleset is the name ("remote origin URL") of the default enforcement rules
const defaultRuleset = ""

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

// Start gets a stream of Infringements from Run and executes a callback on them to apply a Penalty
func (agent *Smith) Start(ctx context.Context, callback func(InfringingWorkspace, []PenaltyKind)) {
	// todo(fntlnz): do the bpf loading here before running Run so that we have everything sorted out
	abpf, err := bpf.LoadAndAttach(agent.Config.ProbePath)
	if err != nil {
		log.WithError(err).Fatal("error while loading and attaching bpf program")
	}
	defer abpf.Close()

	egressCheckFactor := 6
	psScanTicker := time.NewTicker(5 * time.Second)

	for i := 0; i < 10; i++ {
		go func(i int) {
			for {
				select {
				case s := <-agent.policeQueue:
					if s == nil {
						continue
					}

					v, err := s()
					if err != nil {
						log.WithError(err).Warn("error while scanning process/checking egress")
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

	var scanCounter int
	for {
		select {
		case <-ctx.Done():
			log.Info("agent stopped")
			break
		case <-psScanTicker.C:
			scanCounter++
			err := agent.scanPs(ctx, scanCounter%egressCheckFactor == 0)
			if err != nil {
				log.WithError(err).Error("error scanning ps in workspaces")
			}
			continue
		}
	}
}

func (agent *Smith) scanPs(ctx context.Context, triggerEgressCheck bool) error {
	if agent.Config.Container == nil {
		return nil
	}

	// get list of workspace containers from containerd
	wss, err := agent.Runtime.ListWorkspaceContainers(ctx)
	if err != nil {
		return err
	}

	// run psm and parse a ProcessMap
	psm, err := RunPs()
	if err != nil {
		return err
	}

	// send actual scan closure over to scanProcessQueue
	for _, ws := range wss {
		if ws.WorkspaceType == "ghost" {
			continue
		}

		log.WithFields(log.OWI(ws.OwnerID, ws.WorkspaceID, ws.InstanceID)).Debugf("scanning workspace")

		// processes
		childProcesses := psm.ListAllChildren(ws.PID)
		for _, p := range childProcesses {
			agent.policeQueue <- agent.scanProcess(p, psm, ws)
		}

		// egress
		if triggerEgressCheck {
			supervisor := psm.FindSupervisorForRootProcess(ws.PID)
			if supervisor == nil {
				continue
			}
			agent.policeQueue <- agent.checkEgress(supervisor, psm, ws)
		}
	}

	return nil
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

// checkEgress check whether a given workspace used more egress than it shouled
func (agent *Smith) checkEgress(supervisor *Process, m *ProcessMap, wsInfo *container.WorkspaceContainerInfo) func() (*InfringingWorkspace, error) {
	return func() (*InfringingWorkspace, error) {
		infr, err := agent.checkEgressTrafficCallback(supervisor, supervisor.ElapsedTime())
		if err != nil {
			return nil, err
		}
		if infr == nil {
			return nil, err
		}

		ws := workspaceInfoToInfringingWorkspace(wsInfo, supervisor)
		ws.Infringements = []Infringement{*infr}
		return ws, nil
	}
}

// handles an execve event checks if it's infringing
func (agent *Smith) scanProcess(p *Process, m *ProcessMap, wsInfo *container.WorkspaceContainerInfo) func() (*InfringingWorkspace, error) {

	return func() (*InfringingWorkspace, error) {
		if agent.Config.Blacklists == nil {
			return nil, nil
		}
		log := log.WithFields(log.OWI(wsInfo.OwnerID, wsInfo.WorkspaceID, wsInfo.InstanceID))

		// Note: mind the order of severity here. We check, hence return very blacklisted command infringements first
		bls := agent.Config.Blacklists.Levels()
		var res []Infringement
		for s, bl := range bls {
			if bl == nil || len(bl.Binaries) == 0 {
				continue
			}

			for _, b := range bl.Binaries {
				if strings.Contains(p.Filename, b) || strings.Contains(p.Args, b) {
					infr := Infringement{
						Description: fmt.Sprintf("user ran %s blacklisted command: %s %s", s, p.Filename, p.Args),
						Kind:        GradeKind(InfringementExecBlacklistedCmd, s),
					}
					res = append(res, infr)
				}
			}
		}

		if len(res) == 0 {
			fd, err := os.Open(filepath.Join("/proc", strconv.FormatUint(p.PID, 10), "exe"))
			if err != nil {
				if os.IsNotExist(err) || strings.Contains(err.Error(), "no such process") {
					// This happens often enough to be too spammy in the logs. Thus we use a metric instead.
					// If agent-smith does not work as intended, this metric can be indicative of the reason.
					agent.metrics.signatureCheckMiss.Inc()
				} else {
					log.WithError(err).WithField("path", p.Filename).Warn("cannot open executable to check signatures")
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

					infr := Infringement{Description: fmt.Sprintf("user ran %s blacklisted command: %s", sig.Name, p.Filename), Kind: GradeKind(InfringementExecBlacklistedCmd, severity)}
					res = append(res, infr)
				}
			}
		}

		if len(res) == 0 {
			return nil, nil
		}

		supervisor := m.FindSupervisorForChild(p.PID)
		ws := workspaceInfoToInfringingWorkspace(wsInfo, supervisor)
		ws.Infringements = res
		return ws, nil
	}
}

func workspaceInfoToInfringingWorkspace(wsInfo *container.WorkspaceContainerInfo, supervisor *Process) *InfringingWorkspace {
	ws := &InfringingWorkspace{
		SupervisorPID: int(supervisor.PID),
		Owner:         wsInfo.OwnerID,
		WorkspaceID:   wsInfo.WorkspaceID,
		InstanceID:    wsInfo.InstanceID,
		GitRemoteURL:  []string{"todo"},
	}
	if supervisor == nil {
		log.WithField("pid", supervisor.PID).Warn("cannot find supervisor PID for workspace")
	} else {
		ws.SupervisorPID = int(supervisor.PID)
	}
	return ws
}

// RegisterMetrics registers prometheus metrics for this driver
func (agent *Smith) RegisterMetrics(reg prometheus.Registerer) error {
	return agent.metrics.Register(reg)
}

func (agent *Smith) checkEgressTrafficCallback(p *Process, podLifetime time.Duration) (*Infringement, error) {
	if agent.Config.EgressTraffic == nil {
		return nil, nil
	}

	resp, err := agent.egressTrafficCheckHandler(int(p.PID))
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
