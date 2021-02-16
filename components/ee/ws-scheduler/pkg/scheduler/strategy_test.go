// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler_test

import (
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	sched "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"
)

const (
	defaultTestNamespace = "default"
)

var (
	testBaseTime       = time.Date(2020, 01, 01, 01, 01, 0, 0, time.UTC)
	testWorkspaceImage = "gitpod/workspace-full"
)

func TestDensityAndExperience(t *testing.T) {
	tests := []struct {
		Desc                  string
		Broken                string
		RAMSafetyBuffer       string
		Nodes                 []*corev1.Node
		Pods                  []*corev1.Pod
		ScheduledPod          *corev1.Pod
		ExpectedNode          string
		ExpectedError         string
		ExpectedGhostReplaced string
	}{
		{
			Desc:            "no node",
			RAMSafetyBuffer: "512Mi",
			ScheduledPod:    &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "testpod"}},
			ExpectedError: `No node with enough resources available!
RAM requested: 0
Eph. Storage requested: 0
Nodes:
`,
		},
		{
			Desc:            "no node with enough RAM",
			RAMSafetyBuffer: "512Mi",
			Nodes:           []*corev1.Node{createNode("node1", "10000Mi", "0Mi", false, 100)},
			Pods:            []*corev1.Pod{createNonWorkspacePod("existingPod1", "8000Mi", "0Mi", "node1", "10s")},
			ScheduledPod:    createWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedError: `No node with enough resources available!
RAM requested: 6000Mi
Eph. Storage requested: 0
Nodes:
- node1:
  RAM: used 0(r)+0(g)+0(h)+8389(o) of 9949, avail 1561 Mi
  Eph. Storage: used 0(r)+0(g)+0(h)+0(o) of 0, avail 0 Mi`,
		},
		{
			Desc:            "single empty node",
			RAMSafetyBuffer: "512Mi",
			Nodes:           []*corev1.Node{createNode("node1", "10000Mi", "0Mi", false, 100)},
			ScheduledPod:    createWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode:    "node1",
		},
		{
			Desc:            "two nodes, one full",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", false, 100),
			},
			Pods:         []*corev1.Pod{createNonWorkspacePod("existingPod1", "8000Mi", "0Mi", "node1", "10s")},
			ScheduledPod: createWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode: "node2",
		},
		{
			Desc:            "two nodes, prefer density",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", false, 100),
			},
			Pods:         []*corev1.Pod{createWorkspacePod("existingPod1", "1000Mi", "0Mi", "node1", "10s")},
			ScheduledPod: createWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode: "node1",
		},
		{
			Desc:            "three nodes, prefer with image",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", true, 100),
				createNode("node3", "10000Mi", "0Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "1500Mi", "0Mi", "node1", "10s"),
				createWorkspacePod("existingPod2", "1000Mi", "0Mi", "node2", "10s"),
			},
			ScheduledPod: createWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode: "node2",
		},
		{
			Desc:            "three nodes, prefer with image in class",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", false, 100),
				createNode("node3", "10000Mi", "0Mi", true, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "1500Mi", "0Mi", "node1", "10s"),
				createWorkspacePod("existingPod2", "1000Mi", "0Mi", "node2", "10s"),
			},
			ScheduledPod: createWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode: "node1",
		},
		{
			// We musn't place headless pods on nodes without regular workspaces
			Desc:            "three nodes, place headless pod",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", true, 100),
				createNode("node3", "10000Mi", "0Mi", true, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "1500Mi", "0Mi", "node1", "10s"),
				createWorkspacePod("existingPod2", "1000Mi", "0Mi", "node2", "10s"),
				createHeadlessWorkspacePod("hpod", "500Mi", "0Mi", "node3", "1000s"),
			},
			ScheduledPod: createHeadlessWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode: "node2",
		},
		{
			Desc:            "three empty nodes, place headless pod",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", true, 100),
				createNode("node3", "10000Mi", "0Mi", true, 100),
			},
			ScheduledPod: createHeadlessWorkspacePod("pod", "6000Mi", "0Mi", "", "1000s"),
			ExpectedNode: "node1",
		},
		{
			Desc:            "filter full nodes, headless workspaces",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 100),
				createNode("node2", "10000Mi", "0Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createHeadlessWorkspacePod("existingPod1", "4000Mi", "0Mi", "node1", "10s"),
				createWorkspacePod("existingPod2", "4000Mi", "0Mi", "node1", "10s"),
			},
			ScheduledPod: createWorkspacePod("pod", "4000Mi", "0Mi", "", "10s"),
			ExpectedNode: "node2",
		},
		{
			// Should choose node1 because it has more free RAM but chooses 2 because node1's pod capacity is depleted
			Desc:            "respect node's pod capacity",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "0Mi", false, 0),
				createNode("node2", "10000Mi", "0Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4000Mi", "0Mi", "node2", "10s"),
			},
			ScheduledPod: createWorkspacePod("new pod", "4000Mi", "0Mi", "node1", "10s"),
			ExpectedNode: "node2",
		},
		{
			// Should choose node1 because it has more free RAM but chooses 2 because node1's ephemeral storage is depleted
			Desc:            "respect node's ephemeral storage",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "3000Mi", false, 100),
				createNode("node2", "10000Mi", "15000Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4000Mi", "5000Mi", "node2", "10s"),
			},
			ScheduledPod: createWorkspacePod("new pod", "4000Mi", "5000Mi", "node1", "10s"),
			ExpectedNode: "node2",
		},
		{
			// Throws an error because both nodes have enough RAM but not enough ephemeral storage
			Desc:            "enough RAM but no more ephemeral storage",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "3000Mi", false, 100),
				createNode("node2", "10000Mi", "7000Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4000Mi", "5000Mi", "node2", "10s"),
			},
			ScheduledPod: createWorkspacePod("new pod", "4000Mi", "5000Mi", "node1", "10s"),
			ExpectedError: `No node with enough resources available!
RAM requested: 4000Mi
Eph. Storage requested: 5000Mi
Nodes:
- node2:
  RAM: used 4195(r)+0(g)+0(h)+0(o) of 9949, avail 5755 Mi
  Eph. Storage: used 5243(r)+0(g)+0(h)+0(o) of 7341, avail 2098 Mi
- node1:
  RAM: used 0(r)+0(g)+0(h)+0(o) of 9949, avail 9949 Mi
  Eph. Storage: used 0(r)+0(g)+0(h)+0(o) of 3146, avail 3146 Mi`,
		},
		{
			// Should prefer 1 and 2 over 3, but 1 has not enough pod slots and 2 not enough ephemeral storage
			Desc:            "filter nodes without enough pod slots and ephemeral storage",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "20000Mi", "10000Mi", false, 0),
				createNode("node2", "20000Mi", "10000Mi", false, 100),
				createNode("node3", "20000Mi", "10000Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4000Mi", "5000Mi", "node2", "10s"),
				createWorkspacePod("existingPod2", "4000Mi", "5000Mi", "node2", "10s"),
				createWorkspacePod("existingPod3", "4000Mi", "5000Mi", "node3", "10s"),
			},
			ScheduledPod: createWorkspacePod("new pod", "4000Mi", "5000Mi", "node1", "10s"),
			ExpectedNode: "node3",
		},
		{
			// Schedules on 1 because node2 is more dense but full already
			Desc:            "schedule ghost by density",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "10000Mi", false, 100),
				createNode("node2", "10000Mi", "10000Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4000Mi", "5000Mi", "node2", "10s"),
				createGhostPod("ghost1", "4000Mi", "5000Mi", "node2", "10s"),
			},
			ScheduledPod: createGhostPod("new ghost", "4000Mi", "5000Mi", "", "10s"),
			ExpectedNode: "node1",
		},
		{
			// Should schedule to 2 because of density and it does ignore the ghost that blocks its slot
			Desc:            "schedule workspace by density, ignoring ghost",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "10000Mi", false, 100),
				createNode("node2", "10000Mi", "10000Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("existingPod1", "4000Mi", "5000Mi", "node2", "10s"),
				createGhostPod("ghost1", "4000Mi", "5000Mi", "node2", "10s"),
			},
			ScheduledPod: createWorkspacePod("new workspace", "4000Mi", "5000Mi", "", "10s"),
			ExpectedNode: "node2",
		},
		{
			// Should schedule to 2 because of density and it ignores ghosts.
			// Should delete ghost2 because probes replace ghosts, and ghost2 is the oldest one
			Desc:            "schedule probe and replace pod",
			RAMSafetyBuffer: "512Mi",
			Nodes: []*corev1.Node{
				createNode("node1", "10000Mi", "10000Mi", false, 100),
				createNode("node2", "10000Mi", "10000Mi", false, 100),
			},
			Pods: []*corev1.Pod{
				createWorkspacePod("workspace1", "3000Mi", "3000Mi", "node2", "10s"),
				createGhostPod("ghost1", "3000Mi", "3000Mi", "node2", "8s"),
				createGhostPod("ghost2", "3000Mi", "3000Mi", "node2", "10s"),
			},
			ScheduledPod:          createProbePod("workspace2", "3000Mi", "3000Mi", "", "10s"),
			ExpectedNode:          "node2",
			ExpectedGhostReplaced: "ghost2",
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			if test.Broken != "" {
				t.Skip(test.Broken)
			}

			ramSafetyBuffer := res.MustParse(test.RAMSafetyBuffer)
			ghostsVisible := !wsk8s.IsNonGhostWorkspace(test.ScheduledPod)
			state := sched.ComputeState(test.Nodes, test.Pods, nil, &ramSafetyBuffer, ghostsVisible, defaultTestNamespace)

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

			if test.ExpectedGhostReplaced != "" {
				ghostToDelete, _ := state.FindSpareGhostToDelete(node, test.ScheduledPod, defaultTestNamespace, &ramSafetyBuffer, make(map[string]*sched.Slot))
				if ghostToDelete != test.ExpectedGhostReplaced {
					t.Errorf("expected ghost to be replaced \"%s\", got \"%s\"", test.ExpectedGhostReplaced, ghostToDelete)
					return
				}
			}
		})
	}
}

