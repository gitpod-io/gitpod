package agent

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"
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

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

const (
	// notificationCacheSize is the history size of notifications we don't want to get notified about again
	notificationCacheSize = 1000
)

// Smith can perform operations within a users workspace and judge a user
type Smith struct {
	GitpodAPI                gitpod.APIInterface
	Namespace                string
	Blacklists               *Blacklists
	CPUUseThreshold          float32
	CPUUseInterval           int
	EgressTraffic            *EgressTraffic
	PodPolicingRetryInterval util.Duration
	PodPolicingMaxRetries    int
	PodPolicingTimeout       util.Duration
	LongCheckVariationTime   util.Duration
	EnforcementRules         map[string]EnforcementRules
	SlackWebhooks            *SlackWebhooks
	metrics                  *metrics

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

// NewAgentSmithOption configures an agent
type NewAgentSmithOption func(*Smith) error

// WithGitpodAPI configures an agent smith instance to work within a Kubernetes namespace
func WithGitpodAPI(hostURL string, gitpodAPIToken string) NewAgentSmithOption {
	return func(agent *Smith) error {
		if gitpodAPIToken == "" {
			return fmt.Errorf("expected gitpodAPIToken but got none")
		}

		u, err := url.Parse(hostURL)
		if err != nil {
			return err
		}
		endpoint := fmt.Sprintf("wss://%s/api/v1", u.Hostname())

		api, err := gitpod.ConnectToServer(endpoint, gitpod.ConnectToServerOpts{
			Context: context.Background(),
			Token:   gitpodAPIToken,
			Log:     log.Log,
		})
		if err != nil {
			return err
		}
		agent.GitpodAPI = api
		return nil
	}
}

// WithNamespace configures an agent smith instance to work within a Kubernetes namespace
func WithNamespace(ns string) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.Namespace = ns
		return nil
	}
}

// WithBlacklists establishes a list of commands prohibited in a workspace
func WithBlacklists(b *Blacklists) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.Blacklists = b
		return nil
	}
}

// WithCPUUseCheck enables high-CPU use warnings/infringements
func WithCPUUseCheck(threshold float32, averageOverMinutes int) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.CPUUseThreshold = threshold
		agent.CPUUseInterval = averageOverMinutes
		return nil
	}
}

// WithEgressTraffic configures an upper limit of egress traffic of a workspace
func WithEgressTraffic(m *EgressTraffic) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.EgressTraffic = m
		return nil
	}
}

// WithPodPolicingRetry configures the retry interval for policing pods
func WithPodPolicingRetry(retries int, timeBetweenRetries util.Duration) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.PodPolicingMaxRetries = retries
		agent.PodPolicingRetryInterval = timeBetweenRetries
		return nil
	}
}

// WithPodPolicingTimeout configures the upper bound a pod inspection may take per check
func WithPodPolicingTimeout(policingTimeout util.Duration) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.PodPolicingTimeout = policingTimeout
		return nil
	}
}

// WithDefaultEnforcementRules configures the default enforcement rules
func WithDefaultEnforcementRules(rules EnforcementRules) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.EnforcementRules[defaultRuleset] = rules
		return nil
	}
}

// WithRepoEnforcementRules configures per-repo enforcement rules.
// The map key is expected to be the Git remote origin URL of the repo we want to target with those rules.
// Note: this option is only ever additive, i.e. one cannot remove rules once set.
func WithRepoEnforcementRules(rules map[string]EnforcementRules) NewAgentSmithOption {
	return func(agent *Smith) error {
		for k, v := range rules {
			if k == defaultRuleset {
				continue
			}
			if err := v.Validate(); err != nil {
				return fmt.Errorf("invalid enforcement rules for %s: %w", k, err)
			}

			agent.EnforcementRules[k] = v
		}
		return nil
	}
}

func WithSlackWebhooks(s *SlackWebhooks) NewAgentSmithOption {
	return func(agent *Smith) error {
		agent.SlackWebhooks = s
		return nil
	}
}

