// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package kedge_test

import (
	"context"
	"testing"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	fakek8s "k8s.io/client-go/kubernetes/fake"
)

func TestCollect(t *testing.T) {
	type fixture struct {
		Services     []*corev1.Service   `json:"services"`
		Endpoints    []*corev1.Endpoints `json:"endpoints"`
		ServiceNames []string            `json:"serviceNames"`
		Namespace    string              `json:"namespace"`
	}
	type gold struct {
		Services []kedge.Service `json:"services,omitempty"`
		Error    string          `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "fixtures/collect_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			objs := make([]runtime.Object, 0, len(fixture.Services)+len(fixture.Endpoints))
			for _, s := range fixture.Services {
				objs = append(objs, s)
			}
			for _, s := range fixture.Endpoints {
				objs = append(objs, s)
			}

			clientset := fakek8s.NewSimpleClientset(objs...)

			services, err := kedge.Discover(clientset, fixture.Namespace, fixture.ServiceNames)
			if err != nil {
				return &gold{Error: err.Error()}
			}

			return &gold{Services: services}
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}

func TestInstall(t *testing.T) {
	type fixture struct {
		Services      []kedge.Service     `json:"services"`
		Source        string              `json:"source"`
		Namespace     string              `json:"namespace,omitempty"`
		Suffix        string              `json:"suffix,omitempty"`
		Prefix        string              `json:"prefix,omitempty"`
		KubeServices  []*corev1.Service   `json:"kubeServices,omitempty"`
		KubeEndpoints []*corev1.Endpoints `json:"kubeEndpoints,omitempty"`
	}
	type gold struct {
		Services    []corev1.Service   `json:"services"`
		Endpoints   []corev1.Endpoints `json:"endpoints"`
		NewServices []string           `json:"newServices"`
		Error       string             `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "fixtures/install_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			objs := make([]runtime.Object, 0, len(fixture.KubeServices)+len(fixture.KubeEndpoints))
			for _, s := range fixture.KubeServices {
				objs = append(objs, s)
			}
			for _, s := range fixture.KubeEndpoints {
				objs = append(objs, s)
			}

			clientset := fakek8s.NewSimpleClientset(objs...)
			newServices, err := kedge.Install(clientset, fixture.Namespace, fixture.Source, fixture.Services, kedge.DefaultNamer(fixture.Prefix, fixture.Suffix))
			if err != nil {
				return &gold{Error: err.Error()}
			}

			sl, _ := clientset.CoreV1().Services(fixture.Namespace).List(context.Background(), metav1.ListOptions{})
			el, _ := clientset.CoreV1().Endpoints(fixture.Namespace).List(context.Background(), metav1.ListOptions{})
			return &gold{
				Services:    sl.Items,
				Endpoints:   el.Items,
				NewServices: newServices,
			}
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}

func TestClearServices(t *testing.T) {
	type fixture struct {
		Services  []*corev1.Service   `json:"services"`
		Endpoints []*corev1.Endpoints `json:"endpoints"`
		Namespace string              `json:"namespace"`
		Source    string              `json:"source"`
	}
	type gold struct {
		Services  []corev1.Service   `json:"services"`
		Endpoints []corev1.Endpoints `json:"endpoints"`
		Error     string             `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "fixtures/clear_src_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			objs := make([]runtime.Object, 0, len(fixture.Services)+len(fixture.Endpoints))
			for _, s := range fixture.Services {
				objs = append(objs, s)
			}
			for _, s := range fixture.Endpoints {
				objs = append(objs, s)
			}
			clientset := fakek8s.NewSimpleClientset(objs...)

			err := kedge.ClearServices(clientset, fixture.Namespace, fixture.Source)
			if err != nil {
				return &gold{Error: err.Error()}
			}

			sl, _ := clientset.CoreV1().Services(fixture.Namespace).List(context.Background(), metav1.ListOptions{})
			el, _ := clientset.CoreV1().Endpoints(fixture.Namespace).List(context.Background(), metav1.ListOptions{})
			return &gold{
				Services:  sl.Items,
				Endpoints: el.Items,
			}
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}
