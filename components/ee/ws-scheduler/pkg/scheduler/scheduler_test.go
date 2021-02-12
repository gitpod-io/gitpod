// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"context"
	"sort"
	"testing"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/google/go-cmp/cmp"
	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	fakek8s "k8s.io/client-go/kubernetes/fake"
)

var (
	testWorkspaceImage             = "gitpod/workspace-full"
	perssureToleranceSeconds int64 = 30
)

func TestGatherPotentialNodesFor(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.WarnLevel)

	tests := []struct {
		Desc           string
		Nodes          []*corev1.Node
		Pod            *corev1.Pod
		CandidateNodes []string
	}{
		{
			Desc: "same effect toleration",
			Nodes: []*corev1.Node{
				createNode("n1", []corev1.Taint{{Effect: corev1.TaintEffectNoSchedule, Key: "DiskPressure", Value: "true"}}),
				createNode("n2", nil),
			},
			Pod:            createPod("foo", []corev1.Toleration{{Key: "DiskPressure", Effect: corev1.TaintEffectNoSchedule, Value: "true"}}),
			CandidateNodes: []string{"n1", "n2"},
		},
		{
			Desc: "other effect toleration",
			Nodes: []*corev1.Node{
				createNode("n1", []corev1.Taint{{Key: "DiskPressure", Value: "true"}}),
				createNode("n2", nil),
			},
			Pod:            createPod("foo", []corev1.Toleration{{Key: "DiskPressure", Effect: corev1.TaintEffectNoExecute, Value: "true"}}),
			CandidateNodes: []string{"n1", "n2"},
		},
		{
			Desc: "untolerated",
			Nodes: []*corev1.Node{
				createNode("n1", []corev1.Taint{{Effect: corev1.TaintEffectNoSchedule, Key: "node.kubernetes.io/disk-pressure", Value: "true"}}),
				createNode("n2", nil),
			},
			Pod: createPod("foo", []corev1.Toleration{
				{
					Key:      "node.kubernetes.io/disk-pressure",
					Operator: "Exists",
					Effect:   "NoExecute",
					// Tolarate Indefinitely
				},
				{
					Key:      "node.kubernetes.io/memory-pressure",
					Operator: "Exists",
					Effect:   "NoExecute",
					// Tolarate Indefinitely
				},
				{
					Key:               "node.kubernetes.io/network-unavailable",
					Operator:          "Exists",
					Effect:            "NoExecute",
					TolerationSeconds: &perssureToleranceSeconds,
				},
			}),
			CandidateNodes: []string{"n2"},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			var objs []runtime.Object
			for _, n := range test.Nodes {
				objs = append(objs, n)
			}
			objs = append(objs, test.Pod)

			client := fakek8s.NewSimpleClientset(objs...)
			scheduler, err := NewScheduler(Configuration{}, client)
			if err != nil {
				t.Errorf("unexpected error: %+q", err)
				return
			}

			ctx, cancel := context.WithCancel(context.Background())
			scheduler.queue = NewPriorityQueue(SortByPriority, queueInitialBackoff, queueMaximumBackoff)
			scheduler.startInformer(ctx)

			candidates, err := scheduler.gatherPotentialNodesFor(context.Background(), test.Pod)
			cancel()

			if err != nil {
				t.Errorf("unexpected error: %+q", err)
				return
			}

			cn := make([]string, len(candidates))
			for i, c := range candidates {
				cn[i] = c.Name
			}
			sort.Slice(cn, func(i, j int) bool { return cn[i] < cn[j] })
			sort.Slice(test.CandidateNodes, func(i, j int) bool { return test.CandidateNodes[i] < test.CandidateNodes[j] })

			if diff := cmp.Diff(test.CandidateNodes, cn); diff != "" {
				t.Errorf("unexpected candidate nodes (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRequiredServices(t *testing.T) {
	tests := []struct {
		Desc        string
		Nodes       []*corev1.Node
		Pods        []*corev1.Pod
		TargetPod   *corev1.Pod
		Expectation []string
	}{
		{
			Desc: "node with service",
			Nodes: []*corev1.Node{
				createNode("node1", nil),
			},
			Pods: []*corev1.Pod{
				createPod("some-pod", nil),
				createPod("some-other-pod", nil),
				modifyPod(createPod("service", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "service",
					}
					p.Spec.NodeName = "node1"
				}),
			},
			TargetPod: modifyPod(createPod("target-pod", nil), func(p *corev1.Pod) {
				p.Annotations = map[string]string{
					wsk8s.RequiredNodeServicesAnnotation: "service",
				}
			}),
			Expectation: []string{"node1"},
		},
		{
			Desc: "node without service",
			Nodes: []*corev1.Node{
				createNode("node1", nil),
			},
			Pods: []*corev1.Pod{
				createPod("some-pod", nil),
				createPod("some-other-pod", nil),
			},
			TargetPod: modifyPod(createPod("target-pod", nil), func(p *corev1.Pod) {
				p.Annotations = map[string]string{
					wsk8s.RequiredNodeServicesAnnotation: "service",
				}
			}),
		},
		{
			Desc: "two nodes with service",
			Nodes: []*corev1.Node{
				createNode("node1", nil),
				createNode("node2", nil),
			},
			Pods: []*corev1.Pod{
				createPod("some-pod", nil),
				createPod("some-other-pod", nil),
				modifyPod(createPod("service", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "service",
					}
					p.Spec.NodeName = "node2"
				}),
			},
			TargetPod: modifyPod(createPod("target-pod", nil), func(p *corev1.Pod) {
				p.Annotations = map[string]string{
					wsk8s.RequiredNodeServicesAnnotation: "service",
				}
			}),
			Expectation: []string{"node2"},
		},
		{
			Desc: "require two services - no node",
			Nodes: []*corev1.Node{
				createNode("node1", nil),
				createNode("node2", nil),
			},
			Pods: []*corev1.Pod{
				createPod("some-pod", nil),
				createPod("some-other-pod", nil),
				modifyPod(createPod("service", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "service",
					}
					p.Spec.NodeName = "node2"
				}),
			},
			TargetPod: modifyPod(createPod("target-pod", nil), func(p *corev1.Pod) {
				p.Annotations = map[string]string{
					wsk8s.RequiredNodeServicesAnnotation: "service,another",
				}
			}),
		},
		{
			Desc: "require two services - no node complete",
			Nodes: []*corev1.Node{
				createNode("node1", nil),
				createNode("node2", nil),
			},
			Pods: []*corev1.Pod{
				createPod("some-pod", nil),
				createPod("some-other-pod", nil),
				modifyPod(createPod("service", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "service",
					}
					p.Spec.NodeName = "node1"
				}),
				modifyPod(createPod("another", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "another",
					}
					p.Spec.NodeName = "node2"
				}),
			},
			TargetPod: modifyPod(createPod("target-pod", nil), func(p *corev1.Pod) {
				p.Annotations = map[string]string{
					wsk8s.RequiredNodeServicesAnnotation: "service,another",
				}
			}),
		},
		{
			Desc: "require two services - positive",
			Nodes: []*corev1.Node{
				createNode("node1", nil),
				createNode("node2", nil),
			},
			Pods: []*corev1.Pod{
				createPod("some-pod", nil),
				createPod("some-other-pod", nil),
				modifyPod(createPod("service", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "service",
					}
					p.Spec.NodeName = "node2"
				}),
				modifyPod(createPod("another", nil), func(p *corev1.Pod) {
					p.Labels = map[string]string{
						wsk8s.GitpodNodeServiceLabel: "another",
					}
					p.Spec.NodeName = "node2"
				}),
			},
			TargetPod: modifyPod(createPod("target-pod", nil), func(p *corev1.Pod) {
				p.Annotations = map[string]string{
					wsk8s.RequiredNodeServicesAnnotation: "service,another",
				}
			}),
			Expectation: []string{"node2"},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			var objs []runtime.Object
			for _, n := range test.Nodes {
				objs = append(objs, n)
			}
			for _, p := range test.Pods {
				objs = append(objs, p)
			}

			client := fakek8s.NewSimpleClientset(objs...)
			scheduler, err := NewScheduler(Configuration{}, client)
			if err != nil {
				t.Errorf("unexpected error: %+q", err)
				return
			}

			ctx, cancel := context.WithCancel(context.Background())
			scheduler.queue = NewPriorityQueue(SortByPriority, queueInitialBackoff, queueMaximumBackoff)
			scheduler.startInformer(ctx)

			state, err := scheduler.buildState(ctx, test.TargetPod, wsk8s.IsNonGhostWorkspace(test.TargetPod))
			cancel()
			if err != nil {
				t.Fatal(err)
			}

			var act []string
			for _, n := range state.Nodes {
				act = append(act, n.Node.Name)
			}
			sort.Slice(act, func(i, j int) bool { return act[i] < act[j] })

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected state (-want +got):\n%s", diff)
			}
		})
	}
}

func createNode(name string, taints []corev1.Taint) *corev1.Node {
	return &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Status: corev1.NodeStatus{
			Allocatable: corev1.ResourceList{
				corev1.ResourceMemory: res.MustParse("10Gi"),
			},
			Images: []corev1.ContainerImage{
				{Names: []string{testWorkspaceImage}},
			},
		},
		Spec: corev1.NodeSpec{
			Taints: taints,
		},
	}
}

func createPod(name string, tolerations []corev1.Toleration) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			CreationTimestamp: metav1.NewTime(time.Now()),
		},
		Status: corev1.PodStatus{
			Conditions: []corev1.PodCondition{
				{
					Type:   corev1.ContainersReady,
					Status: corev1.ConditionTrue,
				},
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:  "workspace",
					Image: testWorkspaceImage,
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceMemory: res.MustParse("1Gi"),
						},
					},
				},
			},
			Tolerations: tolerations,
		},
	}
}

func modifyPod(p *corev1.Pod, m func(p *corev1.Pod)) *corev1.Pod {
	m(p)
	return p
}
