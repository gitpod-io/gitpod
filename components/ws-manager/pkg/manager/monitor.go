// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/opentracing/opentracing-go"
	tracelog "github.com/opentracing/opentracing-go/log"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	grpc_status "google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"sigs.k8s.io/controller-runtime/pkg/client"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/workpool"
)

const (
	// eventpoolWorkers is the number of workers in the event workpool. This number limits how many workspace events can be handled
	// in parallel; that is NOT the same as "how many workspaces can start in parallel". The event handling per workspace is written
	// so that it's quick in the "hot path" (i.e. less than 500ms). Thus this number should be around 0.5*expected(events per second).
	eventpoolWorkers = 100
)

var (
	// wsdaemonMaxAttempts is the number of times we'll attempt to work with ws-daemon when a former attempt returned unavailable.
	// We rety for two minutes every 5 seconds (see wwsdaemonRetryInterval).
	//
	// Note: this is a variable rather than a constant so that tests can modify this value.
	wsdaemonMaxAttempts = 120 / 5

	// wsdaemonRetryInterval is the time in between attempts to work with ws-daemon.
	//
	// Note: this is a variable rather than a constant so that tests can modify this value.
	wsdaemonRetryInterval = 5 * time.Second
)

// Monitor listens for kubernetes events and periodically checks if everything is still ok.
type Monitor struct {
	startup time.Time

	manager   *Manager
	eventpool *workpool.EventWorkerPool
	ticker    *time.Ticker

	probeMap     map[string]context.CancelFunc
	probeMapLock sync.Mutex

	initializerMap     map[string]struct{}
	initializerMapLock sync.Mutex

	finalizerMap     map[string]context.CancelFunc
	finalizerMapLock sync.Mutex

	act actingManager

	OnError func(error)
}

// CreateMonitor creates a new monitor
func (m *Manager) CreateMonitor() (*Monitor, error) {
	monitorInterval := time.Duration(m.Config.HeartbeatInterval)
	// Monitor interval is half the heartbeat interval to catch timed out workspaces in time.
	// See https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem why we need this.
	monitorInterval /= 2

	log.WithField("interval", monitorInterval).Info("starting workspace monitor")
	res := Monitor{
		manager:        m,
		ticker:         time.NewTicker(monitorInterval),
		probeMap:       make(map[string]context.CancelFunc),
		initializerMap: make(map[string]struct{}),
		finalizerMap:   make(map[string]context.CancelFunc),

		OnError: func(err error) {
			log.WithError(err).Error("workspace monitor error")
		},
	}
	res.eventpool = workpool.NewEventWorkerPool(res.handleEvent)
	res.act = struct {
		*Monitor
		*Manager
	}{&res, m}

	return &res, nil
}

// Start starts up the monitor which will check the overall workspace state (on event or periodically).
// Use Stop() to stop the monitor gracefully.
func (m *Monitor) Start() error {
	// mark startup so that we can do proper workspace timeouting
	m.startup = time.Now().UTC()

	m.eventpool.Start(eventpoolWorkers)

	// our activity state is ephemeral and as such we need to mark existing workspaces active after we have
	// restarted (i.e. cleared our state). If we didn't do this, we'd time out all workspaces at ws-manager
	// startup, see: https://github.com/gitpod-io/gitpod/issues/2537 and https://github.com/gitpod-io/gitpod/issues/2619
	err := m.manager.markAllWorkspacesActive()
	if err != nil {
		log.WithError(err).Warn("cannot mark all existing workspaces active - this will wrongly time out user's workspaces")
	}

	go func() {
		for range m.ticker.C {
			m.doHousekeeping(context.Background())
		}
	}()

	return nil
}

// handleEvent dispatches an event to the corresponding event handler based on the event object kind.
// This function is expected to be called from a worker of the event pool.
func (m *Monitor) handleEvent(evt watch.Event) {
	var err error
	switch evt.Object.(type) {
	case *corev1.Pod:
		err = m.onPodEvent(evt)
	}

	if err != nil {
		m.OnError(err)
	}
}