func createNode(name string, ram string, ephemeralStorage string, withImage bool, podCapacity int64) *corev1.Node {
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
				corev1.ResourceMemory:           res.MustParse(ram),
				corev1.ResourceEphemeralStorage: res.MustParse(ephemeralStorage),
			},
			Images: images,
			Capacity: corev1.ResourceList{
				corev1.ResourcePods: *res.NewQuantity(podCapacity, res.BinarySI),
			},
		},
	}
}

func createNonWorkspacePod(name string, ram string, ephemeralStorage string, nodeName string, age string) *corev1.Pod {
	return createPod(name, ram, ephemeralStorage, nodeName, age, map[string]string{})
}

func createHeadlessWorkspacePod(name string, ram string, ephemeralStorage string, nodeName string, age string) *corev1.Pod {
	return createPod(name, ram, ephemeralStorage, nodeName, age, map[string]string{
		"component": "workspace",
		"headless":  "true",
	})
}

func createWorkspacePod(name string, ram string, ephemeralStorage string, nodeName string, age string) *corev1.Pod {
	return createPod(name, ram, ephemeralStorage, nodeName, age, map[string]string{
		"component":     "workspace",
		wsk8s.TypeLabel: "regular",
	})
}

func createGhostPod(name string, ram string, ephemeralStorage string, nodeName string, age string) *corev1.Pod {
	return createPod(name, ram, ephemeralStorage, nodeName, age, map[string]string{
		"component":     "workspace",
		"headless":      "true",
		wsk8s.TypeLabel: "ghost",
	})
}

func createProbePod(name string, ram string, ephemeralStorage string, nodeName string, age string) *corev1.Pod {
	return createPod(name, ram, ephemeralStorage, nodeName, age, map[string]string{
		"component":     "workspace",
		"headless":      "true",
		wsk8s.TypeLabel: "probe",
	})
}

func createPod(name string, ram string, ephemeralStorage string, nodeName string, ageStr string, labels map[string]string) *corev1.Pod {
	creationTimestamp := testBaseTime.Add(-MustParseDuration(ageStr))
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         defaultTestNamespace,
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
							corev1.ResourceMemory:           res.MustParse(ram),
							corev1.ResourceEphemeralStorage: res.MustParse(ephemeralStorage),
						},
					},
				},
			},
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
