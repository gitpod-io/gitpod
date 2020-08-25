// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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
	"strings"
	"sync"
	"time"

	k8sinternal "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler/internal"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"
	tracelog "github.com/opentracing/opentracing-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"
	infov1 "k8s.io/client-go/informers/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
	v1helper "k8s.io/kubernetes/pkg/apis/core/v1/helper"
)

const (
	// schedulerQueueSize is the max number of pods we'll hold in the scheduler queue at any given time.
	// This number is very generous. If we hit this limit (i.e. adding to the queue blocks due to back pressure),
	// we should rethink our architecture.
	schedulerQueueSize = 100

	// resyncPeriod is the time that the informers will look back when after reconnecting. In essence it's the time
	// that we expect to ever be disconnected from Kubernetes.
	resyncPeriod = 5 * time.Minute

	// rescheduleInterval is the interval in which we scan for yet-unschedulable pods and try to schedule them again
	rescheduleInterval = 2 * time.Second
)

// Scheduler tries to pack workspaces as closely as possible while trying to keep
// an even load across nodes.
type Scheduler struct {
	Config    Configuration
	Clientset kubernetes.Interface

	pods              infov1.PodInformer
	nodes             infov1.NodeInformer
	strategy          Strategy
	localBindingCache *localBindingCache

	didShutdown chan bool
}

// NewScheduler creates a new scheduler
func NewScheduler(config Configuration, clientset kubernetes.Interface) *Scheduler {
	return &Scheduler{
		Config:    config,
		Clientset: clientset,

		didShutdown: make(chan bool, 1),
	}
}

// Start starts the scheduler - this function returns once we're connected to Kubernetes proper
func (s *Scheduler) Start(ctx context.Context) error {
	var createErr error
	s.strategy, createErr = CreateStrategy(s.Config.StrategyName, s.Config)
	if createErr != nil {
		return xerrors.Errorf("cannot create strategy: %w", createErr)
	}

	schedulerQueue, newNodeQueue, stopInformer := s.startInformer(ctx)
	log.Info("informers are warmed up and workers are running - let them come")
	// Now that the informers are up and running, we can start our workers who rely on the node/pod informers being warmed up

	// Start the actual scheduling loop
	go func() {
		for pod := range schedulerQueue {
			if pod == nil {
				log.Debug("scheduler queue closed - exiting")
				return
			}

			owi := wsk8s.GetOWIFromObject(&pod.ObjectMeta)
			log.WithField("pod", pod.Name).WithFields(owi).Debug("scheduling pod")
			err := s.schedulePod(ctx, pod)
			if err != nil {
				log.WithError(err).WithField("pod", pod.Name).Error("unable to schedule pod: %w", err)
			}
		}
	}()

	// Start the loop that makes sure we're not missing something because:
	//  - new nodes or pods have been added that we missed due to redeployments
	//  - a pod is hanging in "PENDING" state because it could not be scheduled when it was created/added
	go func() {
		rescheduleTicker := time.NewTicker(rescheduleInterval)

		for {
			select {
			case node := <-newNodeQueue:
				if node == nil {
					log.Debug("reschedule queue closed - exiting")
					return
				}

				// a new node was added: do we have pending pods to re-schedule?
				err := s.checkForAndEnqueuePendingPods(ctx, schedulerQueue)
				if err != nil {
					log.WithError(err).Debug("error during pending pod check: %w", err)
				}
			case <-rescheduleTicker.C:
				// rescheduleInterval is over: do regular scan
				err := s.checkForAndEnqueuePendingPods(ctx, schedulerQueue)
				if err != nil {
					log.WithError(err).Debug("error during pending pod check", err)
				}
			}
		}
	}()

	// Things are all up and running - let's wait for someone to shut us down.
	<-ctx.Done()
	log.Debug("scheduler was asked to shut down")
	// The order in which we shut down is important:
	// 1. prevent more pods to get queued
	close(stopInformer)
	close(newNodeQueue)

	// 2. stop all workers
	close(schedulerQueue)

	// 3. tell the world that we've shut down
	s.didShutdown <- true
	log.Debug("scheduler did shut down")

	return nil
}

