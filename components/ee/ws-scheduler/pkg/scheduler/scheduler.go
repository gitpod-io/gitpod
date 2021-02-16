// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

// Helpful material:
//    https://github.com/banzaicloud/random-scheduler/blob/v0.2/cmd/scheduler/main.go
//    https://github.com/kubernetes/kubernetes/blob/master/pkg/scheduler/scheduler.go
//    https://borismattijssen.github.io/articles/kubernetes-informers-controllers-reflectors-stores

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	k8sinternal "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler/internal"
	metrics "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler/metrics"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"
	tracelog "github.com/opentracing/opentracing-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"
	infov1 "k8s.io/client-go/informers/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	v1helper "k8s.io/kubernetes/pkg/apis/core/v1/helper"
)

const (
	// the time a failed scheduling attempt has to wait before it is re-tried initially
	queueInitialBackoff = 1 * time.Second

	// the time a failed scheduling attempt has to wait before it is re-tried at most
	queueMaximumBackoff = 4 * time.Second

	// priorityOffsetRegularWorkspace ensures workspaces
	priorityOffsetRegularWorkspace = 100000

	// priorityOffsetNonRegularWorkspace ensures non-regular workspaces are preferred over non-workspaces pods, but do
	// not compete with regular workspaces
	priorityOffsetNonRegularWorkspace = 1000

	// resyncPeriod is the time that the informers will look back when after reconnecting. In essence it's the time
	// that we expect to ever be disconnected from Kubernetes.
	resyncPeriod = 5 * time.Minute

	// This value serves as safety-buffer to make sure we do not overbook nodes.
	// Test have shown that we tend to do that, allthough we currently are not able to understand why that is the case.
	// It seems that "available RAM" calculation is slightly off between kubernetes master and scheduler
	defaultRAMSafetyBuffer = "512Mi"

	// The value of pod.Status.Reason in case of an Out-Of-Memory error (in lower case)
	reasonOutOfMemory = "outofmemory"
)

// Scheduler tries to pack workspaces as closely as possible while trying to keep
// an even load across nodes.
type Scheduler struct {
	Config          Configuration
	Clientset       kubernetes.Interface
	RAMSafetyBuffer res.Quantity

	pods     infov1.PodInformer
	nodes    infov1.NodeInformer
	strategy Strategy

	queue          *PriorityQueue
	localSlotCache *localSlotCache

	didShutdown chan bool
}

// NewScheduler creates a new scheduler
func NewScheduler(config Configuration, clientset kubernetes.Interface) (*Scheduler, error) {
	ramSafetyBuffer, err := res.ParseQuantity(config.RAMSafetyBuffer)
	if err != nil {
		ramSafetyBuffer, err = res.ParseQuantity(defaultRAMSafetyBuffer)
		if err != nil {
			return nil, xerrors.Errorf("unable to parse RAMSafetBuffer")
		}
	}

	return &Scheduler{
		Config:          config,
		Clientset:       clientset,
		RAMSafetyBuffer: ramSafetyBuffer,

		didShutdown: make(chan bool, 1),
	}, nil
}

// Start starts the scheduler - this function returns once we're connected to Kubernetes proper
func (s *Scheduler) Start(ctx context.Context) error {
	var createErr error
	s.strategy, createErr = CreateStrategy(s.Config.StrategyName, s.Config)
	if createErr != nil {
		return xerrors.Errorf("cannot create strategy: %w", createErr)
	}

	s.queue = NewPriorityQueue(SortByPriority, queueInitialBackoff, queueMaximumBackoff)
	s.queue.Run() // starts the goroutines maintaining the queue

	stopInformer := s.startInformer(ctx)
	log.Info("informers are warmed up and workers are running - let them come")
	// Now that the informers are up and running, we can start our workers who rely on the node/pod informers being warmed up

	// Start the actual scheduling loop. This is the only caller of schedulePod to ensure it's atomicity
	go func(q *PriorityQueue) {
		for {
			pi, wasClosed := q.Pop()
			if wasClosed {
				log.Debug("scheduler queue closed - exiting")
				return
			}
			pod := pi.Pod

			owi := wsk8s.GetOWIFromObject(&pod.ObjectMeta)
			log.WithField("pod", pod.Name).WithFields(owi).Debug("scheduling pod")

			err := s.schedulePod(ctx, pi)
			if err != nil {
				log.WithError(err).WithField("pod", pod.Name).Error("unable to schedule pod")
			}
		}
	}(s.queue)

	// Things are all up and running - let's wait for someone to shut us down.
	<-ctx.Done()
	log.Debug("scheduler was asked to shut down")
	// The order in which we shut down is important:
	// 1. prevent more pods to get queued
	close(stopInformer)

	// 2. stop scheduling queue
	s.queue.Close()

	// 3. tell the world that we've shut down
	s.didShutdown <- true
	log.Debug("scheduler did shut down")

	return nil
}

