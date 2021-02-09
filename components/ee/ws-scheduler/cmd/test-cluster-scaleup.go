// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"

	"github.com/spf13/cobra"
	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

var testPodIdentifier map[string]string = map[string]string{
	"component": "test-cluster-scaleup",
}
var workspaceNodeIdentifier map[string]string = map[string]string{
	"gitpod.io/workload_workspace": "true",
}

const testNamespace = "default"
const workspaceSizeBytes = int64(4 * 1024 * 1024 * 1024)

// I tested this on staging.us-east4. To get a valid kubeconfig in gitpod:
//  1. gcloud auth login <email>
//  2. yarn gp install-contexts
//  3. kubectl config use-context staging.us-east4

// testClusterScaleupCmd represents the testClusterScaleup command
var testClusterScaleupCmd = &cobra.Command{
	Use:   "cluster-scaleup",
	Short: "Generates and goes through a complex cluster scaleup scenario and test invariants on the way",
	Args:  cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		clientSet, err := newClientSet()
		if err != nil {
			log.WithError(err).Fatal("cannot connect to Kubernetes")
		}
		log.Info("connected to Kubernetes")

		sigChan := make(chan os.Signal, 1)
		stopChan := make(chan struct{}, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-sigChan
			log.Warnf("Received signal, quitting!")
			stopChan <- struct{}{}
		}()

		err = playScaleupScenario(clientSet, stopChan)
		if err != nil {
			log.WithError(err).Fatal("error while playing scenario")
		}
	},
}

func playScaleupScenario(clientSet *kubernetes.Clientset, stopChan chan struct{}) (err error) {
	defer cleanup(clientSet)
	log.Infof("Starting scenario scaleup...")

	// 1. start as much workspace-like nodes necessary to just fill all current nodes
	// Wait until pods are running, check state
	log.Infof("Step 1: Starting...")
	state, err := buildCurrentState(clientSet)
	if err != nil {
		return err
	}

	slotsToFill := calcEmptySlots(scheduler.NodeMapToList(state.Nodes))
	log.Infof("Starting %d filler pods...", slotsToFill)
	err = startTestPods(clientSet, slotsToFill, "filler")
	if err != nil {
		return err
	}

	log.Infof("Waiting for pods to become scheduled...")
	err = waitUntilAllTestPodsAreScheduled(clientSet, stopChan)
	if err != nil {
		return err
	}
	log.Infof("All filler pods are scheduled.")

	// Verify expected state: All nodes are full
	stateFilled, err := buildCurrentState(clientSet)
	if err != nil {
		return err
	}
	slotsLeft := calcEmptySlots(scheduler.NodeMapToList(stateFilled.Nodes))
	if slotsLeft != 0 {
		return xerrors.Errorf("Expected all nodes to be full, but had %d free slots left!", slotsLeft)
	}
	filledNodes := len(stateFilled.Nodes)
	log.Infof("All %d nodes are full", len(stateFilled.Nodes))
	log.Infof("Step 1: Done.")

	// Interrupted?
	select {
	case <-stopChan:
		return xerrors.Errorf("cancelled")
	default:
	}

	// 2. Add additional nodes that will cause OutOfMemory errors because:
	//  - there's no space left on the nodes
	//  - they will be created - and thus scheduled - in a very short timeframe
	log.Infof("Step 2: Starting...")

	// 2.1 All nodes are still full
	stateOverflow, err := buildCurrentState(clientSet)
	if err != nil {
		return err
	}

	slotsLeftAfterOverflow := calcEmptySlots(scheduler.NodeMapToList(stateOverflow.Nodes))
	if slotsLeftAfterOverflow != 0 {
		return xerrors.Errorf("Expected all nodes to be more than full, but had %d free slots left!", slotsLeftAfterOverflow)
	}
	log.Infof("All %d nodes are still full", len(stateFilled.Nodes))

	// 2.2 Still the same number of nodes (no scaleup yet!)
	nodesAfterOverflow := len(stateOverflow.Nodes)
	if nodesAfterOverflow != filledNodes {
		return xerrors.Errorf("We're interrupted by a scaleup! (were %d nodes, are %d now) Please try again", filledNodes, nodesAfterOverflow)
	}
	log.Infof("We were not interrupted by a scaleup")

	// 2.3 Start OOM pods
	oomPodCount := 4
	log.Infof("Starting %d oom pods...", oomPodCount)
	err = startTestPods(clientSet, oomPodCount, "oom")
	if err != nil {
		return err
	}

	log.Infof("Waiting for pods to become scheduled...")
	err = waitUntilAllTestPodsAreScheduled(clientSet, stopChan)
	if err != nil {
		return err
	}
	log.Infof("All oom pods are scheduled.")

	// 2.3 No OutOfMemory
	for _, p := range stateOverflow.Pods {
		if p.Status.Phase == corev1.PodFailed && p.Status.Reason == "OutOfMemory" {
			return xerrors.Errorf("OutOfMemory error: %s", p.Name)
		}
	}
	log.Infof("No OutOfMemory error detected")

	log.Infof("Step 2: Done.")
	return nil
}

