// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"context"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

const (
	component = "ws-scaler"
)

// Scaler is the entity responsible for minimizing the time pods have to wait for a node
type Scaler struct {
	Config    Configuration
	Clientset *kubernetes.Clientset

	didShutdown chan bool
}

// NewScaler serves as constructor for Scaler
func NewScaler(config Configuration, clientset *kubernetes.Clientset) *Scaler {
	return &Scaler{
		Config:    config,
		Clientset: clientset,
	}
}

// Start start an instance of the Scaler
func (s *Scaler) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(s.Config.ScalingPeriod))
loop:
	for {
		err := s.scalingPeriod(ctx)
		if err != nil {
			log.WithError(err).Error("error during scaling")
		}

		select {
		case <-ticker.C:
			continue
		case <-ctx.Done():
			log.Debug("context cancelled - shutting down scaler")
			break loop
		}
	}

	s.didShutdown <- true
	log.Debug("scaler did shut down")
}

// WaitForShutdown waits for the scheduler to shut down
func (s *Scaler) WaitForShutdown() {
	<-s.didShutdown
}

/**
 * Idea:
 *  - have x (used) + c (idle) nodes in the cluster all the time.
 *
 * The understand the idea behind this implementation here some statements reflecting our current knowledge about the
 * Google NodePool autoscaler:
 *  - it inspects its NodePool every 12s
 *  - based on the created pods and available nodes it calculates the desired number of nodes
 *  - the autoscaler itself is a controller that manages a slow-response system - and knows that: Once it receives a
 *    edge in the desired # of nodes it waits until the requested nodes are 'Ready' before decreasing the number again
 *    to avoid oscillation
 *  - it takes nodeAffinity into account but with an important limitation: it makes the assumption that all labels on
 *    all nodes are equal (!)
 *
 * Approach:
 *  - we deploy n pods with a given factor of workspace slots (smaller then max slots/nodes) and start them in
 *   parallel. In practice this turned out to be quite effective.
 */
func (s *Scaler) scalingPeriod(ctx context.Context) (err error) {
	span, ctx := tracing.FromContext(ctx, "scalingPeriod")
	defer tracing.FinishSpan(span, &err)
	log.Info("scaling period started")

	// Check for existing buffer pods
	labelSelector := labels.SelectorFromSet(labels.Set(staticBufferLabels()))
	pods, err := s.Clientset.CoreV1().Pods(s.Config.Namespace).List(metav1.ListOptions{
		LabelSelector: labelSelector.String(),
	})
	if err != nil {
		return xerrors.Errorf("cannot list existing buffer pods: %w", err)
	}

	// Delete existing buffer pods
	log.Debug("starting cleanup")
	err = s.cleanupSucceededBufferPods(ctx, pods)
	if err != nil {
		span.SetTag("cleanup", "failed")
		log.WithError(err).Debug("error during cleanup, cancelling current period")
		return nil
	}
	log.Debug("finished cleanup")

	// We don't want to overshoot, or worse: Have hanging scaling buffers max out our limits.
	// Have this as safe guard
	// The expectation is that all our buffers finish execution within a period. If they don't we're already
	// scaling up because of pressure. In this case the auto scaler will already be busy creating new nodes to
	// satisfy our current deployed needs. In this situation we don't want create even more pressure and rather skip
	// a period to not spam our system.
	nrOfRunningPods := countNrOfRunningBufferPods(pods)
	if nrOfRunningPods > 0 {
		log.Debugf(`Still %d buffers running, cancelling current period`, nrOfRunningPods)
		return nil
	}

	// Create as many buffer pods as configured
	for i := 0; i < s.Config.BufferFactor; i++ {
		uuid, uuidErr := uuid.NewUUID()
		if uuidErr != nil {
			return uuidErr
		}
		pod := renderBufferPod(s.Config, uuid.String(), staticBufferLabels())
		log.Debugf("created buffer pod: %s", pod.Name)

	}

	log.Info("scaling period finished")

	return nil
}

func (s *Scaler) cleanupSucceededBufferPods(ctx context.Context, podList *corev1.PodList) error {
	span, ctx := tracing.FromContext(ctx, "cleanupSucceededBufferPods")
	defer tracing.FinishSpan(span, nil)

	foreground := metav1.DeletePropagationForeground
	for _, pod := range podList.Items {
		err := s.Clientset.CoreV1().Pods(s.Config.Namespace).Delete(pod.Name, &metav1.DeleteOptions{
			PropagationPolicy: &foreground,
		})
		if err != nil {
			// Not being able to delete a buffer is not a deal breaker but we don't want to proceed with the current period and create even more pods, so: exit
			return err
		}
	}

	return nil
}

func staticBufferLabels() map[string]string {
	return map[string]string{
		"app":       "gitpod",
		"component": component,
		"isBuffer":  "true",
	}
}

func countNrOfRunningBufferPods(podList *corev1.PodList) int {
	nrOfRunningPods := 0
	for _, p := range podList.Items {
		if p.Status.Phase == corev1.PodRunning || p.Status.Phase == corev1.PodPending {
			nrOfRunningPods++
		}
	}
	return nrOfRunningPods
}