func (s *Scheduler) startInformer(ctx context.Context) (stopInformerQueue chan struct{}) {
	s.localSlotCache = newLocalSlotCache()

	q := s.queue

	// Informers replicate state to a Kubernetes client. We'll use them so we don't have to query the K8S master
	// every time we want to schedule a pod, and so that we don't have to maintain our own watcher.
	factory := informers.NewSharedInformerFactoryWithOptions(s.Clientset, resyncPeriod)

	s.nodes = factory.Core().V1().Nodes()
	s.nodes.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			node, ok := obj.(*corev1.Node)
			if !ok {
				log.Error("node informer received non-node event - this should never happen")
				return
			}

			log.WithField("node", node.Name).Info("new node added to the pool")

			// trigger a fresh re-try for all waiting pods
			q.MoveAllToActive("newNodeAdded")
		},
	})

	s.pods = factory.Core().V1().Pods()
	s.pods.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			pod, ok := obj.(*corev1.Pod)
			if !ok {
				log.Error("pod informer received non-pod event - this should never happen")
				return
			}

			if !s.isPendingPodWeHaveToSchedule(pod) {
				return
			}

			// add to queue
			if pod.Spec.NodeName == "" {
				q.Add(pod)
			}
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			pod, ok := newObj.(*corev1.Pod)
			if !ok {
				log.Error("pod informer received non-pod event - this should never happen")
				return
			}

			// If we see a pod that has been scheduled successfully: Delete from local scheduled_store to avoid leaking memory
			// Note: We _might_ delete entries from localSlotCache too early here, leading to 'OutOfMemory'.
			//       This might happen if a pod has been scheduled (phase=="pending" && nodeName!=""), we removed it, and the
			//		scheduler cannot take that info into account because we just removed.
			//      But we cannot implement an exception for that case, because it leads to leaking localSlotCache entries,
			//      because some pods are removed in the "pending" phase directly.
			if pod.Spec.NodeName != "" {
				s.deleteFromQueue(pod)
			}

			if pod.Status.Phase == corev1.PodFailed &&
				strings.ToLower(pod.Status.Reason) == reasonOutOfMemory {
				// This is a ws-scheduler error and fails the pod: Be as loud about it as possible!
				err := xerrors.Errorf("OutOfMemory: too many pods on the same node")
				msg := "OutOfMemory: due to a scheduling error too many pods are assigned to the same node"
				log.WithField("pod", pod.Name).WithField("node", pod.Spec.NodeName).WithError(err).Errorf(msg)
			}
		},
		DeleteFunc: func(delObj interface{}) {
			pod, ok := delObj.(*corev1.Pod)
			if !ok {
				log.Error("pod informer received non-pod event - this should never happen")
				return
			}

			// make double-sure that we release all resources from local caches
			s.deleteFromQueue(pod)

			// re-trigger scheduling for all pods as there might now be enough space
			s.queue.MoveAllToActive("podDeleted")
		},
	})

	stopInformerQueue = make(chan struct{})
	go factory.Start(stopInformerQueue)

	// Informers are up and running - wait for them to have their caches populated
	s.waitForCacheSync(ctx)

	return
}

