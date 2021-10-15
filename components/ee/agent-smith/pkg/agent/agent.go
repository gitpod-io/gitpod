// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/detector"
	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/utils/lru"
)

const (
	// notificationCacheSize is the history size of notifications we don't want to get notified about again
	notificationCacheSize = 1000
)

// Smith can perform operations within a users workspace and judge a user
type Smith struct {
	Config           config.Config
	GitpodAPI        gitpod.APIInterface
	EnforcementRules map[string]config.EnforcementRules
	Kubernetes       kubernetes.Interface
	metrics          *metrics

	egressTrafficCheckHandler func(pid int) (int64, error)
	timeElapsedHandler        func(t time.Time) time.Duration
	notifiedInfringements     *lru.Cache

	detector   detector.ProcessDetector
	classifier classifier.ProcessClassifier
}

// NewAgentSmith creates a new agent smith
func NewAgentSmith(cfg config.Config) (*Smith, error) {
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

	detec, err := detector.NewProcfsDetector()
	if err != nil {
		return nil, err
	}

	class, err := cfg.Blocklists.Classifier()
	if err != nil {
		return nil, err
	}

	m := newAgentMetrics()
	res := &Smith{
		EnforcementRules: map[string]config.EnforcementRules{
			defaultRuleset: {
				config.GradeKind(config.InfringementExec, common.SeverityBarely):          config.PenaltyLimitCPU,
				config.GradeKind(config.InfringementExec, common.SeverityAudit):           config.PenaltyStopWorkspace,
				config.GradeKind(config.InfringementExec, common.SeverityVery):            config.PenaltyStopWorkspaceAndBlockUser,
				config.GradeKind(config.InfringementExcessiveEgress, common.SeverityVery): config.PenaltyStopWorkspace,
			},
		},
		Config:     cfg,
		GitpodAPI:  api,
		Kubernetes: clientset,

		detector:   detec,
		classifier: class,

		notifiedInfringements:     lru.New(notificationCacheSize),
		metrics:                   m,
		egressTrafficCheckHandler: getEgressTraffic,
		timeElapsedHandler:        time.Since,
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
	Kind        config.GradedInfringementKind
}

// defaultRuleset is the name ("remote origin URL") of the default enforcement rules
const defaultRuleset = ""

// Start gets a stream of Infringements from Run and executes a callback on them to apply a Penalty
func (agent *Smith) Start(ctx context.Context, callback func(InfringingWorkspace, []config.PenaltyKind)) {
	ps, err := agent.detector.DiscoverProcesses(ctx)
	if err != nil {
		log.WithError(err).Fatal("cannot start process detector")
	}

	type classifiedProcess struct {
		P   detector.Process
		C   *classifier.Classification
		Err error
	}
	var (
		wg  sync.WaitGroup
		cli = make(chan detector.Process, 200)
		clo = make(chan classifiedProcess, 20)
	)
	defer wg.Wait()
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			agent.metrics.classificationBackpressureInCount.Set(float64(len(cli)))
			agent.metrics.classificationBackpressureOutCount.Set(float64(len(clo)))
			defer wg.Done()
			for i := range cli {
				class, err := agent.classifier.Matches(i.Path, i.CommandLine)
				clo <- classifiedProcess{P: i, C: class, Err: err}
			}
		}()
	}

	defer log.Info("agent smith main loop ended")

	for {
		select {
		case <-ctx.Done():
			return
		case proc, ok := <-ps:
			if !ok {
				return
			}
			cli <- proc
		case class := <-clo:
			proc, cl, err := class.P, class.C, class.Err
			if err != nil {
				log.WithError(err).WithFields(log.OWI(proc.Workspace.OwnerID, proc.Workspace.WorkspaceID, proc.Workspace.InstanceID)).WithField("path", proc.Path).Error("cannot classify process")
				continue
			}
			if cl == nil || cl.Level == classifier.LevelNoMatch {
				continue
			}

			agent.Penalize(InfringingWorkspace{
				SupervisorPID: proc.Workspace.PID,
				Owner:         proc.Workspace.OwnerID,
				InstanceID:    proc.Workspace.InstanceID,
				GitRemoteURL:  []string{proc.Workspace.GitURL},
				Infringements: []Infringement{
					{Kind: config.GradeKind(config.InfringementExec, common.Severity(cl.Level)), Description: fmt.Sprintf("%s: %s", cl.Classifier, cl.Message)},
				},
			})
		}
	}
}

// Penalize acts on infringements and e.g. stops pods
func (agent *Smith) Penalize(ws InfringingWorkspace) ([]config.PenaltyKind, error) {
	var remoteURL string
	if len(ws.GitRemoteURL) > 0 {
		remoteURL = ws.GitRemoteURL[0]
	}

	owi := log.OWI(ws.Owner, ws.WorkspaceID, ws.InstanceID)

	penalty := getPenalty(agent.EnforcementRules[defaultRuleset], agent.EnforcementRules[remoteURL], ws.Infringements)
	for _, p := range penalty {
		switch p {
		case config.PenaltyStopWorkspace:
			log.WithField("infringement", ws.Infringements).WithFields(owi).Info("stopping workspace")
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspace(ws.SupervisorPID)
			if err != nil {
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case config.PenaltyStopWorkspaceAndBlockUser:
			log.WithField("infringement", ws.Infringements).WithFields(owi).Info("stopping workspace and blocking user")
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspaceAndBlockUser(ws.SupervisorPID, ws.Owner)
			if err != nil {
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case config.PenaltyLimitCPU:
			log.WithField("infringement", ws.Infringements).WithFields(owi).Info("limiting CPU")
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

func findEnforcementRules(rules map[string]config.EnforcementRules, remoteURL string) config.EnforcementRules {
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
func getPenalty(defaultRules, perRepoRules config.EnforcementRules, vs []Infringement) []config.PenaltyKind {
	res := make(map[config.PenaltyKind]struct{})
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

	var ps []config.PenaltyKind
	for k := range res {
		if k == config.PenaltyNone {
			continue
		}
		ps = append(ps, k)
	}
	return ps
}

func (agent *Smith) Describe(d chan<- *prometheus.Desc) {
	agent.metrics.Describe(d)
	agent.classifier.Describe(d)
	agent.detector.Describe(d)
}

func (agent *Smith) Collect(m chan<- prometheus.Metric) {
	agent.metrics.Collect(m)
	agent.classifier.Collect(m)
	agent.detector.Collect(m)
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
		V config.GradedInfringementKind
		T *config.PerLevelEgressTraffic
	}
	levels := make([]level, 0, 2)
	if agent.Config.EgressTraffic.VeryExcessiveLevel != nil {
		levels = append(levels, level{V: config.GradeKind(config.InfringementExcessiveEgress, common.SeverityVery), T: agent.Config.EgressTraffic.VeryExcessiveLevel})
	}
	if agent.Config.EgressTraffic.ExcessiveLevel != nil {
		levels = append(levels, level{V: config.GradeKind(config.InfringementExcessiveEgress, common.SeverityAudit), T: agent.Config.EgressTraffic.ExcessiveLevel})
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
