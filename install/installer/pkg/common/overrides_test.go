// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common_test

import (
	"reflect"
	"strings"
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestComponentAnnotation(t *testing.T) {
	testCases := []struct {
		Annotations         config.CustomOverride
		Name                string
		Component           string
		TypeMeta            metav1.TypeMeta
		ExistingAnnotations []func() map[string]string
		Expect              map[string]string
	}{
		{
			Annotations: nil,
			Name:        "no annotations",
			Component:   "component",
			TypeMeta:    common.TypeMetaDeployment,
			Expect:      map[string]string{},
		},
		{
			Annotations: config.CustomOverride{},
			Name:        "empty annotations",
			Component:   "component",
			TypeMeta:    common.TypeMetaDeployment,
			Expect:      map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				strings.ToLower(common.TypeMetaDeployment.Kind): {},
			},
			Name:      "empty kind annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				strings.ToLower(common.TypeMetaDeployment.Kind): {
					"component": {},
				},
			},
			Name:      "empty component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				strings.ToLower(common.TypeMetaBatchCronJob.Kind): {
					"component": {
						"hello": "world",
					},
				},
			},
			Name:      "ignore different kind annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				strings.ToLower(common.TypeMetaDeployment.Kind): {
					"component2": {
						"hello": "world",
					},
				},
			},
			Name:      "ignore same kind different name annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				strings.ToLower(common.TypeMetaDeployment.Kind): {
					"component": {
						"hello": "world",
					},
				},
			},
			Name:      "single component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"hello": "world",
			},
		},
		{
			Annotations: config.CustomOverride{
				strings.ToLower(common.TypeMetaDeployment.Kind): {
					"component": {
						"key1": "value1",
						"key2": "value2",
					},
				},
			},
			Name:      "multiple component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
				"key2": "value2",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {},
			},
			Name:      "empty wildcard kind annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"component": {},
				},
			},
			Name:      "empty wildcard kind component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect:    map[string]string{},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"component": {
						"hello": "world",
					},
				},
			},
			Name:      "single wildcard kind named component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"hello": "world",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"component": {
						"key1": "value1",
						"key2": "value2",
					},
				},
			},
			Name:      "multiple wildcard kind named component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
				"key2": "value2",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"*": {
						"hello": "world",
					},
				},
			},
			Name:      "single wildcard component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"hello": "world",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"*": {
						"key1": "value1",
					},
					"component": {
						"key2": "value2",
					},
				},
			},
			Name:      "single wildcard component annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
				"key2": "value2",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"*": {
						"key1": "value1",
					},
					"component": {
						"key2": "value2",
					},
				},
				strings.ToLower(common.TypeMetaDeployment.Kind): {
					"*": {
						"key3": "value3",
					},
					"component": {
						"key4": "value4",
					},
				},
			},
			Name:      "wildcard and named annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1": "value1",
				"key2": "value2",
				"key3": "value3",
				"key4": "value4",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"*": {
						"key1":     "value1",
						"override": "override1",
					},
					"component": {
						"key2":     "value2",
						"override": "override2",
					},
				},
				strings.ToLower(common.TypeMetaDeployment.Kind): {
					"component": {
						"key4":     "value4",
						"override": "override4",
					},
					"*": {
						"key3":     "value3",
						"override": "override3",
					},
				},
			},
			Name:      "wildcard and named annotations",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			Expect: map[string]string{
				"key1":     "value1",
				"key2":     "value2",
				"key3":     "value3",
				"key4":     "value4",
				"override": "override4",
			},
		},
		{
			Annotations: config.CustomOverride{
				"*": {
					"*": {
						"override": "override",
						"delete":   "",
					},
				},
			},
			Name:      "existing annotations overriden",
			Component: "component",
			TypeMeta:  common.TypeMetaDeployment,
			ExistingAnnotations: []func() map[string]string{
				func() map[string]string {
					return map[string]string{
						"delete":     "original",
						"nooverride": "original",
						"override":   "original",
					}
				},
			},
			Expect: map[string]string{
				"nooverride": "original",
				"override":   "override",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			ctx, err := common.NewRenderContext(config.Config{
				Components: &config.Components{
					Annotations: &testCase.Annotations,
				},
			}, versions.Manifest{}, "test_namespace")
			require.NoError(t, err)

			result := common.CustomOverrideAnnotation(ctx, testCase.Component, testCase.TypeMeta, testCase.ExistingAnnotations...)

			if !reflect.DeepEqual(testCase.Expect, result) {
				t.Errorf("expected %v but got %v", testCase.Expect, result)
			}
		})
	}
}