func (s *Scheduler) startInformer(ctx context.Context) (schedulerQueue chan *corev1.Pod, newNodeQueue chan *corev1.Node, stopInformerQueue chan struct{}) {
	// Whenever we find a pod to schedule we'll enqueue it to a range of workers that will handle its scheduling.
	schedulerQueue = make(chan *corev1.Pod, schedulerQueueSize)

	// Whenever we find a new node we'll enqueue it to a range of workers that will check if we have pending
	newNodeQueue = make(chan *corev1.Node, schedulerQueueSize)

	s.localBindingCache = newLocalBindingCache()

	// Informers replicate state to a Kubernetes client. We'll use them so we don't have to query the K8S master
	// every time we want to schedule a pod, and so that we don't have to maintain our own watcher.
	log.Debug("creating factory")
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

			newNodeQueue <- node
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

			queuePodForScheduling(schedulerQueue, pod)
		},
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			pod, ok := newObj.(*corev1.Pod)
			if !ok {
				log.Error("pod informer received non-pod event - this should never happen")
				return
			}

			// If we see a pod that has been scheduled successfully: Delete from local scheduled_store to avoid leaking memory
			if pod.Spec.NodeName != "" {
				s.localBindingCache.delete(pod.Name)
			}

			if pod.Status.Phase == corev1.PodFailed && pod.Status.Reason == "OutOfMemory" {
				// This is a ws-scheduler error and fails the pod: Be as loud about it as possible!
				err := xerrors.Errorf("OutOfMemory: too many pods on the same node")
				msg := "OutOfMemory: due to a scheduling error too many pods are assigned to the same node"
				log.WithField("pod", pod.Name).WithField("node", pod.Spec.NodeName).WithError(err).Errorf(msg)
			}
		},
	})

	stopInformerQueue = make(chan struct{})
	go factory.Start(stopInformerQueue)

	// Informers are up and running - wait for them to have their caches populated
	s.waitForCacheSync(ctx)

	return
}

// WaitForShutdown waits for the scheduler to shut down
func (s *Scheduler) WaitForShutdown() {
	<-s.didShutdown
}

func (s *Scheduler) schedulePod(ctx context.Context, pod *corev1.Pod) (err error) {
	traceID := pod.Annotations[wsk8s.TraceIDAnnotation]
	spanCtx := tracing.FromTraceID(traceID)
	var span opentracing.Span
	if spanCtx == nil {
		span, ctx = tracing.FromContext(ctx, "schedulePod")
	} else {
		span = opentracing.StartSpan("schedulePod", opentracing.FollowsFrom(spanCtx))
		ctx = opentracing.ContextWithSpan(ctx, span)
	}
	owi := wsk8s.GetOWIFromObject(&pod.ObjectMeta)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	// if the pod is known to have already been scheduled (locally): drop.
	if s.localBindingCache.hasAlreadyBeenScheduled(pod.Name) {
		span.LogFields(tracelog.String("schedulingResult", "alreadyScheduled"))
		log.WithFields(owi).WithField("name", pod.Name).Debugf("pod has already been scheduled, dropping.")
		return nil
	}

	nodeName, err := s.selectNodeForPod(ctx, pod)
	if nodeName == "" {
		// we did not find any suitable node for the pod, mark the pod as unschedulable
		var errMsg string
		if err != nil {
			errMsg = fmt.Sprintf("no suitable node found: %s", err)
		} else {
			errMsg = "no suitable node found"
		}

		err = s.recordSchedulingFailure(ctx, pod, err, corev1.PodReasonUnschedulable, errMsg)
		if err != nil {
			return xerrors.Errorf("cannot record scheduling failure: %w", err)
		}

		return nil
	}

	// we found a node for this pod - bind it to the node
	err = s.bindPodToNode(ctx, pod, nodeName)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "is already assigned to node") {
			// some other worker was faster: This can happen and is good: do nothing
			log.WithFields(owi).WithField("name", pod.Name).Debugf("pod already bound - someone was faster than me!")
			return nil
		}

		return xerrors.Errorf("cannot bind pod: %w", err)
	}
	log.WithFields(owi).WithField("name", pod.Name).Debugf("bound to node: %s", nodeName)

	// mark as already scheduled (locally)
	s.localBindingCache.markAsScheduled(pod, nodeName)

	return nil
}