// deleteFromQueue removes the referenced pod from all temporary storage so we do not leak memory
func (s *Scheduler) deleteFromQueue(pod *corev1.Pod) bool {
	s.localSlotCache.freeSlot(pod.Name)
	return s.queue.Delete(pod)
}

// WaitForShutdown waits for the scheduler to shut down
func (s *Scheduler) WaitForShutdown() {
	<-s.didShutdown
}

// schedulePod is the central method here, it orchestrates the actual scheduling of a pod onto a node.
// It's expected to be atomic as there's a single goroutine working through the schedulingQueue calling this.
func (s *Scheduler) schedulePod(ctx context.Context, pi *QueuedPodInfo) (err error) {
	start := time.Now()

	pod := pi.Pod
	traceID := pod.Annotations[wsk8s.TraceIDAnnotation]
	spanCtx := tracing.FromTraceID(traceID)
	var span opentracing.Span
	if spanCtx == nil {
		span, ctx = tracing.FromContext(ctx, "schedulePod")
	} else {
		span = opentracing.StartSpan("schedulePod", opentracing.FollowsFrom(spanCtx))
		ctx = opentracing.ContextWithSpan(ctx, span)
	}
	flds := wsk8s.GetOWIFromObject(&pod.ObjectMeta)
	flds["attempt"] = pi.Attempts
	flds["name"] = pod.Name
	workspaceType := wsk8s.GetWorkspaceType(pod)
	flds["workspaceType"] = workspaceType
	tracing.ApplyOWI(span, flds)
	defer tracing.FinishSpan(span, &err)

	// if the pod is known to have already been scheduled (locally): drop.
	if s.localSlotCache.hasAlreadyBeenScheduled(pod.Name) {
		span.LogFields(tracelog.String("schedulingResult", "alreadyScheduled"))
		log.WithFields(flds).Debugf("pod has already been scheduled, dropping.")
		return nil
	}

	isGhostReplacing := wsk8s.IsNonGhostWorkspace(pod)
	nodeName, state, err := s.selectNodeForPod(ctx, pod, !isGhostReplacing)
	if nodeName == "" {
		// make sure we actually revisit this request later
		s.queue.AddUnschedulable(pi)

		// we did not find any suitable node for the pod, mark the pod as unschedulable
		isError := false
		var errMsg string
		if err != nil {
			errMsg = fmt.Sprintf("no suitable node found: %s", err)
			isError = true
		} else {
			errMsg = "no suitable node found"
		}
		err = s.recordSchedulingFailure(ctx, pod, err, corev1.PodReasonUnschedulable, errMsg)
		if err != nil {
			metrics.PodScheduleError(workspaceType, metrics.SinceInSeconds(start))
			return xerrors.Errorf("cannot record scheduling failure: %w", err)
		}

		// metrics
		if isError {
			metrics.PodScheduleError(workspaceType, metrics.SinceInSeconds(start))
		} else {
			metrics.PodUnschedulable(workspaceType, metrics.SinceInSeconds(start))
		}

		return nil
	}
	// log.WithFields(flds).Debug(DebugStringNodes(state.SortNodesByAvailableRAM(SortDesc)...))

	// check if this workspaces replaces a ghost, and if yes, which one
	var ghostToDelete string
	if isGhostReplacing {
		var unschedulable bool
		reservedGhosts := s.localSlotCache.getReservedGhostsOnNode(nodeName, pod.Name)
		ghostToDelete, unschedulable = state.FindSpareGhostToDelete(nodeName, pod, reservedGhosts)

		log.WithFields(flds).WithField("ghostToDelete", ghostToDelete).WithField("unschedulable", unschedulable).Debug("ghostToDelete")
		span.LogFields(tracelog.String("ghostToDelete", ghostToDelete), tracelog.Bool("unschedulable", unschedulable))

		if unschedulable {
			// this is more of a safety measure as it should never happen: If we do not fit on a node nor cannot find a
			// spare ghost to delete on the node, we should have never been scheduled to it in the first place.
			log.WithFields(flds).Warn("pod unschedulable despite being scheduled to this node")

			// drop scheduling request for now - but make sure we revisit it later
			s.queue.AddUnschedulable(pi)
			metrics.PodUnschedulable(workspaceType, metrics.SinceInSeconds(start))
			return nil
		}
	}

	// reserve the slot, even before the actual scheduling has happened.
	// We persists this info between scheduling runs (as long as the pod is in the queue).
	// We just need to make sure we release the slot in case the scheduling fails!
	s.localSlotCache.reserveSlot(pod, nodeName, ghostToDelete)
	defer func() {
		if err != nil {
			// make _sure_ we release the slot - but only in the error case
			s.localSlotCache.freeSlot(pod.Name)
		}
	}()

	// if this is a workspace that replaces a ghost: delete that ghost to make room for a workspace in a later scheduling round
	if ghostToDelete != "" {
		defer metrics.PreemptionAttempts.Inc()

		err = s.deleteGhostWorkspace(ctx, pod.Name, ghostToDelete)
		if err != nil {
			log.WithFields(flds).WithField("ghost", ghostToDelete).WithError(err).Error("error deleting ghost")
		}

		// only delete the ghost and drop scheduling request for now - but make sure we revisit it later
		s.queue.AddUnschedulable(pi)
		metrics.PodUnschedulable(workspaceType, metrics.SinceInSeconds(start))
		return
	}

	// bind the pod to the node
	err = s.bindPodToNode(ctx, pod, nodeName)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "is already assigned to node") {
			// pod has already been scheduled: This can happen and is good - fine with us
			log.WithFields(flds).Debugf("pod already bound - fine with me")
			return
		} else if strings.Contains(errStr, "is being deleted") {
			// pod has been deleted before we could schedule it - fine with us
			isGhost := wsk8s.IsGhostWorkspace(pod)
			log.WithFields(flds).WithField("isGhost", isGhost).Debugf("pod already terminated - fine with me")
			return
		}

		log.WithFields(flds).WithError(err).Error("cannot bind pod")
		metrics.PodScheduleError(workspaceType, metrics.SinceInSeconds(start))
		return
	}
	log.WithFields(flds).Debugf("bound to node: %s", nodeName)

	// we're done!
	s.localSlotCache.markAsScheduled(pod, nodeName, ghostToDelete)

	// metrics
	metrics.PodScheduled(workspaceType, metrics.SinceInSeconds(start))
	metrics.PodSchedulingAttempts.WithLabelValues(workspaceType).Observe(float64(pi.Attempts))
	metrics.PodSchedulingDuration.WithLabelValues(getAttemptsLabel(pi), workspaceType).Observe(metrics.SinceInSeconds(pi.InitialAttemptTimestamp))

	return nil
}

