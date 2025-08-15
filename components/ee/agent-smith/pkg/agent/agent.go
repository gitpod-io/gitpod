// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agent

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/utils/lru"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/detector"
	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
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

	wsman wsmanapi.WorkspaceManagerClient

	timeElapsedHandler    func(t time.Time) time.Duration
	notifiedInfringements *lru.Cache

	detector       detector.ProcessDetector
	classifier     classifier.ProcessClassifier
	fileDetector   detector.FileDetector
	FileClassifier classifier.FileClassifier
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

	grpcOpts := common_grpc.DefaultClientOptions()
	if cfg.WorkspaceManager.TLS.Authority != "" || cfg.WorkspaceManager.TLS.Certificate != "" && cfg.WorkspaceManager.TLS.PrivateKey != "" {
		tlsConfig, err := common_grpc.ClientAuthTLSConfig(
			cfg.WorkspaceManager.TLS.Authority, cfg.WorkspaceManager.TLS.Certificate, cfg.WorkspaceManager.TLS.PrivateKey,
			common_grpc.WithSetRootCAs(true),
			common_grpc.WithServerName("ws-manager"),
		)
		if err != nil {
			log.WithField("config", cfg.WorkspaceManager.TLS).Error("Cannot load ws-manager certs - this is a configuration issue.")
			return nil, xerrors.Errorf("cannot load ws-manager certs: %w", err)
		}

		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	} else {
		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}
	conn, err := grpc.Dial(cfg.WorkspaceManager.Address, grpcOpts...)
	if err != nil {
		return nil, xerrors.Errorf("cannot dial ws-manager-mk2: %w", err)
	}
	wsman := wsmanapi.NewWorkspaceManagerClient(conn)

	detec, err := detector.NewProcfsDetector()
	if err != nil {
		return nil, err
	}

	class, err := cfg.Blocklists.Classifier()
	if err != nil {
		return nil, err
	}

	// Initialize filesystem detection if enabled
	var filesystemDetec detector.FileDetector
	var filesystemClass classifier.FileClassifier
	if cfg.FilesystemScanning != nil && cfg.FilesystemScanning.Enabled {
		// Create filesystem detector config
		fsConfig := detector.FilesystemScanningConfig{
			Enabled:      cfg.FilesystemScanning.Enabled,
			ScanInterval: cfg.FilesystemScanning.ScanInterval.Duration,
			MaxFileSize:  cfg.FilesystemScanning.MaxFileSize,
			WorkingArea:  cfg.FilesystemScanning.WorkingArea,
		}

		// Check if the main classifier supports filesystem detection
		if fsc, ok := class.(classifier.FileClassifier); ok {
			filesystemClass = fsc
			filesystemDetec, err = detector.NewfileDetector(fsConfig, filesystemClass)
			if err != nil {
				log.WithError(err).Warn("failed to create filesystem detector")
			}
		} else {
			log.Warn("classifier does not support filesystem detection, filesystem scanning disabled")
		}
	}

	m := newAgentMetrics()
	res := &Smith{
		EnforcementRules: map[string]config.EnforcementRules{
			defaultRuleset: {
				config.GradeKind(config.InfringementExec, common.SeverityBarely): config.PenaltyLimitCPU,
				config.GradeKind(config.InfringementExec, common.SeverityAudit):  config.PenaltyStopWorkspace,
				config.GradeKind(config.InfringementExec, common.SeverityVery):   config.PenaltyStopWorkspaceAndBlockUser,
			},
		},
		Config:     cfg,
		GitpodAPI:  api,
		Kubernetes: clientset,

		wsman: wsman,

		detector:       detec,
		classifier:     class,
		fileDetector:   filesystemDetec,
		FileClassifier: filesystemClass,

		notifiedInfringements: lru.New(notificationCacheSize),
		metrics:               m,
		timeElapsedHandler:    time.Since,
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
	CommandLine []string
}

