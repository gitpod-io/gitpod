// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	corev1 "k8s.io/api/core/v1"
)

func TestUniquePods(t *testing.T) {
	var (
		p1     = createPod("p1", nil)
		p2gen0 = modifyPod(createPod("p2", nil), func(p *corev1.Pod) { p.Generation = 0 })
		p2gen1 = modifyPod(createPod("p2", nil), func(p *corev1.Pod) { p.Generation = 1 })
		p2rev0 = modifyPod(createPod("p2", nil), func(p *corev1.Pod) { p.ResourceVersion = "0" })
		p2rev1 = modifyPod(createPod("p2", nil), func(p *corev1.Pod) { p.ResourceVersion = "1" })
	)

	tests := []struct {
		Name        string
		Input       []*corev1.Pod
		Expectation []*corev1.Pod
	}{
		{
			Name:        "nil",
			Input:       nil,
			Expectation: nil,
		},
		{
			Name:        "empty",
			Input:       []*corev1.Pod{},
			Expectation: []*corev1.Pod{},
		},
		{
			Name:        "already unique",
			Input:       []*corev1.Pod{p1, p2gen0},
			Expectation: []*corev1.Pod{p1, p2gen0},
		},
		{
			Name:        "not unique unique rev only",
			Input:       []*corev1.Pod{p1, p2rev0, p2rev1},
			Expectation: []*corev1.Pod{p1, p2rev1},
		},
		{
			Name:        "not unique unique generation only",
			Input:       []*corev1.Pod{p1, p2gen0, p2gen1},
			Expectation: []*corev1.Pod{p1, p2gen1},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := uniquePods(test.Input)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