// onPodEvent interpretes Kubernetes events, translates and broadcasts them, and acts based on them
func (m *Monitor) onPodEvent(evt watch.Event) error {
	// Beware: we patch running pods to add annotations. At the moment this is not a problem as do not attach
	//         state to pods from which we did not want events to be created. However, we might have to filter out
	//         some MODIFIED events here if that ever changes. Otherwise the monitor clients will receive multiple
	//		   events with the same status even though nothing changed for them.

	pod, ok := evt.Object.(*corev1.Pod)
	if !ok {
		return xerrors.Errorf("received non-pod event")
	}

	// We start with the default kubernetes operation timeout to not block everything in case completing
	// the object hangs for some reason. Further down when notifying clients, we move to a context.Background()
	ctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
	defer cancel()

	wso, err := m.manager.getWorkspaceObjects(ctx, pod)
	if err != nil {
		return xerrors.Errorf("cannot handle workspace event: %w", err)
	}

	status, err := m.manager.getWorkspaceStatus(*wso)
	if err != nil {
		log.WithError(err).WithFields(wso.GetOWI()).Error("onPodEvent cannot get status")
		return xerrors.Errorf("cannot handle workspace event: %w", err)
	}

	// There's one bit of the status which we cannot infere from Kubernetes alone, and that's the Git repo status
	// inside the workspace. To get this information, we have to ask ws-daemon. At the moment we only care about this
	// information during shutdown, as we're only showing it for stopped workspaces.

	if evt.Type == watch.Deleted {
		// If we're still probing this workspace (because it was stopped by someone other than the monitor while we
		// were probing), stop doing that.
		m.probeMapLock.Lock()
		if cancelProbe, ok := m.probeMap[pod.Name]; ok {
			cancelProbe()
			delete(m.probeMap, pod.Name)
		}
		m.probeMapLock.Unlock()

		// We're handling a pod event, thus Kubernetes gives us the pod we're handling. However, this is also a deleted
		// event which means the pod doesn't actually exist anymore. We need to reflect that in our status compution, hence
		// we change the deployed condition.
		status.Conditions.Deployed = api.WorkspaceConditionBool_FALSE
	}

	// make sure we tell our clients that things changed - no matter if there's an error in our
	// subsequent handling of the matter or not. However, we want to respond quickly to events,
	// thus we start OnChange as a goroutine.
	// BEWARE beyond this point one must not modify status anymore - we've already sent it out BEWARE
	span := m.traceWorkspace("handle-"+status.Phase.String(), wso)
	ctx = opentracing.ContextWithSpan(context.Background(), span)
	onChangeDone := make(chan bool)
	go func() {
		// We call OnChange in a Go routine to make sure it doesn't block our internal handling of events.
		m.manager.OnChange(ctx, status)
		onChangeDone <- true
	}()

	m.writeEventTraceLog(status, wso)
	err = actOnPodEvent(ctx, m.act, status, wso)

	// To make the tracing work though we have to re-sync with OnChange. But we don't want OnChange to block our event
	// handling, thus we wait for it to finish in a Go routine.
	go func() {
		<-onChangeDone
		span.Finish()
	}()

	return err
}