// defaultRuleset is the name ("remote origin URL") of the default enforcement rules
const defaultRuleset = ""

type classifiedProcess struct {
	P   detector.Process
	C   *classifier.Classification
	Err error
}

type classifiedFilesystemFile struct {
	F   detector.File
	C   *classifier.Classification
	Err error
}

// Start gets a stream of Infringements from Run and executes a callback on them to apply a Penalty
func (agent *Smith) Start(ctx context.Context, callback func(InfringingWorkspace, []config.PenaltyKind)) {
	ps, err := agent.detector.DiscoverProcesses(ctx)
	if err != nil {
		log.WithError(err).Fatal("cannot start process detector")
	}

	// Start filesystem detection if enabled
	var fs <-chan detector.File
	if agent.fileDetector != nil {
		fs, err = agent.fileDetector.DiscoverFiles(ctx)
		if err != nil {
			log.WithError(err).Warn("cannot start filesystem detector")
		}
	}

	var (
		wg  sync.WaitGroup
		cli = make(chan detector.Process, 500)
		clo = make(chan classifiedProcess, 50)
		fli = make(chan detector.File, 100)
		flo = make(chan classifiedFilesystemFile, 25)
	)
	agent.metrics.RegisterClassificationQueues(cli, clo)

	workspaces := make(map[int]*common.Workspace)
	wsMutex := &sync.Mutex{}

	defer wg.Wait()
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range cli {
				// Update the workspaces map if this process belongs to a new workspace
				wsMutex.Lock()
				if _, ok := workspaces[i.Workspace.PID]; !ok {
					log.Debugf("adding workspace with pid %d and workspaceId %s to workspaces", i.Workspace.PID, i.Workspace.WorkspaceID)
					workspaces[i.Workspace.PID] = i.Workspace
				}
				wsMutex.Unlock()
				// perform classification of the process
				class, err := agent.classifier.Matches(i.Path, i.CommandLine)
				// optimisation: early out to not block on the CLO chan
				if err == nil && class.Level == classifier.LevelNoMatch {
					continue
				}
				clo <- classifiedProcess{P: i, C: class, Err: err}
			}
		}()
	}

	// Filesystem classification workers (fewer than process workers)
	if agent.FileClassifier != nil {
		for i := 0; i < 5; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for file := range fli {
					log.Infof("Classifying filesystem file: %s", file.Path)
					class, err := agent.FileClassifier.MatchesFile(file.Path)
					// Early out for no matches
					if err == nil && class.Level == classifier.LevelNoMatch {
						log.Infof("File classification: no match - %s", file.Path)
						continue
					}
					log.Infof("File classification result: %s (level: %s, err: %v)", file.Path, class.Level, err)
					flo <- classifiedFilesystemFile{F: file, C: class, Err: err}
				}
			}()
		}
	}

	defer log.Info("agent smith main loop ended")

	// We want to fill the classifier in a Go routine seaparete from using the classification
	// results, to ensure we're not deadlocking/block ourselves. If this were in the same loop,
	// we could easily get into a situation where we'd need to scale the queues to match the proc index.
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case proc, ok := <-ps:
				if !ok {
					return
				}
				select {
				case cli <- proc:
				default:
					// we're overfilling the classifier worker
					agent.metrics.classificationBackpressureInDrop.Inc()
				}
			case file, ok := <-fs:
				if !ok {
					continue
				}
				select {
				case fli <- file:
				default:
					// filesystem queue full, skip this file
				}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case class := <-clo:
			proc, cl, err := class.P, class.C, class.Err
			if err != nil {
				log.WithError(err).WithFields(log.OWI(proc.Workspace.OwnerID, proc.Workspace.WorkspaceID, proc.Workspace.InstanceID)).WithField("path", proc.Path).Error("cannot classify process")
				continue
			}
			if cl == nil || cl.Level == classifier.LevelNoMatch {
				continue
			}

			_, _ = agent.Penalize(InfringingWorkspace{
				SupervisorPID: proc.Workspace.PID,
				Owner:         proc.Workspace.OwnerID,
				InstanceID:    proc.Workspace.InstanceID,
				GitRemoteURL:  []string{proc.Workspace.GitURL},
				Infringements: []Infringement{
					{
						Kind:        config.GradeKind(config.InfringementExec, common.Severity(cl.Level)),
						Description: fmt.Sprintf("%s: %s", cl.Classifier, cl.Message),
						CommandLine: proc.CommandLine,
					},
				},
			})
		case fileClass := <-flo:
			log.Infof("Received classified file from flo channel")
			file, cl, err := fileClass.F, fileClass.C, fileClass.Err
			if err != nil {
				log.WithError(err).WithFields(log.OWI(file.Workspace.OwnerID, file.Workspace.WorkspaceID, file.Workspace.InstanceID)).WithField("path", file.Path).Error("cannot classify filesystem file")
				continue
			}
			if cl == nil || cl.Level == classifier.LevelNoMatch {
				log.Warn("filesystem signature not detected", "path", file.Path, "workspace", file.Workspace.WorkspaceID)
				continue
			}

			log.Info("filesystem signature detected", "path", file.Path, "workspace", file.Workspace.WorkspaceID, "severity", cl.Level, "message", cl.Message)
			_, _ = agent.Penalize(InfringingWorkspace{
				SupervisorPID: file.Workspace.PID,
				Owner:         file.Workspace.OwnerID,
				InstanceID:    file.Workspace.InstanceID,
				WorkspaceID:   file.Workspace.WorkspaceID,
				GitRemoteURL:  []string{file.Workspace.GitURL},
				Infringements: []Infringement{
					{
						Kind:        config.GradeKind(config.InfringementExec, common.Severity(cl.Level)), // Reuse exec for now
						Description: fmt.Sprintf("filesystem signature: %s", cl.Message),
						CommandLine: []string{file.Path}, // Use file path as "command"
					},
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
			log.WithField("infringement", log.TrustedValueWrap{Value: ws.Infringements}).WithFields(owi).Info("stopping workspace")
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspace(ws.SupervisorPID, ws.InstanceID)
			if err != nil {
				log.WithError(err).WithFields(owi).Debug("failed to stop workspace")
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case config.PenaltyStopWorkspaceAndBlockUser:
			log.WithField("infringement", log.TrustedValueWrap{Value: ws.Infringements}).WithFields(owi).Info("stopping workspace and blocking user")
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.stopWorkspaceAndBlockUser(ws.SupervisorPID, ws.Owner, ws.WorkspaceID, ws.InstanceID)
			if err != nil {
				log.WithError(err).WithFields(owi).Debug("failed to stop workspace and block user")
				agent.metrics.penaltyFailures.WithLabelValues(string(p), err.Error()).Inc()
			}
			return penalty, err
		case config.PenaltyLimitCPU:
			log.WithField("infringement", log.TrustedValueWrap{Value: ws.Infringements}).WithFields(owi).Info("limiting CPU")
			agent.metrics.penaltyAttempts.WithLabelValues(string(p)).Inc()
			err := agent.limitCPUUse(ws.Pod)
			if err != nil {
				log.WithError(err).WithFields(owi).Debug("failed to limit CPU")
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
	if agent.fileDetector != nil {
		agent.fileDetector.Describe(d)
	}
	if agent.FileClassifier != nil {
		agent.FileClassifier.Describe(d)
	}
}

func (agent *Smith) Collect(m chan<- prometheus.Metric) {
	agent.metrics.Collect(m)
	agent.classifier.Collect(m)
	agent.detector.Collect(m)
	if agent.fileDetector != nil {
		agent.fileDetector.Collect(m)
	}
	if agent.FileClassifier != nil {
		agent.FileClassifier.Collect(m)
	}
}