func (s *Scheduler) selectNodeForPod(ctx context.Context, pod *corev1.Pod, ghostsVisible bool) (node string, state *State, err error) {
	span, ctx := tracing.FromContext(ctx, "selectNodeForPod")
	// We deliberately DO NOT add the err to tracing here. If things actually fail the caller will trace the error.
	// If we did trace the error here we'd just spam our traces with false positives.
	defer tracing.FinishSpan(span, nil)

	state, err = s.buildState(ctx, pod, ghostsVisible)
	if err != nil {
		return "", nil, xerrors.Errorf("unable to build state: %w", err)
	}
	if len(state.Nodes) == 0 {
		return "", nil, xerrors.Errorf("zero nodes available")
	}
	node, err = s.strategy.Select(state, pod)
	if err != nil {
		span.LogKV("no-node", err.Error())
		return "", nil, err
	}

	span.LogKV("node", DebugStringNodes(state.Nodes[node]))
	span.LogKV("ghostsVisible", ghostsVisible)
	return
}

// Builds a state for all nodes we can schedule the given pod on
func (s *Scheduler) buildState(ctx context.Context, pod *corev1.Pod, ghostsVisible bool) (state *State, err error) {
	span, ctx := tracing.FromContext(ctx, "buildState")
	defer tracing.FinishSpan(span, &err)

	potentialNodes, err := s.gatherPotentialNodesFor(ctx, pod)
	if err != nil {
		return nil, err
	}

	// We need to take into account _all_ pods in _all_ namespaces to accurately calculate available RAM per node
	// NOTE: .Pods("") - in contrast to omitting it and calling .Lister().List(...) directly - means:
	//       List from _all_ namespaces !!!
	allPods, podsErr := s.pods.Lister().Pods(metav1.NamespaceAll).List(labels.Everything())
	if podsErr != nil {
		return nil, xerrors.Errorf("cannot list all pods: %w", podsErr)
	}

	state = ComputeState(potentialNodes, allPods, s.localSlotCache.getListOfBindings(pod.Name), &s.RAMSafetyBuffer, ghostsVisible, s.Config.Namespace)

	// The required node services is basically PodAffinity light. They limit the nodes we can schedule
	// workspace pods to based on other pods running on that node. We do this because we require that
	// ws-daemon and registry-facade run on the node.
	//
	// Alternatively, we could have implemented PodAffinity in ws-scheduler, but that's conceptually
	// much heavier and more difficult to handle.
	//
	// TODO(cw): if we ever implement PodAffinity, use that instead of requiredNodeServices.
	if rs, ok := pod.Annotations[wsk8s.RequiredNodeServicesAnnotation]; ok {
		req := strings.Split(rs, ",")
		state.FilterNodes(func(n *Node) bool {
			for _, requiredService := range req {
				if _, present := n.Services[requiredService]; !present {
					return false
				}
			}
			return true
		})
	}

	return state, nil
}

