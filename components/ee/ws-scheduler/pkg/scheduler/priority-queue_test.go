// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler_test

import (
	"testing"
	"time"

	sched "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"

	corev1 "k8s.io/api/core/v1"
)

func TestOrderByPodPriority(t *testing.T) {

	tests := []struct {
		Desc       string
		QueuedPods []*corev1.Pod
		Expected   []string
	}{
		{
			Desc: "prefer older workspace",
			QueuedPods: []*corev1.Pod{
				createWorkspacePod("ws1", "1Gi", "1Gi", "", "10s"),
				createWorkspacePod("ws2", "1Gi", "1Gi", "", "100s"),
			},
			Expected: []string{
				"ws2",
				"ws1",
			},
		},
		{
			Desc: "always prefer workspaces over ghosts",
			QueuedPods: []*corev1.Pod{
				createGhostPod("ghost1", "1Gi", "1Gi", "", "10s"),
				createWorkspacePod("ws1", "1Gi", "1Gi", "", "100s"),
				createWorkspacePod("ws2", "1Gi", "1Gi", "", "110s"),
			},
			Expected: []string{
				"ws2",
				"ws1",
				"ghost1",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			q := sched.NewPriorityQueue(sched.SortByPriority, 1*time.Second, 1*time.Second)
			for _, p := range test.QueuedPods {
				q.Add(p)
			}
			q.Close()

			for _, expected := range test.Expected {
				act, wasClosed := q.Pop()
				if wasClosed {
					t.Errorf("queue already emtpy, but still expected pod '%s'", expected)
				}
				if act.Pod.Name != expected {
					t.Errorf("expected pod '%s' but got '%s'!", expected, act.Pod.Name)
				}
			}
		})
	}
}