func (s *Scheduler) checkForAndEnqueuePendingPods(ctx context.Context, schedulerQueue chan<- *corev1.Pod) error {
	tracing.FromContext(ctx, "checkForAndEnqueuePendingPods")

	// We want to scan for pods we have to schedule. As we have a) no local queue and b) can only filter by labels,
	// we query all here and filter later, manually. Sadly, this polls the Kubernetes api quite often.
	// TODO Consider using a local queue of pending pods and try to do the full ".List" only very rarely
	allPods, podsErr := s.pods.Lister().List(labels.Everything())
	if podsErr != nil {
		return xerrors.Errorf("cannot list all pods: %w", podsErr)
	}

	// enqueue all pending pods we have to schedule
	for _, pod := range allPods {
		if s.isPendingPodWeHaveToSchedule(pod) {
			queuePodForScheduling(schedulerQueue, pod)
		}
	}

	return nil
}

func (s *Scheduler) selectNodeForPod(ctx context.Context, pod *corev1.Pod) (node string, err error) {
	span, ctx := tracing.FromContext(ctx, "selectNodeForPod")
	// We deliberately DO NOT add the err to tracing here. If things actually fail the caller will trace the error.
	// If we did trace the error here we'd just spam our traces with false positives.
	defer tracing.FinishSpan(span, nil)

	state, err := s.buildState(ctx, pod)
	if err != nil {
		return "", xerrors.Errorf("unable to buildState: %w", err)
	}
	if len(state.Nodes) == 0 {
		return "", xerrors.Errorf("Zero nodes available!")
	}
	node, err = s.strategy.Select(state, pod)

	span.LogFields(tracelog.String("nodeFound", node))
	return
}