// NewAgentSmith creates a new agent smith
func NewAgentSmith(opts ...NewAgentSmithOption) (*Smith, error) {
	notificationCache, err := lru.New(notificationCacheSize)
	if err != nil {
		return nil, err
	}

	res := &Smith{
		EnforcementRules: map[string]EnforcementRules{
			defaultRuleset: EnforcementRules{
				GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityBarely): PenaltyLimitCPU,
				GradeKind(InfringementHasBlacklistedFile, InfringementSeverityBarely): PenaltyLimitCPU,
				GradeKind(InfringementExecBlacklistedCmd, InfringementSeverityAudit):  PenaltyStopWorkspaceAndBlockUser,
				GradeKind(InfringementHasBlacklistedFile, InfringementSeverityAudit):  PenaltyStopWorkspaceAndBlockUser,
				GradeKind(InfringementExcessiveEgress, InfringementSeverityVery):      PenaltyStopWorkspace,
			},
		},
		LongCheckVariationTime: util.Duration(15 * time.Second),
		notifiedInfringements:  notificationCache,
		metrics:                newAgentMetrics(),
	}
	for _, o := range opts {
		err = o(res)
		if err != nil {
			return nil, err
		}
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
		PenaltyLimitCPU:                  struct{}{},
		PenaltyNone:                      struct{}{},
		PenaltyStopWorkspace:             struct{}{},
		PenaltyStopWorkspaceAndBlockUser: struct{}{},
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
	// todo(fntlnz): do not hardcode this path
	abpf, err := bpf.LoadAndAttach("/root/probe.o")

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

func (agent *Smith) workOnPod(ctx context.Context, pod *corev1.Pod, longCheck bool) (result *InfringingWorkspace, err error) {
	// if longCheck {
	// 	// we randomise the start of a long check somewhat do avoid thundering herd problems
	// 	// otherwise caused by all sentinel running expensive operations.
	// 	time.Sleep(time.Duration(rand.Int63n(int64(agent.LongCheckVariationTime))))
	// }
	// ctx, cancel := context.WithTimeout(ctx, time.Duration(agent.PodPolicingTimeout))
	// defer cancel()

	// // try connecting via
	// workspaceID := pod.Labels[wsk8s.MetaIDLabel]
	// host := wsk8s.WorkspaceSupervisorEndpoint(workspaceID, agent.Namespace)
	// sen, err := sentinel.ConnectViaNetwork(ctx, host, defaultSentinelToken)
	// if err != nil {
	// 	return nil, err
	// }

	// defer func() {
	// 	cerr := sen.Close()
	// 	if cerr != nil {
	// 		log.WithError(err).WithField("pod", pod.Name).Debug("could not close sentinel connection - leaking memory here")

	// 		if err == nil {
	// 			// don't overwrite previous errors
	// 			err = cerr
	// 		}
	// 	}
	// }()

	// var infringements []Infringement
	// infringement, err := agent.checkEgressTraffic(ctx, pod, sen)
	// if infringement != nil {
	// 	infringements = append(infringements, *infringement)
	// }
	// if err != nil {
	// 	return result, err
	// }

	// infringement, err = agent.checkForBlacklistedCommand(ctx, pod.Name, sen)
	// if infringement != nil {
	// 	infringements = append(infringements, *infringement)
	// }
	// if err != nil {
	// 	return result, err
	// }

	// infringement, err = agent.checkForCPUUse(ctx, pod.Name, sen)
	// if infringement != nil {
	// 	infringements = append(infringements, *infringement)
	// }
	// if err != nil {
	// 	return result, err
	// }

	// if longCheck {
	// 	var (
	// 		blacklists = []*PerLevelBlacklist{agent.Blacklists.Very, agent.Blacklists.Audit, agent.Blacklists.Barely}
	// 		severities = []InfringementSeverity{InfringementSeverityVery, InfringementSeverityAudit, InfringementSeverityBarely}
	// 	)
	// 	for i, bl := range blacklists {
	// 		if bl == nil || len(bl.Signatures) == 0 {
	// 			continue
	// 		}

	// 		s := severities[i]

	// 		// Fist: check the running processes binaries
	// 		infringement, err = agent.checkForSignature(ctx, pod.Name, sen, s, signature.DomainProcess, bl.Signatures)
	// 		if infringement != nil {
	// 			infringements = append(infringements, *infringement)
	// 		}
	// 		if err != nil {
	// 			return result, err
	// 		}

	// 		// Check the filesystem (if there is any time left)
	// 		infringement, err = agent.checkForSignature(ctx, pod.Name, sen, s, signature.DomainFileSystem, bl.Signatures)
	// 		if infringement != nil {
	// 			infringements = append(infringements, *infringement)
	// 		}
	// 		if err != nil {
	// 			return result, err
	// 		}
	// 	}
	// }

	// if len(infringements) > 0 {
	// 	owner, workspaceID, instanceID := agent.getWorkspaceInfo(pod)
	// 	if err != nil {
	// 		log.WithError(err).WithField("pod", pod.Name).Warn("cannot determine workspace info")
	// 	}
	// 	res, err := sen.GetGitRemoteURL(ctx, &sentinel.GetGitRemoteURLRequest{})
	// 	if err != nil {
	// 		res = &sentinel.GetGitRemoteURLResponse{}
	// 		log.WithError(err).WithField("pod", pod.Name).WithFields(log.OWI(owner, workspaceID, instanceID)).Warn("cannot get Git remote URL")
	// 	}
	// 	result = &InfringingWorkspace{
	// 		GitRemoteURL:  res.Url,
	// 		InstanceID:    instanceID,
	// 		Pod:           pod.Name,
	// 		Owner:         owner,
	// 		Infringements: infringements,
	// 		WorkspaceID:   workspaceID,
	// 	}
	// }

	// return result, err

	return nil, nil
}

// func (agent *Smith) checkEgressTraffic(ctx context.Context, pod *corev1.Pod, sen sentinel.SentinelClient) (*Infringement, error) {
// 	if agent.EgressTraffic == nil {
// 		return nil, nil
// 	}
// 	log := log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta))

// 	podLifetime := time.Since(pod.CreationTimestamp.Time)
// 	resp, err := sen.GetEgressTraffic(ctx, &sentinel.GetEgressTrafficRequest{})
// 	if err != nil {
// 		return nil, err
// 	}
// 	if resp.TotalBytes <= 0 {
// 		log.WithField("total egress bytes", resp.TotalBytes).Warn("GetEgressTraffic returned <= 0 value")
// 		return nil, nil
// 	}

// 	type level struct {
// 		V GradedInfringementKind
// 		T *PerLevelEgressTraffic
// 	}
// 	levels := make([]level, 0, 2)
// 	if agent.EgressTraffic.VeryExcessiveLevel != nil {
// 		levels = append(levels, level{V: GradeKind(InfringementExcessiveEgress, InfringementSeverityVery), T: agent.EgressTraffic.VeryExcessiveLevel})
// 	}
// 	if agent.EgressTraffic.ExcessiveLevel != nil {
// 		levels = append(levels, level{V: GradeKind(InfringementExcessiveEgress, InfringementSeverityAudit), T: agent.EgressTraffic.ExcessiveLevel})
// 	}

// 	dt := int64(podLifetime / time.Duration(agent.EgressTraffic.WindowDuration))
// 	for _, lvl := range levels {
// 		allowance := dt*lvl.T.Threshold.Value() + lvl.T.BaseBudget.Value()
// 		excess := resp.TotalBytes - allowance

// 		// log.WithFields(logrus.Fields{"pod": pod.Name, "lifetime": podLifetime.String(), "egressBytes": resp.TotalBytes, "allowance": allowance, "excess": excess}).Debugf("checking %s traffic", lvl.V)
// 		if excess > 0 {
// 			return &Infringement{Description: fmt.Sprintf("egress traffic is %.3f megabytes over limit", float64(excess)/(1024.0*1024.0)), Kind: lvl.V}, nil
// 		}
// 	}

// 	return nil, nil
// }

// func (agent *Smith) checkForBlacklistedCommand(ctx context.Context, podName string, sen sentinel.SentinelClient) (*Infringement, error) {
// 	if agent.Blacklists == nil {
// 		return nil, nil
// 	}

// 	// Note: mind the order of severity here. We check, hence return very blacklisted command infringements first
// 	var (
// 		blacklists = []*PerLevelBlacklist{agent.Blacklists.Very, agent.Blacklists.Audit, agent.Blacklists.Barely}
// 		severities = []InfringementSeverity{InfringementSeverityVery, InfringementSeverityAudit, InfringementSeverityBarely}
// 		rerr       error
// 	)
// 	for i, bl := range blacklists {
// 		if bl == nil || len(bl.Binaries) == 0 {
// 			continue
// 		}

// 		resp, err := sen.IsCommandRunning(ctx, &sentinel.IsCommandRunningRequest{Command: bl.Binaries})
// 		if err != nil {
// 			rerr = xerrors.Errorf("error while checking for blacklisted command: %v", err)
// 			continue
// 		}
// 		if len(resp.Findings) == 0 {
// 			continue
// 		}

// 		s := severities[i]
// 		return &Infringement{Description: fmt.Sprintf("user ran %s blacklisted command: %s", s, resp.Findings[0]), Kind: GradeKind(InfringementExecBlacklistedCmd, s)}, nil
// 	}

// 	return nil, rerr
// }

// func (agent *Smith) checkForCPUUse(ctx context.Context, podName string, sen sentinel.SentinelClient) (*Infringement, error) {
// 	if agent.CPUUseInterval <= 0 {
// 		return nil, nil
// 	}

// 	resp, err := sen.GetCPUInfo(ctx, &sentinel.GetCPUInfoRequest{AverageOverMinutes: int64(agent.CPUUseInterval)})
// 	if status.Code(err) == codes.FailedPrecondition {
// 		// we don't have enough data yet - pod isn't running long enough
// 		return nil, nil
// 	}
// 	if err != nil {
// 		return nil, xerrors.Errorf("error while checking for CPU usage: %v", err)
// 	}

// 	if resp.Load < agent.CPUUseThreshold {
// 		return nil, nil
// 	}

// 	topcmd := resp.TopCommand
// 	return &Infringement{Description: fmt.Sprintf("CPU load %.2f > %.2f for %d minutes. Top command is %s", resp.Load, agent.CPUUseThreshold, agent.CPUUseInterval, topcmd), Kind: GradeKind(InfringementExcessiveCPUUse, InfringementSeverityAudit)}, nil
// }

// func (agent *Smith) checkForSignature(ctx context.Context, podName string, sen sentinel.SentinelClient, severity InfringementSeverity, domain signature.Domain, signatures []*signature.Signature) (*Infringement, error) {
// 	fsigs := make([]*signature.Signature, 0, len(signatures))
// 	for _, s := range signatures {
// 		if s.Domain == domain {
// 			fsigs = append(fsigs, s)
// 		}
// 	}
// 	if len(fsigs) == 0 {
// 		return nil, nil
// 	}

// 	var sd sentinel.FindSignatureDomain
// 	switch domain {
// 	case signature.DomainFileSystem:
// 		sd = sentinel.FindSignatureDomain_Filesystem
// 	case signature.DomainProcess:
// 		sd = sentinel.FindSignatureDomain_Process
// 	default:
// 		return nil, xerrors.Errorf("unknown domain: %q", domain)
// 	}

// 	resp, err := sen.FindSignature(ctx, &sentinel.FindSignatureRequest{
// 		Signature: sentinel.ConvertSignaturesToProtocol(fsigs),
// 		Domain:    sd,
// 	})
// 	if err != nil {
// 		return nil, xerrors.Errorf("find signature returned error: %v", err)
// 	}
// 	if resp == nil {
// 		return nil, xerrors.Errorf("findSignature: no error with no response: %v", err)
// 	}

// 	if resp.Target == "" {
// 		return nil, nil
// 	}

// 	if domain == signature.DomainProcess {
// 		return &Infringement{Description: fmt.Sprintf("user ran program matching %s signature: %s", resp.Signature.Name, resp.Target), Kind: GradeKind(InfringementExecBlacklistedCmd, severity)}, nil
// 	}

// 	return &Infringement{Description: fmt.Sprintf("found file matching %s signature: %s", resp.Signature.Name, resp.Target), Kind: GradeKind(InfringementHasBlacklistedFile, severity)}, nil
// }

// RegisterMetrics registers prometheus metrics for this driver
func (agent *Smith) RegisterMetrics(reg prometheus.Registerer) error {
	return agent.metrics.Register(reg)
}
