// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/workpool"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/internal/util"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"

	"github.com/alecthomas/repr"
	"github.com/golang/protobuf/proto"
	"github.com/opentracing/opentracing-go"
	tracelog "github.com/opentracing/opentracing-go/log"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	grpc_status "google.golang.org/grpc/status"
)

const (
	// lonelyPLISSurvivalTime is the time a "pod lifecycle independent state" config map can exist without
	// a pod. This time refers either the creationTimestamp or (if set) the stoppingSince field of the PLIS.
	lonelyPLISSurvivalTime = 60 * time.Minute

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
	podwatch  watch.Interface
	cfgwatch  watch.Interface
	eventpool *workpool.EventWorkerPool
	ticker    *time.Ticker

	doShutdown  util.AtomicBool
	didShutdown chan bool

	inPhaseSpans     map[string]opentracing.Span
	inPhaseSpansLock sync.Mutex

	probeMap     map[string]context.CancelFunc
	probeMapLock sync.Mutex

	initializerMap     map[string]struct{}
	initializerMapLock sync.Mutex

	finalizerMap     map[string]context.CancelFunc
	finalizerMapLock sync.Mutex

	headlessListener *HeadlessListener

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
		manager:          m,
		ticker:           time.NewTicker(monitorInterval),
		inPhaseSpans:     make(map[string]opentracing.Span),
		probeMap:         make(map[string]context.CancelFunc),
		initializerMap:   make(map[string]struct{}),
		finalizerMap:     make(map[string]context.CancelFunc),
		didShutdown:      make(chan bool, 1),
		headlessListener: NewHeadlessListener(m.Clientset, m.Config.Namespace),

		OnError: func(err error) {
			log.WithError(err).Error("workspace monitor error")
		},
	}
	res.headlessListener.OnHeadlessLog = res.handleHeadlessLog
	res.headlessListener.OnHeadlessDone = func(pod *corev1.Pod, failed bool) {
		err := res.actOnHeadlessDone(pod, failed)
		if err != nil {
			log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).WithError(err).Error("cannot handle headless workspace event")
		}
	}
	res.eventpool = workpool.NewEventWorkerPool(res.handleEvent)

	return &res, nil
}

func (m *Monitor) connectToPodWatch() error {
	podwatch, err := m.manager.Clientset.CoreV1().Pods(m.manager.Config.Namespace).Watch(workspaceObjectListOptions())
	if err != nil {
		return xerrors.Errorf("cannot watch pods: %w", err)
	}

	m.podwatch = podwatch
	return nil
}

func (m *Monitor) connectToConfigMapWatch() error {
	cfgwatch, err := m.manager.Clientset.CoreV1().ConfigMaps(m.manager.Config.Namespace).Watch(workspaceObjectListOptions())
	if err != nil {
		return xerrors.Errorf("cannot watch config maps: %w", err)
	}

	m.cfgwatch = cfgwatch
	return nil
}

// Start starts up the monitor which will check the overall workspace state (on event or periodically).
// Use Stop() to stop the monitor gracefully.
func (m *Monitor) Start() error {
	// mark startup so that we can do proper workspace timeouting
	m.startup = time.Now().UTC()

	m.eventpool.Start(eventpoolWorkers)
	err := m.connectToPodWatch()
	if err != nil {
		return xerrors.Errorf("cannot start workspace monitor: %w", err)
	}
	err = m.connectToConfigMapWatch()
	if err != nil {
		return xerrors.Errorf("cannot start workspace monitor: %w", err)
	}

	// our activity state is ephemeral and as such we need to mark existing workspaces active after we have
	// restarted (i.e. cleared our state). If we didn't do this, we'd time out all workspaces at ws-manager
	// startup, see: https://github.com/gitpod-io/gitpod/issues/2537 and https://github.com/gitpod-io/gitpod/issues/2619
	err = m.manager.markAllWorkspacesActive()
	if err != nil {
		log.WithError(err).Warn("cannot mark all existing workspaces active - this will wrongly time out user's workspaces")
	}

	go func() {
		// we'll keep running until we're shut down
		for !m.shouldShutdown() {
			// make the monitor run
			m.run()
			// we've come out of the run loop - must mean we got disconnected
			log.Info("connection to Kubernetes master lost")

			reconnectionInterval := time.Duration(m.manager.Config.ReconnectionInterval)
			if reconnectionInterval == 0 {
				reconnectionInterval = 1 * time.Second
			}
			// we got disconnected but don't want to shutdown - reconnect until we succeed
			for reconnected := false; !reconnected && !m.shouldShutdown(); {
				log := log.WithField("watch", "pods")

				err := m.connectToPodWatch()
				if err != nil {
					log.WithError(err).Warn("monitor cannot reconnect to Kubernetes - will try again")
					time.Sleep(reconnectionInterval)
					continue
				}

				log.Info("connection to Kubernetes master is reestablished")
				reconnected = true
			}
			for reconnected := false; !reconnected && !m.shouldShutdown(); {
				log := log.WithField("watch", "configmaps")

				err := m.connectToConfigMapWatch()
				if err != nil {
					log.WithError(err).Warn("monitor cannot reconnect to Kubernetes - will try again")
					time.Sleep(reconnectionInterval)
					continue
				}

				log.Info("connection to Kubernetes master is reestablished")
				reconnected = true
			}

			if m.shouldShutdown() {
				// we're asked to shut down - let's do this gracefully
				log.Debug("monitor was asked to shut down - ended main loop")
				m.eventpool.Stop()
				m.didShutdown <- true
				return
			}
		}
	}()
	return nil
}