// actOnPodEvent performs actions when a kubernetes event comes in. For example we shut down failed workspaces or start
// polling the ready state of initializing ones.
func actOnPodEvent(ctx context.Context, m actingManager, status *api.WorkspaceStatus, wso *workspaceObjects) (err error) {
	pod := wso.Pod

	span, ctx := tracing.FromContext(ctx, "actOnPodEvent")
	defer tracing.FinishSpan(span, &err)
	log := log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta))

	workspaceID, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		return xerrors.Errorf("cannot act on pod %s: has no %s annotation", pod.Name, workspaceIDAnnotation)
	}

	if status.Phase == api.WorkspacePhase_STOPPING || status.Phase == api.WorkspacePhase_STOPPED {
		// Beware: do not else-if this condition with the other phases as we don't want the stop
		//         login in any other phase, too.
		m.clearInitializerFromMap(pod.Name)

		// Special case: workspaces timing out during backup. Normally a timed out workspace would just be stopped
		//               regularly. When a workspace times out during backup though, stopping it won't do any good.
		//               The workspace is already shutting down, it just fails to do so properly. Instead, we need
		//               to update the disposal status to reflect this timeout situation.
		if status.Conditions.Timeout != "" && strings.Contains(status.Conditions.Timeout, string(activityBackup)) {
			err = func() error {
				b, err := json.Marshal(workspaceDisposalStatus{BackupComplete: true, BackupFailure: status.Conditions.Timeout})
				if err != nil {
					return err
				}

				err = m.markWorkspace(ctx, workspaceID, addMark(disposalStatusAnnotation, string(b)))
				if err != nil {
					return err
				}
				return nil
			}()
			if err != nil {
				log.WithError(err).Error("was unable to update pod's disposal state - this will break someone's experience")
			}
		}
	} else if status.Conditions.Failed != "" || status.Conditions.Timeout != "" {
		// the workspace has failed to run/start - shut it down
		// we should mark the workspace as failedBeforeStopping - this way the failure status will persist
		// while we stop the workspace
		_, hasFailureAnnotation := pod.Annotations[workspaceFailedBeforeStoppingAnnotation]
		if status.Conditions.Failed != "" && !hasFailureAnnotation {
			// If this marking operation failes that's ok - we'll still continue to shut down the workspace.
			// The failure message won't persist while stopping the workspace though.
			err := m.markWorkspace(ctx, workspaceID, addMark(workspaceFailedBeforeStoppingAnnotation, "true"))
			if err != nil {
				log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithError(err).Debug("cannot mark workspace as workspaceFailedBeforeStoppingAnnotation")
			}
		}

		// At the moment we call stopWorkspace on the same workspace at least twice:
		// First when the workspace originally failed, and
		// second when adding the workspaceFailedBeforeStoppingAnnotation which in turn triggers a new pod event.
		//
		// The alternative is to stop the pod only when the workspaceFailedBeforeStoppingAnnotation is present.
		// However, that's much more brittle than stopping the workspace twice (something that Kubernetes can handle).
		// It is important that we do not fail here if the pod is already gone, i.e. when we lost the race.
		err := m.stopWorkspace(ctx, workspaceID, stopWorkspaceNormallyGracePeriod)
		if err != nil && !isKubernetesObjNotFoundError(err) {
			return xerrors.Errorf("cannot stop workspace: %w", err)
		}

		return nil
	}

	if status.Phase == api.WorkspacePhase_CREATING {
		// The workspace has been scheduled on the cluster which means that we can start initializing it
		go func() {
			err := m.initializeWorkspaceContent(ctx, pod)

			if err != nil {
				// workspace initialization failed, which means the workspace as a whole failed
				err = m.markWorkspace(ctx, workspaceID, addMark(workspaceExplicitFailAnnotation, err.Error()))
				if err != nil {
					log.WithError(err).Warn("was unable to mark workspace as failed")
				}
			}
		}()
	}

	if status.Phase == api.WorkspacePhase_INITIALIZING {
		// workspace is initializing (i.e. running but without the ready annotation yet). Start probing and depending on
		// the result add the appropriate annotation or stop the workspace. waitForWorkspaceReady takes care that it does not
		// run for the same workspace multiple times.
		go func() {
			err := m.waitForWorkspaceReady(ctx, pod)

			if err != nil {
				// workspace initialization failed, which means the workspace as a whole failed
				err = m.markWorkspace(ctx, workspaceID, addMark(workspaceExplicitFailAnnotation, err.Error()))
				if err != nil {
					log.WithError(err).Warn("was unable to mark workspace as failed")
				}
			}
		}()
	}

	if status.Phase == api.WorkspacePhase_RUNNING {
		// We need to register the finalizer before the pod is deleted (see https://book.kubebuilder.io/reference/using-finalizers.html).
		// TODO (cw): Figure out if we can replace the "neverReady" flag.
		err = m.modifyFinalizer(ctx, workspaceID, gitpodFinalizerName, true)
		if err != nil {
			return xerrors.Errorf("cannot add gitpod finalizer: %w", err)
		}

		// once a regular workspace is up and running, we'll remove the traceID information so that the parent span
		// ends once the workspace has started.
		//
		// Also, in case the pod gets evicted we would not know the hostIP that pod ran on anymore.
		// In preparation for those cases, we'll add it as an annotation.
		err := m.markWorkspace(ctx, workspaceID, deleteMark(wsk8s.TraceIDAnnotation), addMark(nodeNameAnnotation, wso.NodeName()))
		if err != nil {
			log.WithError(err).Warn("was unable to remove traceID and/or add host IP annotation from/to workspace")
		}
	}

	if status.Phase == api.WorkspacePhase_STOPPING {
		if !isPodBeingDeleted(pod) {
			// this might be the case if a headless workspace has just completed but has not been deleted by anyone, yet
			err := m.stopWorkspace(ctx, workspaceID, stopWorkspaceNormallyGracePeriod)
			if err != nil && !isKubernetesObjNotFoundError(err) {
				return xerrors.Errorf("cannot stop workspace: %w", err)
			}
			return nil
		}

		var terminated bool
		for _, c := range wso.Pod.Status.ContainerStatuses {
			if c.Name == "workspace" {
				// Note: sometimes container don't enter `terminated`, but `waiting`. The processes are stopped nonetheless,
				//       and we should be running the backup. The only thing that keeps the pod alive, is our finalizer.
				terminated = c.State.Running == nil
				break
			}
		}

		// workaround for https://github.com/containerd/containerd/pull/4214 which can prevent pod status
		// propagation. ws-daemon observes the pods and propagates this state out-of-band via the annotation.
		_, gone := wso.Pod.Annotations[wsk8s.ContainerIsGoneAnnotation]

		if terminated || gone {
			go m.finalizeWorkspaceContent(ctx, wso)
		}
	}

	if status.Phase == api.WorkspacePhase_STOPPED {
		// we've disposed already - try to remove the finalizer and call it a day
		return m.modifyFinalizer(ctx, workspaceID, gitpodFinalizerName, false)
	}

	return nil
}

// actingManager contains all functions needed by actOnPodEvent
type actingManager interface {
	waitForWorkspaceReady(ctx context.Context, pod *corev1.Pod) (err error)
	stopWorkspace(ctx context.Context, workspaceID string, gracePeriod time.Duration) (err error)
	markWorkspace(ctx context.Context, workspaceID string, annotations ...*annotation) error

	clearInitializerFromMap(podName string)
	initializeWorkspaceContent(ctx context.Context, pod *corev1.Pod) (err error)
	finalizeWorkspaceContent(ctx context.Context, wso *workspaceObjects)
	modifyFinalizer(ctx context.Context, workspaceID string, finalizer string, add bool) error
}

func (m *Monitor) clearInitializerFromMap(podName string) {
	m.initializerMapLock.Lock()
	delete(m.initializerMap, podName)
	m.initializerMapLock.Unlock()
}

// doHouskeeping is called regularly by the monitor and removes timed out or dangling workspaces/services
func (m *Monitor) doHousekeeping(ctx context.Context) {
	span, ctx := tracing.FromContext(ctx, "doHousekeeping")
	defer tracing.FinishSpan(span, nil)

	err := m.markTimedoutWorkspaces(ctx)
	if err != nil {
		m.OnError(err)
	}

	err = m.deleteDanglingServices(ctx)
	if err != nil {
		m.OnError(err)
	}
}

