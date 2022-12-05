// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common_test

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/proxy"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestCustomizeAnnotation(t *testing.T) {
	testCases := []struct {
		Name                string
		Customization       []config.Customization
		Component           string
		TypeMeta            metav1.TypeMeta
		ExistingAnnotations []func() map[string]string
		Expect              map[string]string
	}{
		{
			Name:          "no customization",
			Customization: nil,
			Component:     "component",
			TypeMeta:      common.TypeMetaDeployment,
			Expect:        map[string]string{},
		},
		{
			Customization: []config.Customization{},
			Name:          "empty customization",
			Component:     "component",
			TypeMeta:      common.TypeMetaDeployment,
			Expect:        map[string]string{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaBatchJob,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Annotations: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "ignore different typeMeta annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component2",
						Annotations: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "ignore same typeMeta, different name annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Annotations: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "single component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Annotations: map[string]string{
							"key1": "value1",
							"key2": "value2",
						},
					},
				},
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Annotations: map[string]string{
							"key3": "value3",
						},
					},
				},
			},
			Name:      "multiple component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
				"key2": "value2",
				"key3": "value3",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "*",
						Kind:       "*",
					},
					Metadata: metav1.ObjectMeta{
						Name: "*",
						Annotations: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "wildcard annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "*",
						Kind:       "*",
					},
					Metadata: metav1.ObjectMeta{
						Name: "*",
						Annotations: map[string]string{
							"key1": "value1",
							"key2": "override",
							"key3": "",
						},
					},
				},
			},
			Name:      "override input, do not override existing",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			ExistingAnnotations: []func() map[string]string{
				func() map[string]string {
					return map[string]string{
						"key2": "original",
					}
				},
			},
			Expect: map[string]string{
				"key1": "value1",
				"key2": "original",
				"key3": "",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "v1",
						Kind:       "Service",
					},
					Metadata: metav1.ObjectMeta{
						Name: "proxy",
						Annotations: map[string]string{
							"service.beta.kubernetes.io/aws-load-balancer-ip-address-type": "ipv4",
						},
					},
				},
			},
			Name:      "Test service #11106",
			TypeMeta:  common.TypeMetaService,
			Component: proxy.Component,
			Expect: map[string]string{
				"service.beta.kubernetes.io/aws-load-balancer-ip-address-type": "ipv4",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			ctx, err := common.NewRenderContext(config.Config{
				Customization: &testCase.Customization,
			}, versions.Manifest{}, "test_namespace")
			require.NoError(t, err)

			result := common.CustomizeAnnotation(ctx, testCase.Component, testCase.TypeMeta, testCase.ExistingAnnotations...)

			if !reflect.DeepEqual(testCase.Expect, result) {
				t.Errorf("expected %v but got %v", testCase.Expect, result)
			}
		})
	}
}

func TestCustomizeLabel(t *testing.T) {
	testCases := []struct {
		Name           string
		Customization  []config.Customization
		Component      string
		TypeMeta       metav1.TypeMeta
		ExistingLabels []func() map[string]string
		Expect         map[string]string
	}{
		{
			Name:          "no customization",
			Customization: nil,
			Component:     "component",
			TypeMeta:      common.TypeMetaDeployment,
			Expect:        map[string]string{},
		},
		{
			Customization: []config.Customization{},
			Name:          "empty customization",
			Component:     "component",
			TypeMeta:      common.TypeMetaDeployment,
			Expect:        map[string]string{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaBatchJob,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Labels: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "ignore different typeMeta labels",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component2",
						Labels: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "ignore same typeMeta, different name labels",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Labels: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "single component labels",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Labels: map[string]string{
							"key1": "value1",
							"key2": "value2",
						},
					},
				},
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
						Labels: map[string]string{
							"key3": "value3",
						},
					},
				},
			},
			Name:      "multiple component labels",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
				"key2": "value2",
				"key3": "value3",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "*",
						Kind:       "*",
					},
					Metadata: metav1.ObjectMeta{
						Name: "*",
						Labels: map[string]string{
							"key1": "value1",
						},
					},
				},
			},
			Name:      "wildcard labels",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
			},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: metav1.TypeMeta{
						APIVersion: "*",
						Kind:       "*",
					},
					Metadata: metav1.ObjectMeta{
						Name: "*",
						Labels: map[string]string{
							"key1": "value1",
							"key2": "override",
							"key3": "",
						},
					},
				},
			},
			Name:      "override input, do not override existing",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			ExistingLabels: []func() map[string]string{
				func() map[string]string {
					return map[string]string{
						"key2": "original",
					}
				},
			},
			Expect: map[string]string{
				"key1": "value1",
				"key2": "original",
				"key3": "",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			ctx, err := common.NewRenderContext(config.Config{
				Customization: &testCase.Customization,
			}, versions.Manifest{}, "test_namespace")
			require.NoError(t, err)

			result := common.CustomizeLabel(ctx, testCase.Component, testCase.TypeMeta, testCase.ExistingLabels...)

			// These all have the default labels - add these in
			expectation := common.DefaultLabels(testCase.Component)
			for k, v := range testCase.Expect {
				expectation[k] = v
			}

			if !reflect.DeepEqual(expectation, result) {
				t.Errorf("expected %v but got %v", expectation, result)
			}
		})
	}
}