// gatherPotentialNodesFor filters the nodes we consider to schedule the given pod on
func (s *Scheduler) gatherPotentialNodesFor(ctx context.Context, pod *corev1.Pod) ([]*corev1.Node, error) {
	// labels.Set.Merge was added but IDK how to update only k8s.io/apimachinery/pkg/labels only
	filterLabels := labels.Set{}
	// filter 1: NodeLabelSelector
	for k, v := range s.Config.NodeLabelSelector {
		filterLabels[k] = v
	}
	// filter 2: NodeSelector (potentially overrides filter 1)
	for k, v := range pod.Spec.NodeSelector {
		filterLabels[k] = v
	}

	prefilteredNodes, nodesErr := s.nodes.Lister().List(labels.SelectorFromSet(labels.Set(filterLabels)))
	if nodesErr != nil {
		return nil, xerrors.Errorf("cannot list all nodes: %w", nodesErr)
	}

	potentialNodes := make([]*corev1.Node, 0)
	for _, node := range prefilteredNodes {
		// filter 3: cordoned nodes
		if node.Spec.Unschedulable {
			continue
		}
		// filter: 4: our own diskpressure signal coming from ws-daemon.
		//            This is not part of the label selector as labelSets cannot negate
		//            labels. Otherwise !gitpod.io/diskPressure would be a valid selector.
		if _, fullDisk := node.Labels[wsk8s.GitpodDiskPressureLabel]; fullDisk {
			continue
		}

		// filter 5: Node affinity
		affinity := pod.Spec.Affinity
		if affinity != nil && affinity.NodeAffinity != nil {
			nodeSelector := affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution
			if nodeSelector != nil && !k8sinternal.NodeMatchesNodeSelectorTerms(node, nodeSelector.NodeSelectorTerms) {
				continue
			}
		}

		// filter 6: taints and tolerations
		filterPredicate := func(t *corev1.Taint) bool {
			// PodToleratesNodeTaints is only interested in NoSchedule and NoExecute taints.
			return t.Effect == corev1.TaintEffectNoSchedule || t.Effect == corev1.TaintEffectNoExecute
		}
		if !v1helper.TolerationsTolerateTaintsWithFilter(pod.Spec.Tolerations, node.Spec.Taints, filterPredicate) {
			continue
		}

		potentialNodes = append(potentialNodes, node)
	}

	return potentialNodes, nil
}