// writeEventTraceLog writes an event trace log if one is configured. This function is written in
// such a way that it does not fail - and if it fails it fails silently. This is on purpose.
// The event trace log is for debugging only and has no operational significance.
func (m *Monitor) writeEventTraceLog(status *api.WorkspaceStatus, wso *workspaceObjects) {
	// make sure we recover from a panic in this function - not that we expect this to ever happen
	//nolint:errcheck
	defer recover()

	if m.manager.Config.EventTraceLog == "" {
		return
	}

	// The pod object contains potentially sensitive information, e.g. passwords or tokens.
	// We must do our best to remove that information prior to logging it out.
	twso := *wso
	if twso.Pod != nil {
		twso.Pod = twso.Pod.DeepCopy()

		if _, ok := twso.Pod.Annotations[workspaceInitializerAnnotation]; ok {
			twso.Pod.Annotations[workspaceInitializerAnnotation] = "[redacted]"
		}
		for _, c := range twso.Pod.Spec.Containers {
			for i, env := range c.Env {
				isGitpodVar := strings.HasPrefix(env.Name, "GITPOD_") || strings.HasPrefix(env.Name, "SUPERVISOR_") || strings.HasPrefix(env.Name, "BOB_") || strings.HasPrefix(env.Name, "THEIA_")
				if isGitpodVar {
					continue
				}

				isKnownVar := env.Name == "PATH"
				if isKnownVar {
					continue
				}

				c.Env[i].Value = "[redacted]"
			}
		}
	}
	type eventTraceEntry struct {
		Time    string               `json:"time"`
		Status  *api.WorkspaceStatus `json:"status"`
		Objects workspaceObjects     `json:"objects"`
	}
	entry := eventTraceEntry{Time: time.Now().UTC().Format(time.RFC3339Nano), Status: status, Objects: twso}

	if m.manager.Config.EventTraceLog == "-" {
		//nolint:errcheck
		log.WithField("evt", entry).Info("event trace log")
		return
	}

	out, err := os.OpenFile(m.manager.Config.EventTraceLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer out.Close()

	// If writing the event trace log fails that does nothing to harm the function of ws-manager.
	// In fact we don't even want to react to it, hence the nolint.
	//nolint:errcheck
	json.NewEncoder(out).Encode(entry)
}

// traceWorkspace updates the workspace span if the workspace has OpenTracing information associated with it.
// The resulting context may be associated with trace information that can be used to trace the effects of this status
// update throughout the rest of the system.
func (m *Monitor) traceWorkspace(occasion string, wso *workspaceObjects) opentracing.Span {
	var traceID string
	if traceID == "" && wso.Pod != nil {
		traceID = wso.Pod.Annotations[wsk8s.TraceIDAnnotation]
	}
	spanCtx := tracing.FromTraceID(traceID)
	if spanCtx == nil {
		// no trace information available
		return opentracing.NoopTracer{}.StartSpan("noop")
	}

	span := opentracing.StartSpan(fmt.Sprintf("/workspace/%s", occasion), opentracing.FollowsFrom(spanCtx))
	if wso.Pod != nil {
		tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&wso.Pod.ObjectMeta))
	}
	span.LogKV("occasion", occasion)

	// OpenTracing does not support creating a span from a SpanContext https://github.com/opentracing/specification/issues/81.
	// Until that changes we just finish the span immediately after calling on-change.

	return span
}

// waitForWorkspaceReady waits until the workspace's content and Theia to become available.
func (m *Monitor) waitForWorkspaceReady(ctx context.Context, pod *corev1.Pod) (err error) {
	span, ctx := tracing.FromContext(ctx, "waitForWorkspaceReady")
	defer tracing.FinishSpan(span, &err)

	workspaceID, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		m.OnError(xerrors.Errorf("pod %s has no %s annotation", pod.Name, workspaceIDAnnotation))
		return
	}

	r, err := m.probeWorkspaceReady(ctx, pod)
	if err != nil {
		return err
	}
	if r == nil {
		// we're already probing/waiting for this workspace to get ready
		return
	}

	span.LogKV("event", "probeDone")
	probeResult := *r
	if probeResult == WorkspaceProbeStopped {
		// Workspace probe was stopped most likely because the workspace itself was stopped.
		// Should this assumption be wrong we'll clean the dangling workspace when it times out.
		return nil
	}

	// Theia is available - let's wait until the workspace is initialized
	snc, err := m.manager.connectToWorkspaceDaemon(ctx, workspaceObjects{Pod: pod})
	if err != nil {
		return xerrors.Errorf("cannot connect to workspace daemon: %w", err)
	}

	// Note: we don't have to use the same cancelable context that we used for the original Init call.
	//       If the init call gets canceled, WaitForInit will return as well. We're synchronizing through
	//		 wsdaemon here.
	err = retryIfUnavailable(ctx, func(ctx context.Context) error {
		_, err = snc.WaitForInit(ctx, &wsdaemon.WaitForInitRequest{Id: workspaceID})
		return err
	})
	if st, ok := grpc_status.FromError(err); ok && st.Code() == codes.NotFound {
		// Looks like we have missed the CREATING phase in which we'd otherwise start the workspace content initialization.
		// Let's see if we're initializing already. If so, there's something very wrong because ws-daemon does not know about
		// this workspace yet. In that case we'll run another desperate attempt to initialize the workspace.
		m.initializerMapLock.Lock()
		if _, alreadyInitializing := m.initializerMap[pod.Name]; alreadyInitializing {
			// we're already initializing but wsdaemon does not know about this workspace. That's very bad.
			log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Error("we were already initializing but wsdaemon does not know about this workspace (bug in ws-daemon?). Trying again!")
			delete(m.initializerMap, pod.Name)
		}
		m.initializerMapLock.Unlock()

		// It's ok - maybe we were restarting in that time. Instead of waiting for things to finish, we'll just start the
		// initialization now.
		err = m.initializeWorkspaceContent(ctx, pod)
	} else {
		err = handleGRPCError(ctx, err)
	}
	if err != nil {
		return xerrors.Errorf("cannot wait for workspace to initialize: %w", err)
	}
	m.initializerMapLock.Lock()
	delete(m.initializerMap, pod.Name)
	m.initializerMapLock.Unlock()
	span.LogKV("event", "contentInitDone")

	// workspace is ready - mark it as such
	err = m.manager.markWorkspace(ctx, workspaceID, deleteMark(workspaceNeverReadyAnnotation))
	if err != nil {
		return xerrors.Errorf("cannot workspace: %w", err)
	}

	return nil
}

