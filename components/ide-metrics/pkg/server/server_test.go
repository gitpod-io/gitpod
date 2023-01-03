// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"reflect"
	"testing"
)

func Test_allowListCollector_Reconcile(t *testing.T) {
	type args struct {
		labels map[string]string
	}
	c := &allowListCollector{
		Collector: nil,
		Labels:    []string{"hello", "world"},
		AllowLabelValues: map[string][]string{
			"hello":    {"awesome", "gitpod"},
			"world":    {"io"},
			"wildcard": {"*"},
		},
		AllowLabelDefaultValues: map[string]string{
			"hello": "defaultValue",
		},
		reportedUnexpected: make(map[string]struct{}),
	}
	tests := []struct {
		name string
		args args
		want map[string]string
	}{
		{
			name: "HappyPath",
			args: args{
				labels: map[string]string{
					"hello": "gitpod",
					"world": "io",
				},
			},
			want: map[string]string{
				"hello": "gitpod",
				"world": "io",
			},
		},
		{
			name: "MissedKeyFallbackToDefault",
			args: args{
				labels: map[string]string{
					"world": "io",
				},
			},
			want: map[string]string{
				"hello": "defaultValue",
				"world": "io",
			},
		},
		{
			name: "MissedDefaultFallbackToDefaultDefault",
			args: args{
				labels: map[string]string{},
			},
			want: map[string]string{
				"hello": "defaultValue",
				"world": UnknownValue,
			},
		},
		{
			name: "UnknownFiledDeleted",
			args: args{
				labels: map[string]string{
					"foo": "bar",
				},
			},
			want: map[string]string{
				"hello": "defaultValue",
				"world": UnknownValue,
			},
		},
		{
			name: "OutOfRangeValueUseDeafult",
			args: args{
				labels: map[string]string{
					"hello": "wrongValue",
				},
			},
			want: map[string]string{
				"hello": "defaultValue",
				"world": UnknownValue,
			},
		},
		{
			name: "OutOfRangeValueUseDeafult2",
			args: args{
				labels: map[string]string{
					"hello": "wrongValue",
					"world": "aa",
				},
			},
			want: map[string]string{
				"hello": "defaultValue",
				"world": UnknownValue,
			},
		},
		{
			name: "FreeStyle",
			args: args{
				labels: map[string]string{
					"hello": "gitpod",
					"world": "aa",
					"foo":   "bar",
				},
			},
			want: map[string]string{
				"hello": "gitpod",
				"world": UnknownValue,
			},
		},
		{
			name: "Wildcard",
			args: args{
				labels: map[string]string{
					"wildcard": "gitpod",
				},
			},
			want: map[string]string{
				"hello":    "defaultValue",
				"world":    UnknownValue,
				"wildcard": "gitpod",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := c.Reconcile("foo", tt.args.labels); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("allowListCollector.Reconcile() = %v, want %v", got, tt.want)
			}
		})
	}
}
