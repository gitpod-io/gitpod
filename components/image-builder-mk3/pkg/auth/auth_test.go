// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"encoding/base64"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestIsECRRegistry(t *testing.T) {
	tests := []struct {
		Registry    string
		Expectation bool
	}{
		{Registry: "422899872803.dkr.ecr.eu-central-1.amazonaws.com/private-repo-demo:latest", Expectation: true},
		{Registry: "422899872803.dkr.ecr.eu-central-1.amazonaws.com", Expectation: true},
		{Registry: "index.docker.io/foo:bar", Expectation: false},
	}

	for _, test := range tests {
		t.Run(test.Registry, func(t *testing.T) {
			act := isECRRegistry(test.Registry)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("isECRRegistry() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAdditionalAuth(t *testing.T) {
	tests := []struct {
		name          string
		domain        string
		additionalMap map[string]string
		expectedAuth  *Authentication
	}{
		{
			name:   "standard host:token",
			domain: "myregistry.com",
			additionalMap: map[string]string{
				"myregistry.com": base64.StdEncoding.EncodeToString([]byte("myregistry.com:mytoken")),
			},
			expectedAuth: &Authentication{
				Username: "myregistry.com",
				Password: "mytoken",
				Auth:     base64.StdEncoding.EncodeToString([]byte("myregistry.com:mytoken")),
			},
		},
		{
			name:   "buggy host:port:token",
			domain: "myregistry.com:5000",
			additionalMap: map[string]string{
				"myregistry.com:5000": base64.StdEncoding.EncodeToString([]byte("myregistry.com:5000:mytoken")),
			},
			expectedAuth: &Authentication{
				Username: "myregistry.com:5000",
				Password: "mytoken",
				Auth:     base64.StdEncoding.EncodeToString([]byte("myregistry.com:5000:mytoken")),
			},
		},
		{
			name:   "only username, no password/token (single segment)",
			domain: "useronly.com",
			additionalMap: map[string]string{
				"useronly.com": base64.StdEncoding.EncodeToString([]byte("justauser")),
			},
			expectedAuth: &Authentication{
				Auth: base64.StdEncoding.EncodeToString([]byte("justauser")),
			},
		},
		{
			name:   "empty auth string",
			domain: "emptyauth.com",
			additionalMap: map[string]string{
				"emptyauth.com": base64.StdEncoding.EncodeToString([]byte("")),
			},
			expectedAuth: &Authentication{
				Auth: base64.StdEncoding.EncodeToString([]byte("")),
			},
		},
		{
			name:          "domain not in map",
			domain:        "notfound.com",
			additionalMap: map[string]string{"someother.com": base64.StdEncoding.EncodeToString([]byte("someauth"))},
			expectedAuth:  nil,
		},
		{
			name:   "invalid base64 string",
			domain: "invalidbase64.com",
			additionalMap: map[string]string{
				"invalidbase64.com": "!!!INVALID_BASE64!!!",
			},
			expectedAuth: &Authentication{
				Auth: "!!!INVALID_BASE64!!!",
			},
		},
		{
			name:   "standard host:token where username in cred is different from domain key",
			domain: "docker.io",
			additionalMap: map[string]string{
				"docker.io": base64.StdEncoding.EncodeToString([]byte("user1:pass1")),
			},
			expectedAuth: &Authentication{
				Username: "user1",
				Password: "pass1",
				Auth:     base64.StdEncoding.EncodeToString([]byte("user1:pass1")),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			aaf := AllowedAuthFor{
				Additional: tt.additionalMap,
			}
			actualAuth := aaf.additionalAuth(tt.domain)

			if diff := cmp.Diff(tt.expectedAuth, actualAuth); diff != "" {
				t.Errorf("additionalAuth() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