// probeWorkspaceReady continually HTTP GETs a workspace's ready URL until we've tried a certain number of times
// or the workspace responded with status code 200.
func (m *Monitor) probeWorkspaceReady(ctx context.Context, pod *corev1.Pod) (result *WorkspaceProbeResult, err error) {
	span, ctx := tracing.FromContext(ctx, "probeWorkspaceReady")
	defer tracing.FinishSpan(span, &err)

	workspaceID, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		return nil, xerrors.Errorf("pod %s has no %s annotation", pod.Name, workspaceIDAnnotation)
	}
	wsurl, ok := pod.Annotations[workspaceURLAnnotation]
	if !ok {
		return nil, xerrors.Errorf("pod %s has no %s annotation", pod.Name, workspaceURLAnnotation)
	}
	workspaceURL, err := url.Parse(wsurl)
	if err != nil {
		return nil, xerrors.Errorf("cannot probe workspace - this will result in a broken experience for a user: %w", err)
	}

	probeTimeout, err := time.ParseDuration(m.manager.Config.InitProbe.Timeout)
	if err != nil {
		probeTimeout = 5 * time.Second
		log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithError(err).WithField("defaultProbeTimeout", probeTimeout).Warn("Cannot parse init probe timeout. This is a configuration problem. Using default.")
	}

	// Probe preparation, i.e. checking if a probe exists already and if it doesn't registering a new one has to be atomic with
	// regards to the probeMapLock. Ensure both operations are within the same locked section.
	m.probeMapLock.Lock()
	_, alreadyProbing := m.probeMap[pod.Name]
	if alreadyProbing {
		m.probeMapLock.Unlock()
		return nil, nil
	}

	ctx, cancelProbe := context.WithCancel(ctx)
	m.probeMap[pod.Name] = cancelProbe
	m.probeMapLock.Unlock()

	// The probe run will block until either the probe finds the pod ready or the probe itself is stopped.
	// Because of that it's best to run probeWorkspaceReady as a go routine.
	probe := NewWorkspaceReadyProbe(workspaceID, *workspaceURL)
	probe.Timeout = probeTimeout
	if m.manager.Config.InitProbe.Disabled {
		// While under test we may not have a publicly exposed workspace, hence use
		// the probe bypass to get over this stage.
		//
		// Note: this code-path should never run in production.
		probe.bypass = func() WorkspaceProbeResult {
			return WorkspaceProbeReady
		}
	}
	probeResult := probe.Run(ctx)
	span.LogFields(tracelog.String("result", string(probeResult)))

	// we're done probing: deregister probe from probe map
	m.probeMapLock.Lock()
	delete(m.probeMap, pod.Name)
	m.probeMapLock.Unlock()

	return &probeResult, nil
}

