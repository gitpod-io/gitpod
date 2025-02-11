// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"testing"
)

func TestAuthorize(t *testing.T) {
	type expectation struct {
		user string
		pass string
		err  string
	}
	tests := []struct {
		name        string
		constructor func(string) (MapAuthorizer, error)
		input       string
		testHost    string
		expected    expectation
	}{
		{
			name:        "docker auth format - valid credentials",
			constructor: NewAuthorizerFromDockerEnvVar,
			input:       `{"auths": {"registry.example.com": {"auth": "dXNlcjpwYXNz"}}}`, // base64(user:pass)
			testHost:    "registry.example.com",
			expected: expectation{
				user: "user",
				pass: "pass",
			},
		},
		{
			name:        "docker auth format - valid credentials - host with port",
			constructor: NewAuthorizerFromDockerEnvVar,
			input:       `{"auths": {"registry.example.com": {"auth": "dXNlcjpwYXNz"}}}`, // base64(user:pass)
			testHost:    "registry.example.com:443",
			expected: expectation{
				user: "user",
				pass: "pass",
			},
		},
		{
			name:        "docker auth format - invalid host",
			constructor: NewAuthorizerFromDockerEnvVar,
			input:       `{"auths": {"registry.example.com": {"auth": "dXNlcjpwYXNz"}}}`,
			testHost:    "wrong.registry.com",
			expected: expectation{
				user: "",
				pass: "",
			},
		},
		{
			name:        "env var format - valid credentials",
			constructor: NewAuthorizerFromEnvVar,
			input:       `{"registry.example.com": {"auth": "dXNlcjpwYXNz"}}`,
			testHost:    "registry.example.com",
			expected: expectation{
				user: "user",
				pass: "pass",
			},
		},
		{
			name:        "env var format - empty input",
			constructor: NewAuthorizerFromEnvVar,
			input:       "",
			testHost:    "registry.example.com",
			expected: expectation{
				user: "",
				pass: "",
			},
		},
		{
			name:        "gitpod format - valid credentials",
			constructor: NewAuthorizerFromEnvVar,
			input:       `{"registry.example.com": {"auth": "dXNlcjpwYXNz"}}`,
			testHost:    "registry.example.com",
			expected: expectation{
				user: "user",
				pass: "pass",
			},
		},
		{
			name:        "gitpod format - multiple hosts",
			constructor: NewAuthorizerFromEnvVar,
			input:       `{"registry1.example.com": {"auth": "dXNlcjE6cGFzczEK"}, "registry2.example.com": {"auth": "dXNlcjI6cGFzczIK"}}`,
			testHost:    "registry2.example.com",
			expected: expectation{
				user: "user2",
				pass: "pass2",
			},
		},
		{
			name:        "gitpod format - invalid format",
			constructor: NewAuthorizerFromEnvVar,
			input:       "invalid:format:with:toomany:colons",
			testHost:    "registry.example.com",
			expected: expectation{
				err: "invalid character 'i' looking for beginning of value",
			},
		},
		{
			name:        "gitpod format - empty input",
			constructor: NewAuthorizerFromEnvVar,
			input:       "",
			testHost:    "registry.example.com",
			expected: expectation{
				user: "",
				pass: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth, err := tt.constructor(tt.input)
			if err != nil {
				if tt.expected.err == "" {
					t.Errorf("Constructor failed: %s", err)
				}
				return
			}

			actualUser, actualPassword, err := auth.Authorize(tt.testHost)
			if (err != nil) != (tt.expected.err != "") {
				t.Errorf("Authorize() error = %v, wantErr %v", err, tt.expected.err)
				return
			}
			if actualUser != tt.expected.user {
				t.Errorf("Authorize() actual user = %v, want %v", actualUser, tt.expected.user)
			}
			if actualPassword != tt.expected.pass {
				t.Errorf("Authorize() actual password = %v, want %v", actualPassword, tt.expected.pass)
			}
		})
	}
}