// run checks the overall workspace state (on event or periodically). Run is best called as a goroutine.
// Note: this function serializes the handling of pod/config map events per workspace, but not globally.
func (m *Monitor) run() {
	continueListening := true
	for continueListening {
		if m.podwatch == nil || m.cfgwatch == nil || m.ticker == nil || m.shouldShutdown() {
			// we got shut down
			return
		}

		select {
		case evt := <-m.podwatch.ResultChan():
			continueListening = m.enqueueEvent(evt)
		case evt := <-m.cfgwatch.ResultChan():
			continueListening = m.enqueueEvent(evt)
		case <-m.ticker.C:
			go m.doHousekeeping(context.Background())
		}
	}
}

// enqueueEvent adds the event to the appropriate queue in the event pool
func (m *Monitor) enqueueEvent(evt watch.Event) (continueListening bool) {
	if evt.Type == watch.Error || evt.Object == nil {
		// we got disconnected from Kubernetes
		return false
	}

	continueListening = true

	var queue string
	pod, ok := evt.Object.(*corev1.Pod)
	if ok {
		queue = pod.Annotations[workspaceIDAnnotation]
	}
	cfgmap, ok := evt.Object.(*corev1.ConfigMap)
	if ok {
		queue = cfgmap.Annotations[workspaceIDAnnotation]
	}
	if queue == "" {
		m.OnError(xerrors.Errorf("event object has no name: %v", evt))
		return
	}

	m.eventpool.Add(queue, evt)
	return
}

// handleEvent dispatches an event to the corresponding event handler based on the event object kind.
// This function is expected to be called from a worker of the event pool.
func (m *Monitor) handleEvent(evt watch.Event) {
	var err error
	switch evt.Object.(type) {
	case *corev1.Pod:
		err = m.onPodEvent(evt)
	case *corev1.ConfigMap:
		err = m.onConfigMapEvent(evt)
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
		repr.Println(evt)
		return fmt.Errorf("received non-pod event")
	}

	wso, err := m.manager.getWorkspaceObjects(pod)
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
		// In case we missed this event, we'll wake up to a situation where the PLIS exists, but the pod doesn't.
		// actOnConfigMapEvent will handle such situations properly.
		status.Conditions.Deployed = api.WorkspaceConditionBool_FALSE
	}

	// during pod startup we create spans for each workspace phase (e.g. creating/image-pull).
	m.maintainInPhaseSpan(status, wso)

	// make sure we tell our clients that things changed - no matter if there's an error in our
	// subsequent handling of the matter or not. However, we want to respond quickly to events,
	// thus we start OnChange as a goroutine.
	// BEWARE beyond this point one must not modify status anymore - we've already sent it out BEWARE
	span := m.traceWorkspace("handle-"+status.Phase.String(), wso)
	ctx := opentracing.ContextWithSpan(context.Background(), span)
	onChangeDone := make(chan bool)
	go func() {
		// We call OnChange in a Go routine to make sure it doesn't block our internal handling of events.
		m.manager.OnChange(ctx, status)
		onChangeDone <- true
	}()

	m.writeEventTraceLog(status, wso)
	err = m.actOnPodEvent(ctx, status, wso)

	// To make the tracing work though we have to re-sync with OnChange. But we don't want OnChange to block our event
	// handling, thus we wait for it to finish in a Go routine.
	go func() {
		<-onChangeDone
		span.Finish()
	}()

	return err
}

// maintainInPhaseSpan maintains the spans across each workspace phase (e.g. creating).
func (m *Monitor) maintainInPhaseSpan(status *api.WorkspaceStatus, wso *workspaceObjects) {
	wsi, hasWSI := wso.WorkspaceID()
	if !hasWSI {
		return
	}

	m.inPhaseSpansLock.Lock()
	defer m.inPhaseSpansLock.Unlock()

	// finish the old span
	ipspan, ok := m.inPhaseSpans[wsi]
	if ok {
		ipspan.Finish()
	}

	if status.Phase == api.WorkspacePhase_RUNNING {
		// we're up and running and don't care for phase spans anymore, hence don't start a new one
		return
	}

	// create the new one
	ipspan = m.traceWorkspace(fmt.Sprintf("phase-%s", status.Phase.String()), wso)
	m.inPhaseSpans[wsi] = ipspan
	ipspan.SetTag("pullingImage", status.Conditions.PullingImages == api.WorkspaceConditionBool_TRUE)
}