func (s *Scheduler) bindPodToNode(ctx context.Context, pod *corev1.Pod, nodeName string) (err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "bindPodToNode")
	defer tracing.FinishSpan(span, nil) // let caller decide whether this is an actual error or not
	span.LogKV("nodeName", nodeName, "podName", pod.Name)

	binding := &corev1.Binding{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: pod.Namespace,
			Name:      pod.Name,
			UID:       pod.UID,
		},
		Target: corev1.ObjectReference{
			Kind: "Node",
			Name: nodeName,
		},
	}

	start := time.Now()
	err = s.Clientset.CoreV1().Pods(pod.Namespace).Bind(ctx, binding, metav1.CreateOptions{})
	if err != nil {
		return xerrors.Errorf("cannot bind pod %s to %s: %w", pod.Name, nodeName, err)
	}
	span.LogKV("event", "binding created")

	// The default Kubernetes scheduler publishes an event upon successful scheduling.
	// This is not really neccesary for the scheduling itself, but helps to debug things.
	message := fmt.Sprintf("Placed pod [%s/%s] on %s\n", pod.Namespace, pod.Name, nodeName)
	timestamp := time.Now().UTC()
	_, err = s.Clientset.CoreV1().Events(pod.Namespace).Create(ctx, &corev1.Event{
		Count:          1,
		Message:        message,
		Reason:         "Scheduled",
		LastTimestamp:  metav1.NewTime(timestamp),
		FirstTimestamp: metav1.NewTime(timestamp),
		Type:           corev1.EventTypeNormal,
		Source: corev1.EventSource{
			Component: s.Config.SchedulerName,
		},
		InvolvedObject: corev1.ObjectReference{
			Kind:      "Pod",
			Name:      pod.Name,
			Namespace: pod.Namespace,
			UID:       pod.UID,
		},
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("%s - scheduled", pod.Name),
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return xerrors.Errorf("cannot emit event for pod %s: %w", pod.Name, err)
	}
	span.LogKV("event", "event created")

	metrics.BindingLatency.Observe(metrics.SinceInSeconds(start))
	return nil
}

func (s *Scheduler) waitForCacheSync(ctx context.Context) bool {
	span, ctx := tracing.FromContext(ctx, "waitForCacheSync")
	defer tracing.FinishSpan(span, nil)

	stopCh := make(chan struct{})
	done := make(chan bool)

	go func() {
		done <- cache.WaitForCacheSync(stopCh,
			s.pods.Informer().HasSynced,
			s.nodes.Informer().HasSynced,
		)
	}()

	select {
	case <-ctx.Done():
		close(stopCh)
		return false
	case r := <-done:
		return r
	}
}

func (s *Scheduler) recordSchedulingFailure(ctx context.Context, pod *corev1.Pod, failureErr error, reason string, message string) (err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "recordSchedulingFailure")
	defer tracing.FinishSpan(span, &err)

	// It's important to not spam the pod with "PodScheduled: false" conditions, because this seems to result
	// in sudden and uncontrolled cluster scaleup
	for _, c := range pod.Status.Conditions {
		if c.Type == corev1.PodScheduled && c.Status == corev1.ConditionFalse {
			log.WithField("pod", pod.Name).Trace("No need to record scheduling failure again")
			return nil
		}
	}

	log.WithFields(logrus.Fields{
		"pod":     pod.Name,
		"reason":  reason,
		"message": message,
	}).WithError(failureErr).Warnf("scheduling a pod failed: %s", reason)

	timestamp := time.Now().UTC()
	_, err = s.Clientset.CoreV1().Events(pod.Namespace).Create(ctx, &corev1.Event{
		Count:          1,
		Message:        message,
		Reason:         "FailedScheduling",
		LastTimestamp:  metav1.NewTime(timestamp),
		FirstTimestamp: metav1.NewTime(timestamp),
		Type:           corev1.EventTypeWarning,
		Source: corev1.EventSource{
			Component: s.Config.SchedulerName,
		},
		InvolvedObject: corev1.ObjectReference{
			Kind:      "Pod",
			Name:      pod.Name,
			Namespace: pod.Namespace,
			UID:       pod.UID,
		},
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: pod.Name + "-",
		},
	}, metav1.CreateOptions{})
	if err != nil {
		log.WithField("pod", pod.Name).WithError(err).Warn("cannot record scheduling failure event")
	}

	// we were unable to schedule the pod which we need to mark appropriately. Retrieve the pod first prior to trying and modifying it
	// Note: Do _not_ retry.RetryOnConflict here as:
	//  - this is on the hot path of the single-thread scheduler
	//  - retry would block other pods from being scheduled
	//  - the pod is picked up after rescheduleInterval (currently 2s) again anyway
	updatedPod, err := s.Clientset.CoreV1().Pods(pod.Namespace).Get(ctx, pod.Name, metav1.GetOptions{})
	if err != nil {
		log.WithField("pod", pod.Name).WithError(err).Warn("cannot get updated pod - subsequent pod modifications may break")
	} else {
		pod = updatedPod
	}

	failedCondition := corev1.PodCondition{
		Type:    corev1.PodScheduled,
		Status:  corev1.ConditionFalse,
		Reason:  reason,
		Message: failureErr.Error(),
	}
	pod.Status.Conditions = append(pod.Status.Conditions, failedCondition)
	_, err = s.Clientset.CoreV1().Pods(pod.Namespace).UpdateStatus(ctx, pod, metav1.UpdateOptions{})
	if err != nil {
		log.WithError(err).Warn("cannot mark pod as unscheduled - will try again")
		return xerrors.Errorf("cannot mark pod as unscheduled: %w", err)
	}

	return nil
}