// initializeWorkspaceContent talks to a ws-daemon daemon on the node of the pod and initializes the workspace content.
// If we're already initializing the workspace, thus function will return immediately. If we were not initializing,
// prior to this call this function returns once initialization is complete.
func (m *Monitor) initializeWorkspaceContent(ctx context.Context, pod *corev1.Pod) (err error) {
	_, fullWorkspaceBackup := pod.Labels[fullWorkspaceBackupAnnotation]

	workspaceID, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		return xerrors.Errorf("pod %s has no %s annotation", pod.Name, workspaceIDAnnotation)
	}
	workspaceMeta := getWorkspaceMetadata(pod)
	if workspaceMeta.Owner == "" {
		return xerrors.Errorf("pod %s has no owner", pod.Name)
	}

	var (
		initializer     csapi.WorkspaceInitializer
		snc             wsdaemon.WorkspaceContentServiceClient
		contentManifest []byte
	)
	// The function below deliniates the initializer lock. It's just there so that we can
	// defer the unlock call, thus making sure we actually call it.
	err = func() error {
		m.initializerMapLock.Lock()
		defer m.initializerMapLock.Unlock()

		_, alreadyInitializing := m.initializerMap[pod.Name]
		if alreadyInitializing {
			return nil
		}

		// There is no need to emit this span if the operation is noop.
		span, ctx := tracing.FromContext(ctx, "initializeWorkspace")
		defer tracing.FinishSpan(span, &err)
		span.SetTag("fullWorkspaceBackup", fullWorkspaceBackup)

		initializerRaw, ok := pod.Annotations[workspaceInitializerAnnotation]
		if !ok {
			return xerrors.Errorf("pod %s has no %s annotation", pod.Name, workspaceInitializerAnnotation)
		}
		initializerPB, err := base64.StdEncoding.DecodeString(initializerRaw)
		if err != nil {
			return xerrors.Errorf("cannot decode init config: %w", err)
		}
		err = proto.Unmarshal(initializerPB, &initializer)
		if err != nil {
			return xerrors.Errorf("cannot unmarshal init config: %w", err)
		}

		if fullWorkspaceBackup {
			_, mf, err := m.manager.Content.GetContentLayer(ctx, workspaceMeta.Owner, workspaceMeta.MetaId, &initializer)
			if err != nil {
				return xerrors.Errorf("cannot download workspace content manifest: %w", err)
			}
			if mf != nil {
				contentManifest, err = json.Marshal(mf)
			}
			if err != nil {
				return xerrors.Errorf("cannot remarshal workspace content manifest: %w", err)
			}
		}

		// connect to the appropriate ws-daemon
		snc, err = m.manager.connectToWorkspaceDaemon(ctx, workspaceObjects{Pod: pod})
		if err != nil {
			return err
		}

		// mark that we're already initialising this workspace
		m.initializerMap[pod.Name] = struct{}{}

		return nil
	}()
	if err != nil {
		return xerrors.Errorf("cannot initialize workspace: %w", err)
	}
	if err == nil && snc == nil {
		// we are already initialising
		return nil
	}

	err = retryIfUnavailable(ctx, func(ctx context.Context) error {
		_, err = snc.InitWorkspace(ctx, &wsdaemon.InitWorkspaceRequest{
			Id: workspaceID,
			Metadata: &wsdaemon.WorkspaceMetadata{
				Owner:  workspaceMeta.Owner,
				MetaId: workspaceMeta.MetaId,
			},
			Initializer:           &initializer,
			FullWorkspaceBackup:   fullWorkspaceBackup,
			ContentManifest:       contentManifest,
			RemoteStorageDisabled: shouldDisableRemoteStorage(pod),
		})
		return err
	})
	if st, ok := grpc_status.FromError(err); ok && st.Code() == codes.AlreadyExists {
		// we're already initializing, things are good - we'll wait for it later
		err = nil
	} else {
		err = handleGRPCError(ctx, err)
	}
	if err != nil {
		return xerrors.Errorf("cannot initialize workspace: %w", err)
	}

	return nil
}

// retryIfUnavailable makes multiple attempts to execute op if op returns an UNAVAILABLE gRPC status code
func retryIfUnavailable(ctx context.Context, op func(ctx context.Context) error) (err error) {
	span, ctx := tracing.FromContext(ctx, "retryIfUnavailable")
	defer tracing.FinishSpan(span, &err)

	for i := 0; i < wsdaemonMaxAttempts; i++ {
		err := op(ctx)
		span.LogKV("attempt", i)

		if st, ok := grpc_status.FromError(err); ok && st.Code() == codes.Unavailable {
			// service is unavailable - try again after some time
			time.Sleep(wsdaemonRetryInterval)
		} else if err != nil {
			// some other error happened, we'done done here
			return err
		} else {
			// err is nil, we're done here
			return nil
		}
	}

	// we've maxed out our retry attempts
	return grpc_status.Error(codes.Unavailable, "workspace content initialization is currently unavailable")
}

func shouldDisableRemoteStorage(pod *corev1.Pod) bool {
	wso := &workspaceObjects{Pod: pod}
	tpe, err := wso.WorkspaceType()
	if err != nil {
		log.WithFields(wso.GetOWI()).WithError(err).Warn("cannot determine workspace type - assuming this is a regular")
		tpe = api.WorkspaceType_REGULAR
	}
	switch tpe {
	case api.WorkspaceType_GHOST, api.WorkspaceType_IMAGEBUILD:
		return true
	default:
		return false
	}
}

