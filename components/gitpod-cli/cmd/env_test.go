// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"reflect"
	"testing"

	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
)

func TestParseArgs(t *testing.T) {
	tests := []struct {
		Desc        string
		Input       []string
		Expectation []*serverapi.UserEnvVarValue
		Error       string
	}{
		{"empty string", []string{""}, nil, "empty string (correct format is key=value)"},
		{"invalid - key without value", []string{"K"}, nil, "K has no equal character (correct format is K=some_value)"},
		{"no key with value", []string{"=value"}, nil, "variable must have a name"},
		{"simple key value", []string{"key=value"}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "value"},
		},
			"",
		},
		{"key with empty value", []string{"key=\" \""}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: " "},
		},
			"",
		},
		{"key value with equals", []string{"key=something=else"}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "something=else"},
		},
			"",
		},
		{"key value empty quoted value", []string{"key=\"\""}, nil, "variable must have a value; use -u to unset a variable"},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			kv, err := parseArgs(test.Input, "")
			if err != nil {
				if test.Error != err.Error() {
					t.Errorf("expected error '%v' but '%v' was returned", test.Error, err)
				}

				return
			}

			if !reflect.DeepEqual(kv, test.Expectation) {
				t.Errorf("unexpected result: %v, expected %v", kv, test.Expectation)
			}
		})
	}
}