// actOnPodEvent performs actions when a kubernetes event comes in. For example we shut down failed workspaces or start
// polling the ready state of initializing ones.
func (m *Monitor) actOnPodEvent(ctx context.Context, status *api.WorkspaceStatus, wso *workspaceObjects) (err error) {
	pod := wso.Pod

	span, ctx := tracing.FromContext(ctx, "actOnPodEvent")
	defer tracing.FinishSpan(span, &err)
	log := log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta))

	workspaceID, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		return fmt.Errorf("cannot act on pod %s: has no %s annotation", pod.Name, workspaceIDAnnotation)
	}

	if status.Phase == api.WorkspacePhase_STOPPING || status.Phase == api.WorkspacePhase_STOPPED {
		// With regards to workspace failure, we don't do anything if the workspace is already stopping/stopped
		// only if the workspace is in any other state do we care
		//
		// Beware: do not else-if this condition with the other phases as we don't want the stop
		//         login in any other phase, too.
	} else if status.Conditions.Failed != "" || status.Conditions.Timeout != "" {
		// the workspace has failed to run/start - shut it down
		// we should mark the workspace as failedBeforeStopping - this way the failure status will persist
		// while we stop the workspace
		_, hasFailureAnnotation := pod.Annotations[workspaceFailedBeforeStoppingAnnotation]
		if status.Conditions.Failed != "" && !hasFailureAnnotation {
			// If this marking operation failes that's ok - we'll still continue to shut down the workspace.
			// The failure message won't persist while stopping the workspace though.
			err := m.manager.markWorkspace(workspaceID, addMark(workspaceFailedBeforeStoppingAnnotation, "true"))
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
		// It is important that we do not fail here if the pod is already gone, i.e. when we lost the race. The
		// stopping PLIS update MUST still happen in this case.
		err := m.manager.stopWorkspace(ctx, workspaceID, stopWorkspaceNormallyGracePeriod)
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
				err = m.manager.markWorkspace(workspaceID, addMark(workspaceExplicitFailAnnotation, err.Error()))
				if err != nil {
					log.WithError(err).Warn("was unable to mark workspace as failed")
				}
			}
		}()
	}

	if status.Phase == api.WorkspacePhase_INITIALIZING {
		if wso.IsWorkspaceHeadless() {
			return
		}

		// workspace is initializing (i.e. running but without the ready annotation yet). Start probing and depending on
		// the result add the appropriate annotation or stop the workspace. waitForWorkspaceReady takes care that it does not
		// run for the same workspace multiple times.
		go func() {
			err := m.waitForWorkspaceReady(ctx, pod)

			if err != nil {
				// workspace initialization failed, which means the workspace as a whole failed
				err = m.manager.markWorkspace(workspaceID, addMark(workspaceExplicitFailAnnotation, err.Error()))
				if err != nil {
					log.WithError(err).Warn("was unable to mark workspace as failed")
				}
			}
		}()
	}

	if status.Phase == api.WorkspacePhase_RUNNING {
		if wso.IsWorkspaceHeadless() {
			// this is a headless workspace, which means that instead of probing for it becoming available, we'll listen to its log
			// output, parse it and forward it. Listen() is idempotent.
			err := m.headlessListener.Listen(context.Background(), pod)
			if err != nil {
				return xerrors.Errorf("cannot establish listener: %w", err)
			}
		}

		if !wso.IsWorkspaceHeadless() {
			tracing.LogEvent(span, "removeTraceAnnotation")
			// once a regular workspace is up and running, we'll remove the traceID information so that the parent span
			// ends once the workspace has started
			err := m.manager.markWorkspace(workspaceID, deleteMark(wsk8s.TraceIDAnnotation))
			if err != nil {
				log.WithError(err).Warn("was unable to remove traceID annotation from workspace")
			}
		}
	}

	if status.Phase == api.WorkspacePhase_STOPPING {
		// This may be the last pod-based status we'll ever see for this workspace, so we must store it in the
		// plis config map which in turn will trigger the status update mechanism. Because we serialize events
		// for each workspace, the cfgmap event won't be handled before this function finishes.
		annotations := make([]*annotation, 0)
		if v, neverReady := pod.Annotations[workspaceNeverReadyAnnotation]; neverReady {
			// workspace has never been ready, mark it as such.
			// Note: this is the reason we're using a never-ready flag instead of a "positive ready" flag.
			//       If we don't copy this flag for some reason (e.g. because we missed the stopping event),
			//       we'll still think the workspace ready, i.e. it's ready by default.
			annotations = append(annotations, addMark(workspaceNeverReadyAnnotation, v))
		}

		err := m.manager.patchPodLifecycleIndependentState(ctx, status.Id, func(plis *podLifecycleIndependentState) (needsUpdate bool) {
			needsUpdate = false

			if !reflect.DeepEqual(plis.LastPodStatus, status) {
				plis.LastPodStatus = status
				needsUpdate = true
			}

			hostIP := pod.Status.HostIP
			if hostIP != "" && plis.HostIP != hostIP {
				plis.HostIP = hostIP
				needsUpdate = true
			}

			if plis.StoppingSince == nil {
				t := time.Now().UTC()
				plis.StoppingSince = &t
				needsUpdate = true
			}

			return
		}, annotations...)
		if err != nil {
			return xerrors.Errorf("cannot update pod lifecycle independent state: %w", err)
		}
	}

	return nil
}

