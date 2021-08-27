// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"context"
	"strings"
	"testing"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	fakek8s "k8s.io/client-go/kubernetes/fake"
	testingk8s "k8s.io/client-go/testing"
)

var (
	testBaseTime  = time.Date(2020, 01, 01, 01, 01, 0, 0, time.UTC)
	testNamespace = "default"
)

type ExpectedSchedulingResult struct {
	Result             SchedulingResult
	DeletedGhost       string
	DelayGhostDeletion bool
}
type Expectation = map[string]ExpectedSchedulingResult

func TestSchedulePod(t *testing.T) {
	tests := []struct {
		Desc         string
		Nodes        []*corev1.Node
		AssignedPods []*corev1.Pod
		QueuedPods   []*corev1.Pod
		Expectations []Expectation
	}{
		{
			Desc: "schedule all pods in one cycle",
			Nodes: []*corev1.Node{
				createTNode("node1", "10000Mi"),
			},
			AssignedPods: []*corev1.Pod{
				createWorkspacePod("ws0", "2000Mi", "node1", corev1.PodRunning, "100s"),
			},
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws1", "2000Mi", "", corev1.PodPending, "10s"),
				createWorkspacePod("ws2", "2000Mi", "", corev1.PodPending, "8s"),
			},
			Expectations: []Expectation{
				{
					"ws1": {
						Result: resultBound,
					},
					"ws2": {
						Result: resultBound,
					},
				},
			},
		},
		{
			Desc: "schedule two pods in two cycles",
			Nodes: []*corev1.Node{
				createTNode("node1", "11000Mi"),
			},
			AssignedPods: []*corev1.Pod{
				createWorkspacePod("ws0", "2000Mi", "node1", corev1.PodRunning, "100s"),
				createGhostPod("ghost1", "2000Mi", "node1", corev1.PodRunning, "101s"),
				createGhostPod("ghost2", "2000Mi", "node1", corev1.PodRunning, "102s"),
				createGhostPod("ghost3", "2000Mi", "node1", corev1.PodRunning, "103s"),
			},
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws1", "2000Mi", "", corev1.PodPending, "10s"),
				createWorkspacePod("ws2", "2000Mi", "", corev1.PodPending, "8s"),
			},
			Expectations: []Expectation{
				{
					"ws1": {
						Result: resultBound,
					},
					"ws2": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost3",
					},
				},
				{
					"ws2": {
						Result: resultBound,
					},
				},
			},
		},
		{
			Desc: "replace exactly all ghosts on node",
			Nodes: []*corev1.Node{
				createTNode("node1", "11000Mi"),
			},
			AssignedPods: []*corev1.Pod{
				createGhostPod("ghost1", "2000Mi", "node1", corev1.PodRunning, "101s"),
				createGhostPod("ghost2", "2000Mi", "node1", corev1.PodRunning, "102s"),
				createGhostPod("ghost3", "2000Mi", "node1", corev1.PodRunning, "103s"),
				createGhostPod("ghost4", "2000Mi", "node1", corev1.PodRunning, "104s"),
				createGhostPod("ghost5", "2000Mi", "node1", corev1.PodRunning, "105s"),
			},
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws1", "2000Mi", "", corev1.PodPending, "11s"),
				createWorkspacePod("ws2", "2000Mi", "", corev1.PodPending, "12s"),
				createWorkspacePod("ws3", "2000Mi", "", corev1.PodPending, "13s"),
				createWorkspacePod("ws4", "2000Mi", "", corev1.PodPending, "14s"),
				createWorkspacePod("ws5", "2000Mi", "", corev1.PodPending, "15s"),
			},
			Expectations: []Expectation{
				{
					"ws5": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost5",
					},
					"ws4": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost4",
					},
					"ws3": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost3",
					},
					"ws2": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost2",
					},
					"ws1": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost1",
					},
				},
			},
		},
		{
			Desc: "replace all ghosts, but still not enough space",
			Nodes: []*corev1.Node{
				createTNode("node1", "11000Mi"),
			},
			AssignedPods: []*corev1.Pod{
				createWorkspacePod("ws0", "2000Mi", "node1", corev1.PodRunning, "100s"),
				createGhostPod("ghost1", "2000Mi", "node1", corev1.PodRunning, "101s"),
				createGhostPod("ghost2", "2000Mi", "node1", corev1.PodRunning, "102s"),
				createGhostPod("ghost3", "2000Mi", "node1", corev1.PodRunning, "103s"),
				createGhostPod("ghost4", "2000Mi", "node1", corev1.PodRunning, "104s"),
			},
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws1", "2000Mi", "", corev1.PodPending, "11s"),
				createWorkspacePod("ws2", "2000Mi", "", corev1.PodPending, "12s"),
				createWorkspacePod("ws3", "2000Mi", "", corev1.PodPending, "13s"),
				createWorkspacePod("ws4", "2000Mi", "", corev1.PodPending, "14s"),
				createWorkspacePod("ws5", "2000Mi", "", corev1.PodPending, "15s"),
			},
			Expectations: []map[string]ExpectedSchedulingResult{
				{
					"ws5": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost4",
					},
					"ws4": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost3",
					},
					"ws3": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost2",
					},
					"ws2": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost1",
					},
					"ws1": {
						Result: resultUnschedulableNoResources,
					},
				},
				{
					"ws5": {
						Result: resultBound,
					},
					"ws4": {
						Result: resultBound,
					},
					"ws3": {
						Result: resultBound,
					},
					"ws2": {
						Result: resultBound,
					},
					"ws1": {
						Result: resultUnschedulableNoResources,
					},
				},
			},
		},
		{
			Desc: "replace all ghosts, but still not enough space - two nodes",
			Nodes: []*corev1.Node{
				createTNode("node1", "11000Mi"),
				createTNode("node2", "11000Mi"),
			},
			AssignedPods: []*corev1.Pod{
				createWorkspacePod("ws00", "2000Mi", "node1", corev1.PodRunning, "100s"),
				createWorkspacePod("ws01", "2000Mi", "node1", corev1.PodRunning, "101s"),
				createGhostPod("ghost01", "2000Mi", "node1", corev1.PodRunning, "102s"),
				createGhostPod("ghost02", "2000Mi", "node1", corev1.PodRunning, "103s"),
				createGhostPod("ghost03", "2000Mi", "node1", corev1.PodRunning, "104s"),
				createWorkspacePod("ws10", "2000Mi", "node2", corev1.PodRunning, "100s"),
				createGhostPod("ghost11", "2000Mi", "node2", corev1.PodRunning, "101s"),
				createGhostPod("ghost12", "2000Mi", "node2", corev1.PodRunning, "102s"),
				createGhostPod("ghost13", "2000Mi", "node2", corev1.PodRunning, "103s"),
				createGhostPod("ghost14", "2000Mi", "node2", corev1.PodRunning, "104s"),
			},
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws0", "2000Mi", "", corev1.PodPending, "10s"),
				createWorkspacePod("ws1", "2000Mi", "", corev1.PodPending, "11s"),
				createWorkspacePod("ws2", "2000Mi", "", corev1.PodPending, "12s"),
				createWorkspacePod("ws3", "2000Mi", "", corev1.PodPending, "13s"),
				createWorkspacePod("ws4", "2000Mi", "", corev1.PodPending, "14s"),
				createWorkspacePod("ws5", "2000Mi", "", corev1.PodPending, "15s"),
				createWorkspacePod("ws6", "2000Mi", "", corev1.PodPending, "16s"),
				createWorkspacePod("ws7", "2000Mi", "", corev1.PodPending, "17s"),
			},
			Expectations: []map[string]ExpectedSchedulingResult{
				{
					"ws7": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost03",
					},
					"ws6": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost02",
					},
					"ws5": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost01",
					},
					"ws4": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost14",
					},
					"ws3": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost13",
					},
					"ws2": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost12",
					},
					"ws1": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost11",
					},
					"ws0": {
						Result: resultUnschedulableNoResources,
					},
				},
				{
					"ws7": {
						Result: resultBound,
					},
					"ws6": {
						Result: resultBound,
					},
					"ws5": {
						Result: resultBound,
					},
					"ws4": {
						Result: resultBound,
					},
					"ws3": {
						Result: resultBound,
					},
					"ws2": {
						Result: resultBound,
					},
					"ws1": {
						Result: resultBound,
					},
					"ws0": {
						Result: resultUnschedulableNoResources,
					},
				},
			},
		},
		{
			Desc: "replace all ghosts, but still not enough space - delayed delete",
			Nodes: []*corev1.Node{
				createTNode("node1", "11000Mi"),
			},
			AssignedPods: []*corev1.Pod{
				createWorkspacePod("ws0", "2000Mi", "node1", corev1.PodRunning, "100s"),
				createGhostPod("ghost1", "2000Mi", "node1", corev1.PodRunning, "101s"),
				createGhostPod("ghost2", "2000Mi", "node1", corev1.PodRunning, "102s"),
				createGhostPod("ghost3", "2000Mi", "node1", corev1.PodRunning, "103s"),
				createGhostPod("ghost4", "2000Mi", "node1", corev1.PodRunning, "104s"),
			},
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws1", "2000Mi", "", corev1.PodPending, "11s"),
				createWorkspacePod("ws2", "2000Mi", "", corev1.PodPending, "12s"),
				createWorkspacePod("ws3", "2000Mi", "", corev1.PodPending, "13s"),
				createWorkspacePod("ws4", "2000Mi", "", corev1.PodPending, "14s"),
				createWorkspacePod("ws5", "2000Mi", "", corev1.PodPending, "15s"),
			},
			Expectations: []map[string]ExpectedSchedulingResult{
				{
					"ws5": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost4",
					},
					"ws4": {
						Result:             resultDeletedGhost,
						DeletedGhost:       "ghost3",
						DelayGhostDeletion: true,
					},
					"ws3": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost2",
					},
					"ws2": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost1",
					},
					"ws1": {
						Result: resultUnschedulableNoResources,
					},
				},
				{
					"ws5": {
						Result: resultBound,
					},
					"ws4": {
						Result:       resultDeletedGhost,
						DeletedGhost: "ghost3",
					},
					"ws3": {
						Result: resultBound,
					},
					"ws2": {
						Result: resultBound,
					},
					"ws1": {
						Result: resultUnschedulableNoResources,
					},
				},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			// preparation
			var objs []runtime.Object
			for _, n := range test.Nodes {
				objs = append(objs, n)
			}
			for _, p := range test.AssignedPods {
				objs = append(objs, p)
			}
			for _, qp := range test.QueuedPods {
				objs = append(objs, qp)
			}

			client := fakek8s.NewSimpleClientset(objs...)
			// we want to make sure all Pod.Delete operation happen when we want them to happen
			lockDeletes := true
			delayDeletes := false
			delayedDeletes := make(map[string]bool)
			deletes := make(map[string]bool)
			lockStepDeleteReactor := func(action testingk8s.Action) (handled bool, ret runtime.Object, err error) {
				if !lockDeletes {
					return false, nil, nil
				}

				name := action.(testingk8s.DeleteAction).GetName()
				if delayDeletes {
					delayedDeletes[name] = true
				} else {
					deletes[name] = true
				}
				return true, nil, nil
			}
			client.PrependReactor("delete", "pods", lockStepDeleteReactor)

			scheduler, err := NewScheduler(Configuration{
				Namespace:     testNamespace,
				SchedulerName: "test-ws-scheduler",
				StrategyName:  "DensityAndExperience",
				DensityAndExperienceConfig: &DensityAndExperienceConfig{
					WorkspaceFreshPeriodSeconds: 120,
					NodeFreshWorkspaceLimit:     2,
				},
			}, client)
			if err != nil {
				t.Errorf("unexpected error: %+q", err)
				return
			}
			ctx, cancel := context.WithCancel(context.Background())
			scheduler.startInformer(ctx)

			bindPodToNode := func(ctx context.Context, pod *corev1.Pod, nodeName string, createEventFn CreateEventFunc) error {
				// fake the effect of a binding here so we can test against it later
				for _, p := range test.QueuedPods {
					if p.Name != pod.Name {
						continue
					}
					p.Spec.NodeName = nodeName
					return nil
				}
				return xerrors.Errorf("could not find pod to bind: %s", pod.Name)
			}
			createEvent := func(ctx context.Context, namespace string, event *corev1.Event, opts metav1.CreateOptions) error {
				// drop all events as they are not needed for functionality and the fake clienset does not support them
				return nil
			}

			for _, qp := range test.QueuedPods {
				scheduler.queue.Add(qp)
			}

			// actually run the test
			for _, expectation := range test.Expectations {
				cycleCtx, cancelCycleCtx := context.WithTimeout(ctx, 10*time.Second)

				for i := 0; i < len(expectation); i++ {
					pi, wasClosed := scheduler.queue.Pop()
					if wasClosed {
						t.Fatalf("queue was closed but still expected pods!")
					}
					exp, present := expectation[pi.Pod.Name]
					if !present {
						t.Fatalf("missing testdata: no expectation for pod '%s'!", pi.Pod.Name)
					}
					delayDeletes = exp.DelayGhostDeletion

					t.Logf("scheduling: %s", pi.Pod.Name)
					result, err := scheduler.schedulePod(cycleCtx, pi, bindPodToNode, createEvent)
					if err != nil {
						t.Fatal(err)
					}
					if result != exp.Result {
						t.Fatalf("'%s': expected result '%s', got '%s'!", pi.Pod.Name, exp.Result, result)
					}
				}

				// perform all deletes and make sure they're done
				lockDeletes = false
				for podToDelete := range deletes {
					err = client.CoreV1().Pods(testNamespace).Delete(cycleCtx, podToDelete, metav1.DeleteOptions{})
					if err != nil {
						t.Fatal(err)
					}
				}
				deletes = delayedDeletes
				delayedDeletes = make(map[string]bool)
				lockDeletes = true
				waitForAllGhostToBeDeleted(t, cycleCtx, client, expectation)

				// compare result
				for podName, exp := range expectation {
					qp := findPod(podName, test.QueuedPods)
					if qp == nil {
						t.Fatalf("inconsistent test data: ")
					}

					if exp.Result == resultBound {
						if qp.Spec.NodeName == "" {
							t.Fatalf("expected pod '%s' to be bound but it wasn't!", qp.Name)
						}
					} else if exp.Result == resultDeletedGhost {
						if qp.Spec.NodeName != "" {
							t.Fatalf("expected pod '%s' to be unbound but it was bound to '%s'!", qp.Name, qp.Spec.NodeName)
						}
					}
					if exp.DeletedGhost != "" && !exp.DelayGhostDeletion {
						_, err := client.CoreV1().Pods(testNamespace).Get(cycleCtx, exp.DeletedGhost, metav1.GetOptions{})
						if err == nil {
							t.Fatalf("expected ghost '%s' to be deleted for '%s' but was still present", exp.DeletedGhost, qp.Name)
						}
						if !strings.HasSuffix(err.Error(), "not found") {
							t.Fatal(err)
						}
					}
				}

				// make sure this round is "done" and we get a defined state for the next cycle
				scheduler.queue.MoveAllToActive()
				cancelCycleCtx()
			}

			// cleanup
			cancel()
			scheduler.queue.Close()
		})
	}
}