// finalizeWorkspaceContent talks to a ws-daemon daemon on the node of the pod and creates a backup of the workspace content.
func (m *Monitor) finalizeWorkspaceContent(ctx context.Context, wso *workspaceObjects) {
	span, ctx := tracing.FromContext(ctx, "finalizeWorkspaceContent")
	defer tracing.FinishSpan(span, nil)
	log := log.WithFields(wso.GetOWI())

	workspaceID, ok := wso.WorkspaceID()
	if !ok {
		tracing.LogError(span, xerrors.Errorf("cannot find %s annotation", workspaceIDAnnotation))
		log.Errorf("cannot find %s annotation", workspaceIDAnnotation)
	}

	var disposalStatus *workspaceDisposalStatus
	defer func() {
		if disposalStatus == nil {
			return
		}

		b, err := json.Marshal(disposalStatus)
		if err != nil {
			log.WithError(err).Error("unable to marshal disposalStatus - this will break someone's experience")
			return
		}

		err = m.manager.markWorkspace(ctx, workspaceID, addMark(disposalStatusAnnotation, string(b)))
		if err != nil {
			log.WithError(err).Error("was unable to update pod's disposal state - this will break someone's experience")
		}
	}()

	tpe, err := wso.WorkspaceType()
	if err != nil {
		tracing.LogError(span, err)
		log.WithError(err).Warn("cannot determine workspace type - assuming this is a regular")
		tpe = api.WorkspaceType_REGULAR
	}

	doBackup := wso.WasEverReady() && !wso.IsWorkspaceHeadless()
	doBackupLogs := !wsk8s.IsGhostWorkspace(wso.Pod)
	doSnapshot := tpe == api.WorkspaceType_PREBUILD
	doFinalize := func() (worked bool, gitStatus *csapi.GitStatus, err error) {
		m.finalizerMapLock.Lock()
		_, alreadyFinalizing := m.finalizerMap[workspaceID]
		if alreadyFinalizing {
			m.finalizerMapLock.Unlock()
			return false, nil, nil
		}

		// Maybe the workspace never made it to a phase where we actually initialized a workspace.
		// Assuming that once we've had a nodeName we've spoken to ws-daemon it's safe to assume that if
		// we don't have a nodeName we don't need to dipose the workspace.
		// Obviously that only holds if we do not require a backup. If we do require one, we want to
		// fail as loud as we can in this case.
		if !doBackup && !doSnapshot && wso.NodeName() == "" {
			// we don't need a backup and have never spoken to ws-daemon: we're good here.
			m.finalizerMapLock.Unlock()
			return true, &csapi.GitStatus{}, nil
		}

		// we're not yet finalizing - start the process
		snc, err := m.manager.connectToWorkspaceDaemon(ctx, *wso)
		if err != nil {
			m.finalizerMapLock.Unlock()
			return true, nil, err
		}

		ctx, cancelReq := context.WithTimeout(ctx, time.Duration(m.manager.Config.Timeouts.ContentFinalization))
		m.finalizerMap[workspaceID] = cancelReq
		m.finalizerMapLock.Unlock()
		defer func() {
			// we're done disposing - remove from the finalizerMap
			m.finalizerMapLock.Lock()
			delete(m.finalizerMap, workspaceID)
			m.finalizerMapLock.Unlock()
		}()

		if doSnapshot {
			// if this is a prebuild take a snapshot and mark the workspace
			var res *wsdaemon.TakeSnapshotResponse
			res, err = snc.TakeSnapshot(ctx, &wsdaemon.TakeSnapshotRequest{Id: workspaceID})
			if err != nil {
				tracing.LogError(span, err)
				log.WithError(err).Warn("cannot take snapshot")
				err = xerrors.Errorf("cannot take snapshot: %v", err)
			}

			if res != nil {
				err = m.manager.markWorkspace(context.Background(), workspaceID, addMark(workspaceSnapshotAnnotation, res.Url))
				if err != nil {
					tracing.LogError(span, err)
					log.WithError(err).Warn("cannot mark headless workspace with snapshot - that's one prebuild lost")
					err = xerrors.Errorf("cannot remember snapshot: %v", err)
				}
			}
		}

		// DiposeWorkspace will "degenerate" to a simple wait if the finalization/disposal process is already running.
		// This is unlike the initialization process where we wait for things to finish in a later phase.
		resp, err := snc.DisposeWorkspace(ctx, &wsdaemon.DisposeWorkspaceRequest{
			Id:         workspaceID,
			Backup:     doBackup,
			BackupLogs: doBackupLogs,
		})
		if resp != nil {
			gitStatus = resp.GitStatus
		}
		return true, gitStatus, err
	}

	var (
		dataloss    bool
		backupError error
		gitStatus   *csapi.GitStatus
	)
	for i := 0; i < wsdaemonMaxAttempts; i++ {
		span.LogKV("attempt", i)
		didSometing, gs, err := doFinalize()
		if !didSometing {
			// someone else is managing finalization process ... we don't have to bother
			return
		}

		// by default we assume the worst case scenario. If things aren't just as bad, we'll tune it down below.
		dataloss = true
		backupError = handleGRPCError(ctx, err)
		gitStatus = gs

		// At this point one of three things may have happened:
		//   1. the context deadline was exceeded, e.g. due to misconfiguration (not enough time to upload) or network issues. We'll try again.
		//   2. the service was unavailable, in which case we'll try again.
		//   3. none of the above, in which case we'll give up
		st, isGRPCError := grpc_status.FromError(err)
		if !isGRPCError {
			break
		}

		if (err != nil && strings.Contains(err.Error(), context.DeadlineExceeded.Error())) ||
			st.Code() == codes.Unavailable ||
			st.Code() == codes.Canceled {
			// service is currently unavailable or we did not finish in time - let's wait some time and try again
			time.Sleep(wsdaemonRetryInterval)
			continue
		}

		// service was available, we've tried to do the work and failed. Tell the world about it.
		if (doBackup || doSnapshot) && isGRPCError {
			switch st.Code() {
			case codes.DataLoss:
				// ws-daemon told us that it's lost data
				dataloss = true
			case codes.FailedPrecondition:
				// the workspace content was not in the state we thought it was
				dataloss = true
			}
		}
		break
	}

	disposalStatus = &workspaceDisposalStatus{
		BackupComplete: true,
		GitStatus:      gitStatus,
	}
	if backupError != nil {
		if dataloss {
			disposalStatus.BackupFailure = backupError.Error()
		} else {
			// internal errors make no difference to the user experience. The backup still worked, we just messed up some
			// state management or cleanup. No need to worry the user.
			log.WithError(backupError).WithFields(wso.GetOWI()).Warn("internal error while disposing workspace content")
			tracing.LogError(span, backupError)
		}
	}
}