func (s *Scheduler) isPendingPodWeHaveToSchedule(pod *corev1.Pod) bool {
	// do not schedule "Terminated" pods (corev1.PodPending is _not_ suitable!)
	return pod.Status.Phase != corev1.PodSucceeded &&
		pod.Status.Phase != corev1.PodFailed &&
		// Only schedule un-scheduled pods (corev1.PodPending is _not_ suitable!)
		pod.Spec.NodeName == "" &&
		// Only schedule pods we ought to schedule
		pod.Spec.SchedulerName == s.Config.SchedulerName &&
		// Namespace is used as selector to restrict reach
		pod.ObjectMeta.Namespace == s.Config.Namespace
}

// deleteGhostWorkspace tries to delete a ghost workspace to make room for the given pod
func (s *Scheduler) deleteGhostWorkspace(ctx context.Context, podName string, ghostName string) (err error) {
	span, ctx := tracing.FromContext(ctx, "deleteGhostWorkspace")
	defer tracing.FinishSpan(span, &err)

	// gracePeriod is the time until kubernetes sends SIG_KILL to the root process
	// ctxDeleteTimeout is the time until we stop waiting for the deletion request to return
	// Ensure that:
	//  - ctxDeleteTimeout > gracePeriod: So the container has actually time to quit properly
	//  - ctxDeleteTimeout to be not too long: To ensure scheduling is not to slow
	gracePeriod := 10 * time.Second
	ctxDeleteTimeout := gracePeriod + (5 * time.Second)
	deleteCtx, cancelDeleteCtx := context.WithTimeout(ctx, ctxDeleteTimeout)
	defer cancelDeleteCtx()

	gracePeriodSeconds := int64(gracePeriod.Seconds())
	foreground := metav1.DeletePropagationForeground
	err = s.Clientset.CoreV1().Pods(s.Config.Namespace).Delete(deleteCtx, ghostName, metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriodSeconds,
		PropagationPolicy:  &foreground,
	})
	if err != nil {
		if isKubernetesObjNotFoundError(err) {
			log.WithField("podName", podName).WithField("ghost", ghostName).Debug("ghost workspace already gone")
			return nil
		}

		return err
	}

	log.WithField("podName", podName).WithField("ghost", ghostName).Debug("deleted ghost workspace")
	return nil
}

// true means: pi1 is inserted _before_ pi2
// podPriority means: the higher the better
func SortByPriority(pi1, pi2 *QueuedPodInfo) bool {
	now := time.Now()
	p1 := podPriority(pi1.Pod, now)
	p2 := podPriority(pi2.Pod, now)
	return p1 > p2
}

