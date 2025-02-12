// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestInsertRegistryAuth(t *testing.T) {
	type expectation struct {
		json string
		err  string
	}
	tests := []struct {
		name           string
		existingConfig string // JSON string of existing config.json
		inputConfig    DockerConfig
		expect         expectation
	}{
		{
			name:           "append to empty config",
			existingConfig: "",
			inputConfig: DockerConfig{
				Auths: map[string]RegistryAuth{
					"reg1.example.com": {Auth: "dXNlcjE6cGFzczE="}, // user1:pass1
				},
			},
			expect: expectation{
				json: `{
                    "auths": {
                        "reg1.example.com": {"auth": "dXNlcjE6cGFzczE="}
                    }
                }`,
			},
		},
		{
			name: "merge with existing config preserving other fields",
			existingConfig: `{
                "auths": {
                    "reg1.example.com": {"auth": "existing=="}
                },
                "credsStore": "desktop",
                "experimental": "enabled",
                "stackOrchestrator": "swarm"
            }`,
			inputConfig: DockerConfig{
				Auths: map[string]RegistryAuth{
					"reg2.example.com": {Auth: "bmV3QXV0aA=="}, // newAuth
				},
			},
			expect: expectation{
				json: `{
                    "auths": {
                        "reg1.example.com": {"auth": "existing=="},
                        "reg2.example.com": {"auth": "bmV3QXV0aA=="}
                    },
                    "credsStore": "desktop",
                    "experimental": "enabled",
                    "stackOrchestrator": "swarm"
                }`,
			},
		},
		{
			name: "override existing registry auth preserving structure",
			existingConfig: `{
                "auths": {
                    "reg1.example.com": {"auth": "old=="}
                },
                "credHelpers": {
                    "registry.example.com": "ecr-login"
                }
            }`,
			inputConfig: DockerConfig{
				Auths: map[string]RegistryAuth{
					"reg1.example.com": {Auth: "updated=="},
				},
			},
			expect: expectation{
				json: `{
                    "auths": {
                        "reg1.example.com": {"auth": "updated=="}
                    },
                    "credHelpers": {
                        "registry.example.com": "ecr-login"
                    }
                }`,
			},
		},
		{
			name:           "invalid existing config json",
			existingConfig: `{invalid json`,
			inputConfig: DockerConfig{
				Auths: map[string]RegistryAuth{
					"reg1.example.com": {Auth: "dXNlcjE6cGFzczE="},
				},
			},
			expect: expectation{
				err: "failed to parse existing docker config: invalid character 'i' looking for beginning of object key string",
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create temp dir for test
			tmpDir, err := os.MkdirTemp("", "docker-test-*")
			if err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(tmpDir)

			// Set up mock home dir
			oldHome := os.Getenv("HOME")
			defer os.Setenv("HOME", oldHome)
			os.Setenv("HOME", tmpDir)

			// Write existing config if any
			if tc.existingConfig != "" {
				configDir := filepath.Join(tmpDir, ".docker")
				if err := os.MkdirAll(configDir, 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(
					filepath.Join(configDir, "config.json"),
					[]byte(tc.existingConfig),
					0600,
				); err != nil {
					t.Fatal(err)
				}
			}

			// Run test
			err = insertDockerRegistryAuthentication(tc.inputConfig, 33333, 33333)
			if tc.expect.err != "" {
				if err == nil {
					t.Error("expected error but got none")
				}

				if diff := cmp.Diff(tc.expect.err, err.Error()); diff != "" {
					t.Errorf("unexpected error (-want +got):\n%s", diff)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Read resulting config
			configBytes, err := os.ReadFile(filepath.Join(tmpDir, ".docker", "config.json"))
			if err != nil {
				t.Fatal(err)
			}

			// Compare JSON structural equality
			var got, want interface{}
			if err := json.Unmarshal(configBytes, &got); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal([]byte(tc.expect.json), &want); err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("unexpected config (-want +got):\n%s", diff)
			}
		})
	}
}
