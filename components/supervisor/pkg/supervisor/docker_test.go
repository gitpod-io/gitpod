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

// tests the parsing logic of insertCredentialsIntoConfig
func TestInsertCredentialsIntoConfig_Parsing(t *testing.T) {
	tests := []struct {
		name              string
		imageAuthInput    string
		expectedAuthsJSON string
		expectedCount     int
		expectError       bool
	}{
		{
			name:           "simple host and token",
			imageAuthInput: "myregistry.com:secrettoken",
			expectedAuthsJSON: `{
				"myregistry.com": {"auth": "secrettoken"}
			}`,
			expectedCount: 1,
		},
		{
			name:           "docker.io host and token",
			imageAuthInput: "docker.io:dockertoken",
			expectedAuthsJSON: `{
				"https://index.docker.io/v1/": {"auth": "dockertoken"}
			}`,
			expectedCount: 1,
		},
		{
			name:           "subdomain of docker.io and token",
			imageAuthInput: "sub.docker.io:subdockertoken",
			expectedAuthsJSON: `{
				"https://index.docker.io/v1/": {"auth": "subdockertoken"}
			}`,
			expectedCount: 1,
		},
		{
			name:           "host with port and token",
			imageAuthInput: "myregistry.com:5000:supersecret",
			expectedAuthsJSON: `{
				"myregistry.com:5000": {"auth": "supersecret"}
			}`,
			expectedCount: 1,
		},
		{
			name:           "multiple credentials, some with port",
			imageAuthInput: "reg1.com:token1,reg2.com:6000:token2,docker.io:token3",
			expectedAuthsJSON: `{
				"reg1.com": {"auth": "token1"},
				"reg2.com:6000": {"auth": "token2"},
				"https://index.docker.io/v1/": {"auth": "token3"}
			}`,
			expectedCount: 3,
		},
		{
			name:              "empty imageAuth string",
			imageAuthInput:    "",
			expectedAuthsJSON: `{}`,
			expectedCount:     0,
		},
		{
			name:           "credential with empty token part",
			imageAuthInput: "myregistry.com:",
			expectedAuthsJSON: `{
				"myregistry.com": {"auth": ""}
			}`,
			expectedCount: 1,
		},
		{
			name:           "credential with empty host part",
			imageAuthInput: ":mytoken",
			expectedAuthsJSON: `{
				"": {"auth": "mytoken"}
			}`,
			expectedCount: 1,
		},
		{
			name:           "credential with only a colon",
			imageAuthInput: ":",
			expectedAuthsJSON: `{
				"": {"auth": ""}
			}`,
			expectedCount: 1,
		},
		{
			name:              "single invalid credential (no colon)",
			imageAuthInput:    "myregistry.com",
			expectedAuthsJSON: `{}`,
			expectedCount:     0,
		},
		{
			name:           "mixed valid and invalid credentials",
			imageAuthInput: "reg1.com:token1,invalidreg,reg2.com:token2",
			expectedAuthsJSON: `{
				"reg1.com": {"auth": "token1"},
				"reg2.com": {"auth": "token2"}
			}`,
			expectedCount: 2,
		},
		{
			name:           "input with leading/trailing spaces for the whole string",
			imageAuthInput: "  myregistry.com:spacedtoken  ",
			expectedAuthsJSON: `{
				"myregistry.com": {"auth": "spacedtoken"}
			}`,
			expectedCount: 1,
		},
		{
			name:           "input with spaces around comma separator creating leading space in host",
			imageAuthInput: "reg1.com:token1 , reg2.com:token2",
			expectedAuthsJSON: `{
				"reg1.com": {"auth": "token1 "},
				" reg2.com": {"auth": "token2"}
			}`,
			expectedCount: 2,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tmpDir, err := os.MkdirTemp("", "docker-auth-test-")
			if err != nil {
				t.Fatalf("Failed to create temp dir: %v", err)
			}
			defer os.RemoveAll(tmpDir)

			originalHome := os.Getenv("HOME")
			os.Setenv("HOME", tmpDir)
			defer os.Setenv("HOME", originalHome)

			count, err := insertCredentialsIntoConfig(tc.imageAuthInput)

			if tc.expectError {
				if err == nil {
					t.Errorf("Expected an error, but got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("insertCredentialsIntoConfig() returned an unexpected error: %v", err)
			}

			if count != tc.expectedCount {
				t.Errorf("Expected count %d, got %d", tc.expectedCount, count)
			}

			configPath := filepath.Join(tmpDir, ".docker", "config.json")

			var expectedAuthsMap map[string]RegistryAuth
			if err := json.Unmarshal([]byte(tc.expectedAuthsJSON), &expectedAuthsMap); err != nil {
				t.Fatalf("Failed to unmarshal expectedAuthsJSON for tc '%s': %v. JSON: %s", tc.name, err, tc.expectedAuthsJSON)
			}

			_, statErr := os.Stat(configPath)
			if os.IsNotExist(statErr) {
				if len(expectedAuthsMap) == 0 && tc.expectedCount == 0 {
					return
				}
				t.Fatalf("Config file %s does not exist, but expected auths (count: %d, map: %s)", configPath, tc.expectedCount, tc.expectedAuthsJSON)
			}
			if statErr != nil && !os.IsNotExist(statErr) {
				t.Fatalf("Error stating config file %s: %v", configPath, statErr)
			}

			configBytes, readErr := os.ReadFile(configPath)
			if readErr != nil {
				t.Fatalf("Failed to read docker config file %s: %v. Expected auths: %s", configPath, readErr, tc.expectedAuthsJSON)
			}

			var resultConfig DockerConfig
			if err := json.Unmarshal(configBytes, &resultConfig); err != nil {
				t.Fatalf("Failed to unmarshal result config: %v. Content: %s", err, string(configBytes))
			}

			if len(expectedAuthsMap) == 0 {
				if len(resultConfig.Auths) != 0 {
					t.Errorf("Expected empty auths, but got: %v", resultConfig.Auths)
				}
			} else {
				if diff := cmp.Diff(expectedAuthsMap, resultConfig.Auths); diff != "" {
					t.Errorf("Unexpected auths map in config.json (-want +got):\n%s", diff)
				}
			}
		})
	}
}
