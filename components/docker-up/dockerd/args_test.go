// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dockerd

import (
	"reflect"
	"sort"
	"testing"

	"github.com/sirupsen/logrus"
)

func TestMapUserArgs(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected []string
		wantErr  bool
	}{
		{
			name:     "empty input",
			input:    map[string]interface{}{},
			expected: []string{},
			wantErr:  false,
		},
		{
			name: "tls and proxy settings",
			input: map[string]interface{}{
				"proxies": map[string]interface{}{
					"http-proxy":  "localhost:38080",
					"https-proxy": "localhost:38081",
				},
			},
			expected: []string{
				"--http-proxy=localhost:38080",
				"--https-proxy=localhost:38081",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log := logrus.New().WithField("test", t.Name())
			got, err := mapUserArgs(log, tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("mapUserArgs() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				sort.Strings(got)
				sort.Strings(tt.expected)
				// Sort both slices to ensure consistent comparison
				if !reflect.DeepEqual(got, tt.expected) {
					t.Errorf("mapUserArgs() = %v, want %v", got, tt.expected)
				}
			}
		})
	}
}
