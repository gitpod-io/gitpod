// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"
	"time"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/common-go/util"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestDeleteDanglingPodLifecycleIndependentState(t *testing.T) {
	type fixture struct {
		Pod           *corev1.Pod `json:"pod"`
		StopWorkspace string      `json:"stopWorkspace"`

		PLIS             *corev1.ConfigMap `json:"plis"`
		PLISAge          util.Duration     `json:"plisAge"`
		StoppingDuration util.Duration     `json:"stoppingDuration"`
	}
	type gold struct {
		RemainingPLIS []string `json:"remainingPLIS,omitempty"`
		Error         string   `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:       t,
		Path:    "testdata/deleteDanglingPLIS_*.json",
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			var objs []runtime.Object
			if fixture.Pod != nil {
				objs = append(objs, fixture.Pod)
			}
			if fixture.PLIS != nil {
				age := time.Duration(fixture.PLISAge)
				if age != 0 {
					fixture.PLIS.ObjectMeta.CreationTimestamp = metav1.NewTime(time.Now().Add(-age))
				}
				if fixture.StoppingDuration != 0 {
					plis, err := unmarshalPodLifecycleIndependentState(fixture.PLIS)
					if err != nil {
						panic(err)
					}
					t := time.Now().Add(-time.Duration(fixture.StoppingDuration))
					plis.StoppingSince = &t
					err = marshalPodLifecycleIndependentState(fixture.PLIS, plis)
					if err != nil {
						panic(err)
					}
				}

				objs = append(objs, fixture.PLIS)
			}
			manager := forTestingOnlyGetManager(t, objs...)

			monitor, err := manager.CreateMonitor()
			if err != nil {
				return &gold{Error: err.Error()}
			}

			var merr error
			monitor.OnError = func(err error) { merr = err }

			if fixture.StopWorkspace != "" {
				err = manager.stopWorkspace(context.Background(), fixture.StopWorkspace, 30*time.Second)
				if err != nil {
					return &gold{Error: err.Error()}
				}
			}

			err = monitor.deleteDanglingPodLifecycleIndependentState()
			if err != nil {
				return &gold{Error: err.Error()}
			}

			cms, err := manager.Clientset.CoreV1().ConfigMaps(manager.Config.Namespace).List(metav1.ListOptions{})
			if err != nil {
				panic(err)
			}

			r := make([]string, len(cms.Items))
			for i, c := range cms.Items {
				r[i] = c.Name
			}

			var errmsg string
			if merr != nil {
				errmsg = merr.Error()
			}
			return &gold{
				Error:         errmsg,
				RemainingPLIS: r,
			}
		},
	}
	test.Run()
}