// actOnHeadlessDone performs actions when a headless workspace finishes.
func (m *Monitor) actOnHeadlessDone(pod *corev1.Pod, failed bool) (err error) {
	wso := workspaceObjects{Pod: pod}

	// This timeout is really a catch-all safety net in case any of the ws-daemon interaction
	// goes out of hand. Really it should never play a role.
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Hour)
	defer cancel()

	span := m.traceWorkspace("actOnHeadlessDone", &wso)
	ctx = opentracing.ContextWithSpan(ctx, span)
	defer tracing.FinishSpan(span, &err)
	log := log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta))

	id, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		return xerrors.Errorf("cannot get %s annotation from %s", workspaceIDAnnotation, pod.Name)
	}

	// Headless workspaces need to maintain their "failure state" so that we can provide feedback to users down the road.
	// That means that the moment anything goes wrong with headless workspaces we need to fail the workspace to issue a status update.
	handleFailure := func(msg string) error {
		// marking the workspace as tasked failed will cause the workspace to fail as a whole which in turn will make the monitor actually stop it
		err := m.manager.markWorkspace(id, addMark(workspaceExplicitFailAnnotation, msg))
		if err == nil || isKubernetesObjNotFoundError(err) {
			// workspace is gone - we're good
			return nil
		}

		// log error and try to stop the workspace
		log.WithError(err).Warn("cannot mark headless workspace as failed - stopping myself")
		err = m.manager.stopWorkspace(context.Background(), id, stopWorkspaceNormallyGracePeriod)
		if err == nil || isKubernetesObjNotFoundError(err) {
			// workspace is gone - we're good
			return nil
		}

		// we've failed to mark the workspace or remove it - that's bad
		log.WithError(err).Error("was unable to mark workspace as failed or stop it")
		return err
	}

	// headless build is done - if this is a prebuild take a snapshot and tell the world
	tpe, err := wso.WorkspaceType()
	if err != nil {
		// We know we're working with a headless workspace, but don't know its type. This really should never happen.
		// For now we'll just assume this is a headless workspace. Better we create one snapshot too many that too few.
		tracing.LogError(span, err)
		log.WithError(err).Warn("cannot determine workspace type - assuming this is a prebuild")
		tpe = api.WorkspaceType_PREBUILD
	}
	if tpe == api.WorkspaceType_PREBUILD {
		snc, err := m.manager.connectToWorkspaceDaemon(ctx, wso)
		if err != nil {
			tracing.LogError(span, err)
			return handleFailure(fmt.Sprintf("cannot take snapshot: %v", err))
		}
		res, err := snc.TakeSnapshot(ctx, &wsdaemon.TakeSnapshotRequest{Id: id})
		if err != nil {
			tracing.LogError(span, err)
			return handleFailure(fmt.Sprintf("cannot take snapshot: %v", err))
		}

		err = m.manager.markWorkspace(id, addMark(workspaceSnapshotAnnotation, res.Url))
		if err != nil {
			tracing.LogError(span, err)
			log.WithError(err).Warn("cannot mark headless workspace with snapshot - that's one prebuild lost")
			return handleFailure(fmt.Sprintf("cannot remember snapshot: %v", err))
		}
	}

	// if the workspace task failed, that means the headless workspace failed
	if failed {
		err := handleFailure("task failed")
		if err != nil {
			tracing.LogError(span, err)
			log.WithError(err).Warn("cannot stop failed headless workspace")
		}
	}

	// healthy prebuilds don't fail the workspace, thus we have to stop them ourselves
	err = m.manager.stopWorkspace(ctx, id, stopWorkspaceNormallyGracePeriod)
	if err != nil {
		log.WithError(err).Error("unable to stop finished headless workspace")
	}

	return nil
}

func (m *Monitor) handleHeadlessLog(pod *corev1.Pod, msg string) {
	id, ok := pod.Annotations[workspaceIDAnnotation]
	if !ok {
		log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Errorf("cannot get %s annotation from %s", workspaceIDAnnotation, pod.Name)
		return
	}

	evt := &api.WorkspaceLogMessage{
		Id:       id,
		Metadata: getWorkspaceMetadata(pod),
		Message:  msg,
	}
	m.manager.OnWorkspaceLog(context.Background(), evt)
}

