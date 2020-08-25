// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler_test

import (
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	sched "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"
)

var (
	testBaseTime       = time.Unix(0, 0)
	testWorkspaceImage = "gitpod/workspace-full"
)

func TestDensityAndExperience(t *testing.T) {
	tests := []struct {
		Desc          string
		Broken        string
		Nodes         []*corev1.Node
		Pods          []*corev1.Pod
		ScheduledPod  *corev1.Pod
		ExpectedNode  string
		ExpectedError string
	}{
		{
			Desc:          "no node",
			ScheduledPod:  &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "testpod"}},
			ExpectedError: "No node with enough RAM available!\nRequested by pod: 0\nNodes:\n",
		},
		{
			Desc:          "no node with enough RAM",
			Nodes:         []*corev1.Node{createNode("node1", "10Gi", false, 100)},
			Pods:          []*corev1.Pod{createNonWorkspacePod("existingPod1", "8Gi", "node1", 10)},
			ScheduledPod:  createWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedError: "No node with enough RAM available!\nRequested by pod: 6Gi\nNodes:\n- node1: used 0.000+0.000+8.000 of 10.000, avail 2.000 GiB",
		},
		{
			Desc:         "single empty node",
			Nodes:        []*corev1.Node{createNode("node1", "10Gi", false, 100)},
			ScheduledPod: createWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node1",
		},
		{
			Desc: "two nodes, one full",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", false, 100),
			},
			Pods:         []*corev1.Pod{createNonWorkspacePod("existingPod1", "8Gi", "node1", 10)},
			ScheduledPod: createWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node2",
		},
		{
			Desc: "two nodes, prefer density",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", false, 100),
			},
			Pods:         []*corev1.Pod{createWorkspacePod("existingPod1", "1Gi", "node1", 10)},
			ScheduledPod: createWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node1",
		},
		{
			Desc: "three nodes, prefer with image",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", true, 100),
				createNode("node3", "10Gi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "1.5Gi", "node1", 10),
				createWorkspacePod("existingPod2", "1Gi", "node2", 10),
			},
			ScheduledPod: createWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node2",
		},
		{
			Desc: "three nodes, prefer with image in class",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", false, 100),
				createNode("node3", "10Gi", true, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "1.5Gi", "node1", 10),
				createWorkspacePod("existingPod2", "1Gi", "node2", 10),
			},
			ScheduledPod: createWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node1",
		},
		{
			// We musn't place headless pods on nodes without regular workspaces
			Desc: "three nodes, place headless pod",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", true, 100),
				createNode("node3", "10Gi", true, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "1.5Gi", "node1", 10),
				createWorkspacePod("existingPod2", "1Gi", "node2", 10),
				createHeadlessWorkspacePod("hpod", "0.5Gi", "node3", 1000),
			},
			ScheduledPod: createHeadlessWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node2",
		},
		{
			Desc: "three empty nodes, place headless pod",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", true, 100),
				createNode("node3", "10Gi", true, 100),
			},
			ScheduledPod: createHeadlessWorkspacePod("pod", "6Gi", "", 1000),
			ExpectedNode: "node1",
		},
		{
			Desc: "filter full nodes, headless workspaces",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 100),
				createNode("node2", "10Gi", false, 100),
			},
			Pods: []*corev1.Pod{
				createHeadlessWorkspacePod("existingPod1", "4Gi", "node1", 10),
				createWorkspacePod("existingPod2", "4Gi", "node1", 10),
			},
			ScheduledPod: createWorkspacePod("pod", "4Gi", "", 10),
			ExpectedNode: "node2",
		},
		{
			// Should choose node1 because it has more free RAM but chooses 2 because node1's pod capacity is depleted
			Desc: "respect node's pod capacity",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", false, 0),
				createNode("node2", "10Gi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4Gi", "node2", 10),
			},
			ScheduledPod: createWorkspacePod("new pod", "4Gi", "node1", 10),
			ExpectedNode: "node2",
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			if test.Broken != "" {
				t.Skip(test.Broken)
			}

			state := sched.NewState()
			state.UpdateNodes(test.Nodes)
			state.UpdatePods(test.Pods)

			densityAndExperienceConfig := sched.DefaultDensityAndExperienceConfig()
			strategy, err := sched.CreateStrategy(sched.StrategyDensityAndExperience, sched.Configuration{
				DensityAndExperienceConfig: densityAndExperienceConfig,
			})
			if err != nil {
				t.Errorf("cannot create strategy: %v", err)
				return
			}

			node, err := strategy.Select(state, test.ScheduledPod)
			var errmsg string
			if err != nil {
				errmsg = err.Error()
			}
			if errmsg != test.ExpectedError {
				t.Errorf("expected error \"%s\", got \"%s\"", test.ExpectedError, errmsg)
				return
			}
			if node != test.ExpectedNode {
				t.Errorf("expected node \"%s\", got \"%s\"", test.ExpectedNode, node)
				return
			}
		})
	}
}

func createNode(name string, ram string, withImage bool, podCapacity int64) *corev1.Node {
	images := make([]corev1.ContainerImage, 0)
	if withImage {
		images = append(images, corev1.ContainerImage{
			Names: []string{testWorkspaceImage},
		})
	}
	return &corev1.Node{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Status: corev1.NodeStatus{
			Allocatable: corev1.ResourceList{
				corev1.ResourceMemory: res.MustParse(ram),
			},
			Images: images,
			Capacity: corev1.ResourceList{
				corev1.ResourcePods: *res.NewQuantity(podCapacity, res.BinarySI),
			},
		},
	}
}

func createNonWorkspacePod(name string, ram string, nodeName string, age time.Duration) *corev1.Pod {
	return createPod(name, ram, nodeName, age, map[string]string{})
}

func createHeadlessWorkspacePod(name string, ram string, nodeName string, age time.Duration) *corev1.Pod {
	return createPod(name, ram, nodeName, age, map[string]string{
		"component": "workspace",
		"headless":  "true",
	})
}

func createWorkspacePod(name string, ram string, nodeName string, age time.Duration) *corev1.Pod {
	return createPod(name, ram, nodeName, age, map[string]string{
		"component": "workspace",
	})
}

func createPod(name string, ram string, nodeName string, age time.Duration, labels map[string]string) *corev1.Pod {
	creationTimestamp := testBaseTime.Add(age * time.Second)
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			CreationTimestamp: metav1.NewTime(creationTimestamp),
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
	}
}