func waitForAllGhostToBeDeleted(t *testing.T, ctx context.Context, client *fakek8s.Clientset, expectation Expectation) {
	toDelete := map[string]bool{}
	for _, exp := range expectation {
		if exp.DeletedGhost == "" ||
			exp.DelayGhostDeletion {
			continue
		}
		toDelete[exp.DeletedGhost] = true
	}
	if len(toDelete) == 0 {
		return
	}

	allDeletedChan := make(chan struct{}, 1)
	go func() {
		defer close(allDeletedChan)

		ticker := time.NewTicker(1 * time.Second)
		for {
			select {
			case <-ticker.C:
				list, err := client.CoreV1().Pods(testNamespace).List(ctx, metav1.ListOptions{
					LabelSelector: "workspaceType=ghost",
				})
				if err != nil {
					t.Error(err)
					return
				}

				for _, p := range list.Items {
					if _, exists := toDelete[p.Name]; exists {
						continue
					}
				}
				return
			case <-ctx.Done():
				t.Error("cycle context timed out while waiting for ghost to be deleted")
				return
			}
		}
	}()

	<-allDeletedChan
}

func findPod(name string, queued []*corev1.Pod) *corev1.Pod {
	for _, q := range queued {
		if q.Name == name {
			return q
		}
	}
	return nil
}