// onConfigMapEvent interpretes Kubernetes events regarding pod lifecycle independent state,
// translates and broadcasts them, and acts based on them. This is the pod independented counterpart to
// onPodEvent, and only does something if there is no pod in place.
func (m *Monitor) onConfigMapEvent(evt watch.Event) error {
	cfgmap, ok := evt.Object.(*corev1.ConfigMap)
	if !ok {
		return fmt.Errorf("received non-configmap event")
	}
	// Kubernetes sets a deletionGracePeriod on configmaps prior to deleting them. That's a modification
	// we don't care about as it does not add to the state of a workspace.
	if cfgmap.DeletionGracePeriodSeconds != nil {
		return nil
	}

	// configmap events only play a role when no pod exists anymore. Otherwise we could not
	// guarantee a stable order of states, as we complete the workspace objects when we handle the events.
	//
	// Consider the following sequence:
	// 	pod event     fromEvt(pod)=rev1 fromK8S(cfgmap)=none
	// 	cfg map event fromK8S(pod)=rev3 fromEvt(cfgmap)=rev1
	// 	pod event     fromEvt(pod)=rev2 fromK8S(cfgmap)=rev1
	//	pod event     fromEvt(pod)=rev3 fromK8S(cfgmap)=rev1
	//
	// In this sequence we would intermittently commpute our state from a new version of the pod. This would break
	// (and has broken) a stable order of status.
	wso := &workspaceObjects{PLIS: cfgmap}
	err := m.manager.completeWorkspaceObjects(wso)
	if err != nil {
		return xerrors.Errorf("cannot handle workspace event: %w", err)
	}
	if wso.Pod != nil {
		return nil
	}

	status, err := m.manager.getWorkspaceStatus(*wso)
	if err != nil {
		log.WithError(err).WithFields(wso.GetOWI()).Error("onConfigMapEvent cannot get status")
		return xerrors.Errorf("cannot handle workspace event: %w", err)
	}

	// make sure we tell our clients that things changed - no matter if there's an error in our
	// subsequent handling of the matter or not. However, we want to respond quickly to events,
	// thus we start OnChange as a goroutine.
	// BEWARE beyond this point one must not modify status anymore - we've already sent it out BEWARE
	span := m.traceWorkspace(status.Phase.String(), wso)
	ctx := opentracing.ContextWithSpan(context.Background(), span)
	onChangeDone := make(chan bool)
	go func() {
		// We call OnChange in a Go routine to make sure it doesn't block our internal handling of events.
		m.manager.OnChange(ctx, status)
		onChangeDone <- true
	}()

	m.writeEventTraceLog(status, wso)
	err = m.actOnConfigMapEvent(ctx, status, wso)

	// To make the tracing work though we have to re-sync with OnChange. But we don't want OnChange to block our event
	// handling, thus we wait for it to finish in a Go routine.
	go func() {
		<-onChangeDone
		span.Finish()
	}()

	return err
}

// actOnConfigMapEvent performs actions when a status change was triggered by a config map (PLIS) update, e.g. clean up the
// PLIS config map if the workspace is stopped.
// BEWARE: this function only gets called when there's no workspace pod!
func (m *Monitor) actOnConfigMapEvent(ctx context.Context, status *api.WorkspaceStatus, wso *workspaceObjects) (err error) {
	cfgmap := wso.PLIS

	//nolint:ineffassign,staticcheck
	span, ctx := tracing.FromContext(ctx, "actOnConfigMapEvent")
	defer tracing.FinishSpan(span, &err)

	doDelete := func() error {
		span.SetTag("deletingObject", true)

		// the workspace has stopped, we don't need the workspace state configmap anymore
		propagationPolicy := metav1.DeletePropagationForeground
		err = m.manager.Clientset.CoreV1().ConfigMaps(m.manager.Config.Namespace).Delete(cfgmap.Name, &metav1.DeleteOptions{PropagationPolicy: &propagationPolicy})
		if err != nil && !isKubernetesObjNotFoundError(err) {
			return xerrors.Errorf("cannot delete PLIS config map: %w", err)
		}

		// free all allocated ingress ports
		if wso.TheiaService != nil {
			m.manager.ingressPortAllocator.FreeAllocatedPorts(wso.TheiaService.Name)
		}
		if wso.PortsService != nil {
			m.manager.ingressPortAllocator.FreeAllocatedPorts(wso.PortsService.Name)
		}

		return nil
	}

	// Beware: for this finalization mechanism to work, the pod going out has to trigger a config map event. Because we have a
	//         workspace condition "deployed" which changes state when the pod goes away, and during startup of wsman we'll enter here,
	//         that will be the case. It does feel rather frickle though.
	if status.Phase == api.WorkspacePhase_STOPPING {
		// Handling timeouts in config map events is tricky as we must not rely on the workspace status timeout condition. That condition
		// could come from a regular timeout and does not indicate a timeout incurred while stopping. Timeouts which happen while we're stopping
		// become annotations on the PLIS configmap and not part of the serialized PLIS content.
		if _, ok := cfgmap.Annotations[workspaceTimedOutAnnotation]; ok {
			// this workspace has timed out while stopping, thus we no longer try and remove the PLIS config map
			return doDelete()
		}

		// after the workspace pod is gone, we have to initiate the last workspace backup and the disposal of
		// of the workspce content
		go m.finalizeWorkspaceContent(ctx, wso)
	}

	if status.Phase == api.WorkspacePhase_STOPPED {
		return doDelete()
	}

	return nil
}