// deleteDanglingServices removes services for which there is no corresponding workspace pod anymore
func (m *Monitor) deleteDanglingServices(ctx context.Context) error {
	var services corev1.ServiceList
	err := m.manager.Clientset.List(ctx, &services, workspaceObjectListOptions(m.manager.Config.Namespace))
	if err != nil {
		return xerrors.Errorf("deleteDanglingServices: %w", err)
	}

	var zero int64 = 0
	propagationPolicy := metav1.DeletePropagationForeground

	for _, service := range services.Items {
		var endpoints corev1.Endpoints
		err := m.manager.Clientset.Get(ctx, types.NamespacedName{Namespace: service.Namespace, Name: service.Name}, &endpoints)
		if err != nil {
			return xerrors.Errorf("deleteDanglingServices: %w", err)
		}

		hasReadyEndpoint := false
		for _, s := range endpoints.Subsets {
			hasReadyEndpoint = len(s.Addresses) > 0
		}
		if hasReadyEndpoint {
			continue
		}

		workspaceID, ok := endpoints.Labels[wsk8s.WorkspaceIDLabel]
		if !ok {
			m.OnError(xerrors.Errorf("service endpoint %s does not have %s label", service.Name, wsk8s.WorkspaceIDLabel))
			continue
		}

		_, err = m.manager.findWorkspacePod(ctx, workspaceID)
		if !isKubernetesObjNotFoundError(err) {
			continue
		}

		if m.manager.Config.DryRun {
			log.WithFields(log.OWI("", "", workspaceID)).WithField("name", service.Name).Info("should have deleted dangling service but this is a dry run")
			continue
		}

		// this relies on the Kubernetes convention that endpoints have the same name as their services
		err = m.manager.Clientset.Delete(ctx, &service, &client.DeleteOptions{
			GracePeriodSeconds: &zero,
			PropagationPolicy:  &propagationPolicy,
		})
		if err != nil && !isKubernetesObjNotFoundError(err) {
			m.OnError(xerrors.Errorf("deleteDanglingServices: %w", err))
			continue
		}
		log.WithFields(log.OWI("", "", workspaceID)).WithField("name", service.Name).Info("deleted dangling service")
	}

	return nil
}

// markTimedoutWorkspaces finds workspaces which haven't been active recently and marks them as timed out
func (m *Monitor) markTimedoutWorkspaces(ctx context.Context) (err error) {
	span, ctx := tracing.FromContext(ctx, "markTimedoutWorkspaces")
	defer tracing.FinishSpan(span, &err)

	var pods corev1.PodList
	err = m.manager.Clientset.List(ctx, &pods, workspaceObjectListOptions(m.manager.Config.Namespace))
	if err != nil {
		return xerrors.Errorf("stopTimedoutWorkspaces: %w", err)
	}

	errs := make([]string, 0)
	idx := make(map[string]struct{})
	for _, pod := range pods.Items {
		workspaceID, ok := pod.Annotations[workspaceIDAnnotation]
		if !ok {
			log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithError(err).Errorf("while checking if timed out: found workspace without %s annotation", workspaceIDAnnotation)
			errs = append(errs, fmt.Sprintf("cannot check if pod %s is timed out: has no %s annotation", pod.Name, workspaceIDAnnotation))
			continue
		}
		idx[workspaceID] = struct{}{}

		if _, timedout := pod.Annotations[workspaceTimedOutAnnotation]; timedout {
			// workspace is already marked as timedout
			continue
		}

		timedout, err := m.manager.isWorkspaceTimedOut(workspaceObjects{Pod: &pod})
		if err != nil {
			errs = append(errs, fmt.Sprintf("workspaceId=%s: %q", workspaceID, err))
			continue
		}
		if timedout == "" {
			continue
		}
		err = m.manager.markWorkspace(ctx, workspaceID, addMark(workspaceTimedOutAnnotation, timedout))
		if err != nil {
			errs = append(errs, fmt.Sprintf("workspaceId=%s: %q", workspaceID, err))
			// don't skip the next step - even if we did not mark the workspace as timed out, we still want to stop it
		}
	}

	if len(errs) > 0 {
		return xerrors.Errorf("error during periodic run:\n%s", strings.Join(errs, "\n\t"))
	}

	return nil
}

// Stop ends the monitor's involvement. A stopped monitor cannot be started again.
func (m *Monitor) Stop() {
	if m.ticker != nil {
		m.ticker.Stop()
	}
}

func workspaceObjectListOptions(namespace string) *client.ListOptions {
	return &client.ListOptions{
		Namespace: namespace,
		LabelSelector: labels.SelectorFromSet(labels.Set{
			markerLabel: "true",
		}),
	}
}

func handleGRPCError(ctx context.Context, err error) error {
	if err == nil {
		return err
	}

	grpcErr, ok := grpc_status.FromError(err)
	if !ok {
		return err
	}

	if grpcErr.Code() == codes.Unavailable {
		span, _ := tracing.FromContext(ctx, "handleGRPCError")
		tracing.FinishSpan(span, &err)

		return xerrors.Errorf("workspace initialization is currently unavailable - please try again")
	}

	return xerrors.Errorf(grpcErr.Message())
}