func TestCustomizeEnvvar(t *testing.T) {
	testCases := []struct {
		Name            string
		Customization   []config.Customization
		Component       string
		ExistingEnnvars []corev1.EnvVar
		Expect          []corev1.EnvVar
	}{
		{
			Name:          "no customization",
			Customization: nil,
			Component:     "component",
			Expect:        []corev1.EnvVar{},
		},
		{
			Customization: []config.Customization{},
			Name:          "empty customization",
			Component:     "component",
			Expect:        []corev1.EnvVar{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component2",
					},
					Spec: config.CustomizationSpec{
						Env: []corev1.EnvVar{
							{
								Name:  "key1",
								Value: "value1",
							},
						},
					},
				},
			},
			Name:      "ignore different name envvars",
			Component: "component",
			Expect:    []corev1.EnvVar{},
		},
		{
			Customization: []config.Customization{
				{
					TypeMeta: common.TypeMetaDeployment,
					Metadata: metav1.ObjectMeta{
						Name: "component",
					},
					Spec: config.CustomizationSpec{
						Env: []corev1.EnvVar{
							{
								Name:  "key1",
								Value: "value1",
							},
						},
					},
				},
			},
			Name:      "add in name envvars",
			Component: "component",
			Expect: []corev1.EnvVar{
				{
					Name:  "key1",
					Value: "value1",
				},
			},
		},
		{
			Customization: []config.Customization{
				{
					Metadata: metav1.ObjectMeta{
						Name: "*",
					},
					Spec: config.CustomizationSpec{
						Env: []corev1.EnvVar{
							{
								Name:  "key1",
								Value: "original",
							},
							{
								Name:  "key2",
								Value: "original",
							},
							{
								Name:  "key3",
								Value: "override",
							},
						},
					},
				},
				{
					Metadata: metav1.ObjectMeta{
						Name: "component",
					},
					Spec: config.CustomizationSpec{
						Env: []corev1.EnvVar{
							{
								Name:  "key1",
								Value: "override",
							},
						},
					},
				},
			},
			ExistingEnnvars: []corev1.EnvVar{
				{
					Name:  "key4",
					Value: "value",
				},
				{
					Name:  "key3",
					Value: "original",
				},
			},
			Name:      "full-house envvars",
			Component: "component",
			Expect: []corev1.EnvVar{
				{
					Name:  "key4",
					Value: "value",
				},
				{
					Name:  "key3",
					Value: "original",
				},
				{
					Name:  "key1",
					Value: "override",
				},
				{
					Name:  "key2",
					Value: "original",
				},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			ctx, err := common.NewRenderContext(config.Config{
				Customization: &testCase.Customization,
			}, versions.Manifest{}, "test_namespace")
			require.NoError(t, err)

			result := common.CustomizeEnvvar(ctx, testCase.Component, testCase.ExistingEnnvars)

			if !reflect.DeepEqual(testCase.Expect, result) {
				t.Errorf("expected %v but got %v", testCase.Expect, result)
			}
		})
	}
}
