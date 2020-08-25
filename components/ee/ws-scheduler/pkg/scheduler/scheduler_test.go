// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"context"
	"sort"
	"testing"
	"time"

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
			scheduler := NewScheduler(Configuration{}, client)

			ctx, cancel := context.WithCancel(context.Background())
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
