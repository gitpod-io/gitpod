// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common_test

import (
	"reflect"
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
