// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler_test

import (
	"sort"
	"testing"

	sched "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"
	corev1 "k8s.io/api/core/v1"
)

func TestState(t *testing.T) {
	defaultNodeSet := func() []*corev1.Node {
		return []*corev1.Node{
			createNode("node1", "10Gi", "0Gi", false, 100),
			createNode("node2", "10Gi", "0Gi", false, 100),
			createNode("node3", "10Gi", "0Gi", true, 100),
		}
	}

	tests := []struct {
		Desc        string
		Nodes       []*corev1.Node
		Pods        []*corev1.Pod
		Expectation string
	}{
		{
			Desc:  "no pods",
			Nodes: defaultNodeSet(),
			Expectation: `- node1:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node2:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node3:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB`,
		},
		{
			Desc:  "other pods only",
			Nodes: defaultNodeSet(),
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "0Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "0Gi", "node2", 10),
			},
			Expectation: `- node1:
  RAM: used 0.000+0.000+1.500 of 10.000, avail 8.500 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node2:
  RAM: used 0.000+0.000+1.000 of 10.000, avail 9.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node3:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB`,
		},
		{
			Desc:  "some headless pods",
			Nodes: defaultNodeSet(),
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "0Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "0Gi", "node2", 10),
				createHeadlessWorkspacePod("hp1", "1Gi", "0Gi", "node2", 10),
				createHeadlessWorkspacePod("hp2", "2.22Gi", "0Gi", "node2", 10),
			},
			Expectation: `- node1:
  RAM: used 0.000+0.000+1.500 of 10.000, avail 8.500 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node2:
  RAM: used 0.000+3.220+1.000 of 10.000, avail 5.779 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node3:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB`,
		},
		{
			Desc:  "some regular pods",
			Nodes: defaultNodeSet(),
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "0Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "0Gi", "node2", 10),
				createWorkspacePod("hp1", "1Gi", "0Gi", "node1", 10),
				createWorkspacePod("hp2", "3.44Gi", "0Gi", "node1", 10),
			},
			Expectation: `- node1:
  RAM: used 4.439+0.000+1.500 of 10.000, avail 4.060 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node2:
  RAM: used 0.000+0.000+1.000 of 10.000, avail 9.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB
- node3:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 0.000, avail 0.000 GiB`,
		},
		{
			Desc: "some regular pods with ",
			Nodes: []*corev1.Node{
				createNode("node1", "10Gi", "20Gi", false, 100),
				createNode("node2", "10Gi", "10Gi", false, 100),
				createNode("node3", "10Gi", "10Gi", true, 100),
			},
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "5Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "2Gi", "node2", 10),
				createWorkspacePod("hp1", "1Gi", "5Gi", "node1", 10),
				createWorkspacePod("hp2", "3.44Gi", "5Gi", "node1", 10),
			},
			Expectation: `- node1:
  RAM: used 4.439+0.000+1.500 of 10.000, avail 4.060 GiB
  Eph. Storage: used 10.000+0.000+5.000 of 20.000, avail 5.000 GiB
- node2:
  RAM: used 0.000+0.000+1.000 of 10.000, avail 9.000 GiB
  Eph. Storage: used 0.000+0.000+2.000 of 10.000, avail 8.000 GiB
- node3:
  RAM: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB
  Eph. Storage: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB`,
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			state := sched.ComputeState(test.Nodes, test.Pods, nil)

			nodes := state.SortNodesByAvailableRAMAsc()
			// in some tests the RAM sort order is not stable as nodes have the same amount of RAM.
			// This would intermittently break tests. We instead sort by name.
			sort.Slice(nodes, func(i, j int) bool { return nodes[i].Node.Name < nodes[j].Node.Name })

			actual := sched.DebugStringNodes(nodes)
			if test.Expectation != actual {
				t.Errorf("expected debug string to be:\n%s, was:\n%s", test.Expectation, actual)
				return
			}
		})
	}
}
