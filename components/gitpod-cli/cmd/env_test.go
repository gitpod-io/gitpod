// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"testing"

	"github.com/google/go-cmp/cmp"

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
		{"key value containing spaces", []string{"key=\"hello world\""}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "hello world"},
		},
			"",
		},
		{"key value containing space, quotes stripped by shell", []string{"key=hello world"}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "hello world"},
		},
			"",
		},
		{"key value containing newline", []string{"key=hello\nworld"}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "hello\nworld"},
		},
			"",
		},
		{"value containing equals sign", []string{"key=hello=world"}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "hello=world"},
		},
			"",
		},
		{"value containing quoted equals sign", []string{"key=\"hello=world\""}, []*serverapi.UserEnvVarValue{
			{Name: "key", Value: "hello=world"},
		},
			"",
		},
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

			if diff := cmp.Diff(test.Expectation, kv); diff != "" {
				t.Errorf("parseArgs() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
