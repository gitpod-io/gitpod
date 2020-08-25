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
			createNode("node1", "10Gi", false, 100),
			createNode("node2", "10Gi", false, 100),
			createNode("node3", "10Gi", true, 100),
		}
	}

	tests := []struct {
		Desc        string
		Nodes       []*corev1.Node
		Pods        []*corev1.Pod
		Expectation string
	}{
		{
			Desc:        "no pods",
			Nodes:       defaultNodeSet(),
			Expectation: "- node1: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB\n- node2: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB\n- node3: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB",
		},
		{
			Desc:  "other pods only",
			Nodes: defaultNodeSet(),
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "node2", 10),
			},
			Expectation: "- node1: used 0.000+0.000+1.500 of 10.000, avail 8.500 GiB\n- node2: used 0.000+0.000+1.000 of 10.000, avail 9.000 GiB\n- node3: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB",
		},
		{
			Desc:  "some headless pods",
			Nodes: defaultNodeSet(),
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "node2", 10),
				createHeadlessWorkspacePod("hp1", "1Gi", "node2", 10),
				createHeadlessWorkspacePod("hp2", "2.22Gi", "node2", 10),
			},
			Expectation: "- node1: used 0.000+0.000+1.500 of 10.000, avail 8.500 GiB\n- node2: used 0.000+3.220+1.000 of 10.000, avail 5.779 GiB\n- node3: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB",
		},
		{
			Desc:  "some regular pods",
			Nodes: defaultNodeSet(),
			Pods: []*corev1.Pod{
				createNonWorkspacePod("existingPod1", "1.5Gi", "node1", 10),
				createNonWorkspacePod("existingPod2", "1Gi", "node2", 10),
				createWorkspacePod("hp1", "1Gi", "node1", 10),
				createWorkspacePod("hp2", "3.44Gi", "node1", 10),
			},
			Expectation: "- node1: used 4.439+0.000+1.500 of 10.000, avail 4.060 GiB\n- node2: used 0.000+0.000+1.000 of 10.000, avail 9.000 GiB\n- node3: used 0.000+0.000+0.000 of 10.000, avail 10.000 GiB",
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			state := sched.NewState()
			state.UpdateNodes(test.Nodes)
			state.UpdatePods(test.Pods)

			nodes := state.SortNodesByAvailableRAMAsc()
			// in some tests the RAM sort order is not stable as nodes have the same amount of RAM.
			// This would intermittently break tests. We instead sort by name.
			sort.Slice(nodes, func(i, j int) bool { return nodes[i].Node.Name < nodes[j].Node.Name })

			actual := sched.DebugRAMPerNodeAsStr(nodes)
			if test.Expectation != actual {
				t.Errorf("expected RAM to be:\n%s, was:\n%s", test.Expectation, actual)
				return
			}
		})
	}
}