// podPriority calculates the priority a pod gets in our scheduling queue.
// We favor, in decreasing order:
//  - regular workspaces
//  - all other workspace types (including prebuilds, ghosts, probes)
//  - all other pods
func podPriority(pod *corev1.Pod, now time.Time) int64 {
	age := now.Unix() - pod.CreationTimestamp.Unix()
	if wsk8s.IsRegularWorkspace(pod) {
		return age + priorityOffsetRegularWorkspace
	}

	if wsk8s.IsWorkspace(pod) {
		return age + priorityOffsetNonRegularWorkspace
	}

	return age
}

func isKubernetesObjNotFoundError(err error) bool {
	if err, ok := err.(*k8serr.StatusError); ok {
		return err.ErrStatus.Code == http.StatusNotFound
	}
	return false
}

func getAttemptsLabel(pi *QueuedPodInfo) string {
	// capping here to reduce cardinality
	if pi.Attempts >= 15 {
		return "15+"
	}
	return strconv.Itoa(pi.Attempts)
}

// localSlotCache stores whether we already are scheduling a Pod and is necessary to bridge the gap between:
//  1. We reserved a slot on a node
//  2. We successfully create a binding with the Kubernets API
//  3. The change is reflected in the results we get from s.pods.Lister().List()
// Without it, we sometimes end up with pods being assigned the same last slot on a node, leading
// to workspace startup failures.
//
// (We're not sure why there is gap in the first place: Kubernetes should be consistent, as etcd is
// consistent (per Object type, here Pod). Maybe because of the GCloud multi-master setup..?)
type localSlotCache struct {
	slots map[string]slot
	mu    sync.RWMutex
}

// slot is used to describe a "place" on a single node that we already scheduled/are trying to schedule a workspace on.
type slot struct {
	binding       *Binding
	reservedGhost string

	// whether:
	//  - the pod has already been bound and we're just waiting for the update from k8s master, or
	//  - the slot has been reserved, and we're still waiting for the binding to happen
	scheduled bool
}

// markAsScheduled marks a certain slot as already scheduled
func (c *localSlotCache) markAsScheduled(pod *corev1.Pod, nodeName string, ghostToReplace string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// note: potentially overwriting
	c.slots[pod.Name] = slot{
		binding: &Binding{
			Pod:      pod,
			NodeName: nodeName,
		},
		scheduled:     true,
		reservedGhost: ghostToReplace,
	}
}

// reserveSlot marks a certain slot as already scheduled
func (c *localSlotCache) reserveSlot(pod *corev1.Pod, nodeName string, ghostToReplace string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.slots[pod.Name] = slot{
		binding: &Binding{
			Pod:      pod,
			NodeName: nodeName,
		},
		scheduled:     false,
		reservedGhost: ghostToReplace,
	}
}

func (c *localSlotCache) hasAlreadyBeenScheduled(podName string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	s, present := c.slots[podName]
	return present && s.scheduled
}

func (c *localSlotCache) freeSlot(podName string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.slots, podName)
}

func (c *localSlotCache) getListOfBindings(podName string) []*Binding {
	c.mu.RLock()
	defer c.mu.RUnlock()

	bs := make([]*Binding, 0, len(c.slots))
	for _, s := range c.slots {
		if !s.scheduled && s.binding.Pod.Name == podName {
			// do _not_ include previously reserved slots for ourselves that we now want to update!
			continue
		}
		bs = append(bs, s.binding)
	}
	return bs
}

func (c *localSlotCache) getReservedGhostsOnNode(nodeName string, podName string) map[string]bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	reservedGhosts := make(map[string]bool, len(c.slots))
	for _, s := range c.slots {
		if s.binding.NodeName != nodeName {
			continue
		}
		if s.binding.Pod.Name == podName {
			// do not count the reservedGhost for this pod as "reserved"
			continue
		}
		reservedGhosts[s.reservedGhost] = true
	}
	return reservedGhosts
}

func newLocalSlotCache() *localSlotCache {
	return &localSlotCache{
		slots: make(map[string]slot),
	}
}