func createTNode(name string, ram string) *corev1.Node {
	return &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Status: corev1.NodeStatus{
			Allocatable: corev1.ResourceList{
				corev1.ResourceMemory: res.MustParse(ram),
			},
		},
	}
}

func createWorkspacePod(name string, ram string, nodeName string, phase corev1.PodPhase, age string) *corev1.Pod {
	return createTPod(name, ram, nodeName, phase, age, map[string]string{
		"component":     "workspace",
		wsk8s.TypeLabel: "regular",
	})
}

func createGhostPod(name string, ram string, nodeName string, phase corev1.PodPhase, age string) *corev1.Pod {
	return createTPod(name, ram, nodeName, phase, age, map[string]string{
		"component":     "workspace",
		"headless":      "true",
		wsk8s.TypeLabel: "ghost",
	})
}

func createTPod(name string, ram string, nodeName string, phase corev1.PodPhase, ageStr string, labels map[string]string) *corev1.Pod {
	creationTimestamp := testBaseTime.Add(-MustParseDuration(ageStr))
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         testNamespace,
			CreationTimestamp: metav1.NewTime(creationTimestamp),
			UID:               types.UID(name),
			Labels:            labels,
		},
		Spec: corev1.PodSpec{
			NodeName: nodeName,
			Containers: []corev1.Container{
				{
					Name:  "workspace",
					Image: testWorkspaceImage,
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceMemory: res.MustParse(ram),
						},
					},
				},
			},
		},
		Status: corev1.PodStatus{
			Phase: phase,
		},
	}
}

func MustParseDuration(str string) time.Duration {
	dur, err := time.ParseDuration(str)
	if err != nil {
		panic("duration does not parse")
	}
	return dur
}