func waitUntilAllTestPodsAreScheduled(clientSet *kubernetes.Clientset, stopChan chan struct{}) error {
	for {
		select {
		case <-time.After(2 * time.Second):
			pods, err := clientSet.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{
				LabelSelector: labels.SelectorFromSet(testPodIdentifier).String(),
			})
			if err != nil {
				return err
			}

			allNodesRunning := true
			for _, p := range pods.Items {
				if p.Status.Phase == corev1.PodFailed {
					return xerrors.Errorf("Pod %s failed: %s", p.Name, p.Status.Reason)
				}

				podIsScheduled := false
				for _, c := range p.Status.Conditions {
					if c.Type == corev1.PodScheduled && c.Status == "True" {
						podIsScheduled = true
						break
					}
				}
				allNodesRunning = allNodesRunning && podIsScheduled
			}
			if allNodesRunning {
				return nil
			}
			continue
		case <-time.After(1 * time.Minute):
			return xerrors.Errorf("timeout: pods are not running yet!")
		case <-stopChan:
			return xerrors.Errorf("interrupted")
		}
	}
}

func buildCurrentState(clientSet *kubernetes.Clientset) (*scheduler.State, error) {
	allWorkspaceNodes, err := clientSet.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{
		LabelSelector: labels.SelectorFromSet(workspaceNodeIdentifier).String(),
	})
	if err != nil {
		log.WithError(err).Fatal("cannot list nodes")
		return nil, err
	}
	potentialNodes := make([]*corev1.Node, 0)
	for i := 0; i < len(allWorkspaceNodes.Items); i++ {
		if allWorkspaceNodes.Items[i].Spec.Unschedulable {
			continue
		}
		potentialNodes = append(potentialNodes, &allWorkspaceNodes.Items[i])
	}

	allPods, err := clientSet.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.WithError(err).Fatal("cannot list pods")
		return nil, err
	}

	pods := make([]*corev1.Pod, len(allPods.Items))
	for i := range allPods.Items {
		pods[i] = &allPods.Items[i]
	}

	ramSafetyBuffer := res.MustParse("0Mi")
	state := scheduler.ComputeState(potentialNodes, pods, nil, &ramSafetyBuffer, true, testNamespace)
	return state, nil
}

func startTestPods(clientSet *kubernetes.Clientset, count int, suffix string) error {
	for i := 1; i <= count; i++ {
		err := startTestPod(clientSet, i, suffix)
		if err != nil {
			return err
		}
	}
	return nil
}

func startTestPod(clientSet *kubernetes.Clientset, nr int, suffix string) error {
	root := int64(0)
	boolTrue := true
	pod := corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:   fmt.Sprintf("test-pod-%s-%d", suffix, nr),
			Labels: testPodIdentifier,
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: "workspace-privileged",
			SchedulerName:      "workspace-scheduler",
			Affinity: &corev1.Affinity{
				NodeAffinity: &corev1.NodeAffinity{
					RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
						NodeSelectorTerms: []corev1.NodeSelectorTerm{
							{
								MatchExpressions: []corev1.NodeSelectorRequirement{
									{
										Key:      "gitpod.io/workload_workspace",
										Operator: corev1.NodeSelectorOpIn,
										Values:   []string{"true"},
									},
								},
							},
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:    "main",
					Image:   "alpine:latest",
					Command: []string{"bash", "-c", "while true; do sleep 2; echo 'sleeping...'; done"},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							"memory": res.MustParse(fmt.Sprintf("%d", workspaceSizeBytes)),
						},
					},
					SecurityContext: &corev1.SecurityContext{
						Privileged:               &boolTrue,
						RunAsUser:                &root,
						RunAsGroup:               &root,
						AllowPrivilegeEscalation: &boolTrue,
					},
				},
			},
		},
	}
	_, err := clientSet.CoreV1().Pods(testNamespace).Create(context.Background(), &pod, metav1.CreateOptions{})
	return err
}

func calcEmptySlots(nodes []*scheduler.Node) int {
	var slots int
	for _, n := range nodes {
		availBytes := n.RAM.Available.Value()
		if availBytes > 0 {
			freeSlots := int(availBytes / workspaceSizeBytes)
			slots += freeSlots
		}
	}
	return slots
}

func cleanup(clientSet *kubernetes.Clientset) {
	foreground := metav1.DeletePropagationForeground
	err := clientSet.CoreV1().Pods(testNamespace).DeleteCollection(context.Background(), metav1.DeleteOptions{
		PropagationPolicy: &foreground,
	}, metav1.ListOptions{
		LabelSelector: labels.SelectorFromSet(testPodIdentifier).String(),
	})
	if err != nil {
		log.WithError(err).Debug("Error while deleting test pods")
	}
	log.Infof("Cleanup done.")
}

func init() {
	testCmd.AddCommand(testClusterScaleupCmd)
}