// doHouskeeping is called regularly by the monitor and removes timed out or dangling workspaces/services
func (m *Monitor) doHousekeeping(ctx context.Context) {
	span, ctx := tracing.FromContext(ctx, "doHousekeeping")
	defer tracing.FinishSpan(span, nil)

	err := m.markTimedoutWorkspaces(ctx)
	if err != nil {
		m.OnError(err)
	}

	err = m.deleteDanglingServices()
	if err != nil {
		m.OnError(err)
	}

	err = m.deleteDanglingPodLifecycleIndependentState()
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
				isGitpodVar := strings.HasPrefix(env.Name, "GITPOD_") || strings.HasPrefix(env.Name, "THEIA_")
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
		log.WithField("evt", entry).Debug("event trace log")
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
	if traceID == "" && wso.PLIS != nil {
		traceID = wso.PLIS.Annotations[wsk8s.TraceIDAnnotation]
	}
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
	tracing.LogKV(span, "occasion", occasion)

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

	tracing.LogEvent(span, "probeDone")
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
	tracing.LogEvent(span, "contentInitDone")

	// workspace is ready - mark it as such
	err = m.manager.markWorkspace(workspaceID, deleteMark(workspaceNeverReadyAnnotation))
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
	span, ctx := tracing.FromContext(ctx, "initializeWorkspace")
	defer tracing.FinishSpan(span, &err)

	_, fullWorkspaceBackup := pod.Labels[fullWorkspaceBackupAnnotation]
	span.SetTag("fullWorkspaceBackup", fullWorkspaceBackup)
	_, withUsernamespace := pod.Annotations[withUsernamespaceAnnotation]
	span.SetTag("withUsernamespace", withUsernamespace)

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
		span.LogKV("done", "already initializing")
		return nil
	}

	err = retryIfUnavailable(ctx, func(ctx context.Context) error {
		_, err = snc.InitWorkspace(ctx, &wsdaemon.InitWorkspaceRequest{
			Id: workspaceID,
			Metadata: &wsdaemon.WorkspaceMetadata{
				Owner:  workspaceMeta.Owner,
				MetaId: workspaceMeta.MetaId,
			},
			Initializer:         &initializer,
			FullWorkspaceBackup: fullWorkspaceBackup,
			ContentManifest:     contentManifest,
			ShiftfsMarkMount:    withUsernamespace,
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

// finalizeWorkspaceContent talks to a ws-daemon daemon on the node of the pod and initializes the workspace content.
func (m *Monitor) finalizeWorkspaceContent(ctx context.Context, wso *workspaceObjects) {
	span, ctx := tracing.FromContext(ctx, "finalizeWorkspaceContent")
	defer tracing.FinishSpan(span, nil)

	workspaceID, ok := wso.WorkspaceID()
	if !ok {
		tracing.LogError(span, xerrors.Errorf("cannot find %s annotation", workspaceIDAnnotation))
		log.WithFields(wso.GetOWI()).Errorf("cannot find %s annotation", workspaceIDAnnotation)
	}

	var fullWorkspaceBackup bool
	if wso.Pod != nil {
		if _, ok := wso.Pod.Labels[fullWorkspaceBackupAnnotation]; ok {
			fullWorkspaceBackup = true
		}
	}
	if wso.PLIS != nil {
		if _, ok := wso.PLIS.Labels[fullWorkspaceBackupAnnotation]; ok {
			fullWorkspaceBackup = true
		}
	}
	if fullWorkspaceBackup {
		err := m.manager.patchPodLifecycleIndependentState(ctx, workspaceID, func(plis *podLifecycleIndependentState) (needsUpdate bool) {
			plis.FinalBackupComplete = true
			needsUpdate = true
			return
		})
		if err != nil {
			log.WithError(err).Error("was unable to set pod lifecycle independent state - this will break someone's experience")
		}
		return
	}

	doBackup := wso.WasEverReady() && !wso.IsWorkspaceHeadless()
	doFinalize := func() (worked bool, gitStatus *csapi.GitStatus, err error) {
		m.finalizerMapLock.Lock()
		_, alreadyFinalizing := m.finalizerMap[workspaceID]
		if alreadyFinalizing {
			m.finalizerMapLock.Unlock()
			return false, nil, nil
		}

		// Maybe the workspace never made it to a phase where we actually initialized a workspace.
		// Assuming that once we've had a hostIP we've spoken to ws-daemon it's safe to assume that if
		// we don't have a hostIP we don't need to dipose the workspace.
		// Obviously that only holds if we do not require a backup. If we do require one, we want to
		// fail as loud as we can in this case.
		if !doBackup && wso.HostIP() == "" {
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

		// DiposeWorkspace will "degenerate" to a simple wait if the finalization/disposal process is already running.
		// This is unlike the initialization process where we wait for things to finish in a later phase.
		resp, err := snc.DisposeWorkspace(ctx, &wsdaemon.DisposeWorkspaceRequest{
			Id:     workspaceID,
			Backup: doBackup,
		})
		if resp != nil {
			gitStatus = resp.GitStatus
		}

		// we're done disposing - remove from the finalizerMap
		m.finalizerMapLock.Lock()
		delete(m.finalizerMap, workspaceID)
		m.finalizerMapLock.Unlock()

		return true, gitStatus, err
	}

	var (
		dataloss    bool
		backupError error
		gitStatus   *csapi.GitStatus
	)
	for i := 0; i < wsdaemonMaxAttempts; i++ {
		tracing.LogKV(span, "attempt", strconv.Itoa(i))
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
		if doBackup && isGRPCError {
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

	err := m.manager.patchPodLifecycleIndependentState(ctx, workspaceID, func(plis *podLifecycleIndependentState) (needsUpdate bool) {
		plis.FinalBackupComplete = true
		needsUpdate = true

		if plis.LastPodStatus != nil {
			plis.LastPodStatus.Repo = gitStatus
			needsUpdate = true
		}

		if backupError != nil {
			if dataloss {
				plis.FinalBackupFailure = backupError.Error()
				needsUpdate = true
			} else {
				// internal errors make no difference to the user experience. The backup still worked, we just messed up some
				// state management or cleanup. No need to worry the user.
				log.WithError(backupError).WithFields(wso.GetOWI()).Warn("internal error while disposing workspace content")
				tracing.LogError(span, backupError)
			}
		}

		return
	})
	if err != nil {
		log.WithError(err).WithFields(wso.GetOWI()).Error("was unable to set pod lifecycle independent state - this will break someone's experience")
	}
}

// deleteDanglingServices removes services for which there is no corresponding workspace pod anymore
func (m *Monitor) deleteDanglingServices() error {
	endpoints, err := m.manager.Clientset.CoreV1().Endpoints(m.manager.Config.Namespace).List(workspaceObjectListOptions())
	if err != nil {
		return xerrors.Errorf("deleteDanglingServices: %w", err)
	}

	propagationPolicy := metav1.DeletePropagationForeground
	servicesClient := m.manager.Clientset.CoreV1().Services(m.manager.Config.Namespace)

	for _, e := range endpoints.Items {
		hasReadyEndpoint := false
		for _, s := range e.Subsets {
			hasReadyEndpoint = len(s.Addresses) > 0
		}
		if hasReadyEndpoint {
			continue
		}

		workspaceID, ok := e.Labels[wsk8s.WorkspaceIDLabel]
		if !ok {
			m.OnError(fmt.Errorf("service endpoint %s does not have %s label", e.Name, wsk8s.WorkspaceIDLabel))
			continue
		}
		_, err := m.manager.findWorkspacePod(workspaceID)
		if !isKubernetesObjNotFoundError(err) {
			continue
		}

		if m.manager.Config.DryRun {
			log.WithFields(log.OWI("", "", workspaceID)).WithField("name", e.Name).Info("should have deleted dangling service but this is a dry run")
			continue
		}

		// this relies on the Kubernetes convention that endpoints have the same name as their services
		err = servicesClient.Delete(e.Name, &metav1.DeleteOptions{PropagationPolicy: &propagationPolicy})
		if err != nil {
			m.OnError(xerrors.Errorf("deleteDanglingServices: %w", err))
			continue
		}
		log.WithFields(log.OWI("", "", workspaceID)).WithField("name", e.Name).Info("deleted dangling service")
	}

	return nil
}

// deleteDanglingPodLifecycleIndependentState removes PLIS config maps for which no pod exists and which have exceded lonelyPLISSurvivalTime
func (m *Monitor) deleteDanglingPodLifecycleIndependentState() error {
	pods, err := m.manager.Clientset.CoreV1().Pods(m.manager.Config.Namespace).List(workspaceObjectListOptions())
	if err != nil {
		return xerrors.Errorf("deleteDanglingPodLifecycleIndependentState: %w", err)
	}
	podIdx := make(map[string]*corev1.Pod)
	for _, p := range pods.Items {
		workspaceID, ok := p.Labels[wsk8s.WorkspaceIDLabel]
		if !ok {
			log.WithFields(wsk8s.GetOWIFromObject(&p.ObjectMeta)).WithField("pod", p).Warn("found workspace object pod without workspaceID label")
			continue
		}

		podIdx[workspaceID] = &p
	}

	cfgmapsClient := m.manager.Clientset.CoreV1().ConfigMaps(m.manager.Config.Namespace)
	plisConfigmaps, err := cfgmapsClient.List(workspaceObjectListOptions())
	if err != nil {
		return xerrors.Errorf("deleteDanglingPodLifecycleIndependentState: %w", err)
	}

	for _, cfgmap := range plisConfigmaps.Items {
		workspaceID, ok := cfgmap.Labels[wsk8s.WorkspaceIDLabel]
		if !ok {
			m.OnError(xerrors.Errorf("PLIS config map %s does not have %s label", cfgmap.Name, wsk8s.WorkspaceIDLabel))
			continue
		}

		_, hasPod := podIdx[workspaceID]
		if hasPod {
			continue
		}

		referenceTime := cfgmap.CreationTimestamp.Time
		plis, err := unmarshalPodLifecycleIndependentState(&cfgmap)
		if err != nil {
			m.OnError(xerrors.Errorf("cannot get PLIS configmap age: %w", err))
			continue
		}
		if plis != nil && plis.StoppingSince != nil {
			referenceTime = *plis.StoppingSince
		}
		age := time.Since(referenceTime)

		if age < lonelyPLISSurvivalTime {
			continue
		}

		// Note: some workspace probably failed to stop if we have a dangling PLIS.
		//       Prior to deletion we should send a final stopped update.

		propagationPolicy := metav1.DeletePropagationForeground
		err = cfgmapsClient.Delete(cfgmap.Name, &metav1.DeleteOptions{PropagationPolicy: &propagationPolicy})
		if err != nil {
			m.OnError(xerrors.Errorf("cannot delete too old PLIS config map: %w", err))
			continue
		}
		log.WithFields(log.OWI("", "", workspaceID)).WithField("age", age).WithField("name", cfgmap.Name).Info("deleted dangling PLIS config map")
	}

	return nil
}

// markTimedoutWorkspaces finds workspaces which haven't been active recently and marks them as timed out
func (m *Monitor) markTimedoutWorkspaces(ctx context.Context) (err error) {
	span, ctx := tracing.FromContext(ctx, "markTimedoutWorkspaces")
	defer tracing.FinishSpan(span, nil)

	pods, err := m.manager.Clientset.CoreV1().Pods(m.manager.Config.Namespace).List(workspaceObjectListOptions())
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
		err = m.manager.markWorkspace(workspaceID, addMark(workspaceTimedOutAnnotation, timedout))
		if err != nil {
			errs = append(errs, fmt.Sprintf("workspaceId=%s: %q", workspaceID, err))
			// don't skip the next step - even if we did not mark the workspace as timed out, we still want to stop it
		}
	}

	// timeout PLIS only workspaces
	allPlis, err := m.manager.Clientset.CoreV1().ConfigMaps(m.manager.Config.Namespace).List(workspaceObjectListOptions())
	if err != nil {
		return xerrors.Errorf("stopTimedoutWorkspaces: %w", err)
	}
	for _, plis := range allPlis.Items {
		workspaceID, ok := plis.Annotations[workspaceIDAnnotation]
		if !ok {
			log.WithFields(wsk8s.GetOWIFromObject(&plis.ObjectMeta)).WithError(err).Errorf("while checking if timed out: found workspace PLIS without %s annotation", workspaceIDAnnotation)
			errs = append(errs, fmt.Sprintf("cannot check if PLIS %s is timed out: has no %s annotation", plis.Name, workspaceIDAnnotation))
			continue
		}

		if _, ok := idx[workspaceID]; ok {
			// PLIS still has a corresponding pod, thus we resort to the regular "mark as timed out" mechanism
			continue
		}

		timedout, err := m.manager.isWorkspaceTimedOut(workspaceObjects{PLIS: &plis})
		if err != nil {
			errs = append(errs, fmt.Sprintf("workspaceId=%s: %q", workspaceID, err))
			continue
		}
		if timedout == "" {
			continue
		}

		// we have PLIS-only workspace which is timed out. Patching the PLIS config map will trigger actOnConfigMapEvent which in turn will remove the PLIS.
		err = m.manager.patchPodLifecycleIndependentState(ctx, workspaceID, nil, addMark(workspaceTimedOutAnnotation, timedout))
		if err != nil {
			errs = append(errs, fmt.Sprintf("workspaceId=%s: %q", workspaceID, err))
		}
	}

	if len(errs) > 0 {
		return xerrors.Errorf("error during periodic run:\n%s", strings.Join(errs, "\n\t"))
	}

	return nil
}

// Stop ends the monitor's involvement. A stopped monitor cannot be started again.
func (m *Monitor) Stop() {
	m.doShutdown.Set(true)

	if m.podwatch != nil {
		m.podwatch.Stop()
	}
	if m.ticker != nil {
		m.ticker.Stop()
	}

	<-m.didShutdown
	m.podwatch = nil
	m.ticker = nil
}

func (m *Monitor) shouldShutdown() bool {
	return m.doShutdown.Get()
}

func workspaceObjectListOptions() metav1.ListOptions {
	return metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=true", markerLabel),
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