// Builds a state for all nodes we can schedule the given pod on
func (s *Scheduler) buildState(ctx context.Context, pod *corev1.Pod) (state *State, err error) {
	span, ctx := tracing.FromContext(ctx, "buildState")
	defer tracing.FinishSpan(span, &err)

	potentialNodes, err := s.gatherPotentialNodesFor(ctx, pod)
	if err != nil {
		return nil, err
	}

	// We need to take _all_ pods into account to accurately calculate available RAM per node
	allPods, podsErr := s.pods.Lister().List(labels.Everything())
	if podsErr != nil {
		return nil, xerrors.Errorf("cannot list all pods: %w", podsErr)
	}

	state = NewState()
	state.UpdateNodes(potentialNodes)
	state.UpdatePods(allPods)
	// Don't forget to take into account the bindings we just created (e.g., are still in the cache)
	// to avoid assigning slots multiple times
	state.UpdateBindings(s.localBindingCache.getListOfBindings())
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
		// filter: 4: our own diskpressure signal coming from ws-manager-node.
		//            This is not part of the label selector as labelSets cannot negate
		//            labels. Otherwise !gitpod.io/diskPressure would be a valid selector.
		if _, fullDisk := node.Labels["gitpod.io/diskPressure"]; fullDisk {
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
	span, ctx := tracing.FromContext(ctx, "bindPodToNode")
	defer tracing.FinishSpan(span, nil) // let caller decide whether this is an actual error or not

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

	err = s.Clientset.CoreV1().Pods(pod.Namespace).Bind(binding)
	if err != nil {
		return xerrors.Errorf("cannot bind pod %s to %s: %w", pod.Name, nodeName, err)
	}

	// The default Kubernetes scheduler publishes an event upon successful scheduling.
	// This is not really neccesary for the scheduling itself, but helps to debug things.
	message := fmt.Sprintf("Placed pod [%s/%s] on %s\n", pod.Namespace, pod.Name, nodeName)
	timestamp := time.Now().UTC()
	_, err = s.Clientset.CoreV1().Events(pod.Namespace).Create(&corev1.Event{
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
	})
	if err != nil {
		return xerrors.Errorf("cannot emit event for pod %s: %w", pod.Name, err)
	}

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
	_, err = s.Clientset.CoreV1().Events(pod.Namespace).Create(&corev1.Event{
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
	})
	if err != nil {
		log.WithField("pod", pod.Name).WithError(err).Warn("cannot record scheduling failure event")
	}

	// we were unable to schedule the pod which we need to mark appropriately. Retrieve the pod first prior to trying and modifying it
	// Note: Do _not_ retry.RetryOnConflict here as:
	//  - this is on the hot path of the single-thread scheduler
	//  - retry would block other pods from being scheduled
	//  - the pod is picked up after rescheduleInterval (currently 2s) again anyway
	updatedPod, err := s.Clientset.CoreV1().Pods(pod.Namespace).Get(pod.Name, metav1.GetOptions{})
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
	_, err = s.Clientset.CoreV1().Pods(pod.Namespace).UpdateStatus(pod)
	if err != nil {
		log.WithError(err).Warn("cannot mark pod as unscheduled - will try again")
		return xerrors.Errorf("cannot mark pod as unscheduled: %w", err)
	}

	return nil
}

func (s *Scheduler) isPendingPodWeHaveToSchedule(pod *corev1.Pod) bool {
	return pod.Spec.NodeName == "" &&
		pod.Spec.SchedulerName == s.Config.SchedulerName &&
		// Namespace serves as mere marker here
		pod.ObjectMeta.Namespace == s.Config.Namespace
}

// queuePodForScheduling queues the given pod for scheduling. If immediate scheduling fails the first time it emits an
// error log message. The pod is guaranteed to be scheduled either way.
func queuePodForScheduling(schedulerQueue chan<- *corev1.Pod, pod *corev1.Pod) {
	select {
	case schedulerQueue <- pod:
		// queue not full, everything is fine
	default:
		log.Warn("scheduler queue full! Rethink scheduling strategy! Will queue anyway.")
		schedulerQueue <- pod
	}
}

// localBindingCache stores whether we already scheduled a Pod and is necessary to bridge the gap between:
//  1. We successfully create a binding with the Kubernets API
//  2. The change is reflected in the results we get from s.pods.Lister().List()
// Without it, we sometimes end up with pods being assigned the same last slot on a node, leading
// to workspace startup failures.
//
// (We're not sure why there is gap in the first place: Kubernetes should be consistent, as etcd is
// consistent (per Object type, here Pod). Maybe because of the GCloud multi-master setup..?)
type localBindingCache struct {
	bindings map[string]*Binding
	mu       sync.RWMutex
}

func (c *localBindingCache) markAsScheduled(pod *corev1.Pod, nodeName string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.bindings[pod.Name] = &Binding{
		Pod:      &Pod{Pod: pod},
		NodeName: nodeName,
	}
}

func (c *localBindingCache) hasAlreadyBeenScheduled(podName string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	_, present := c.bindings[podName]
	return present
}

func (c *localBindingCache) delete(podName string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.bindings, podName)
}

func (c *localBindingCache) getListOfBindings() []*Binding {
	c.mu.Lock()
	defer c.mu.Unlock()

	bs := make([]*Binding, 0, len(c.bindings))
	for _, b := range c.bindings {
		bs = append(bs, b)
	}
	return bs
}

func newLocalBindingCache() *localBindingCache {
	return &localBindingCache{
		bindings: make(map[string]*Binding),
	}
}
