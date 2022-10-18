// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package api_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"google.golang.org/protobuf/proto"
)

func TestGetCheckoutLocationsFromInitializer(t *testing.T) {
	var init []*api.WorkspaceInitializer
	init = append(init, &api.WorkspaceInitializer{
		Spec: &api.WorkspaceInitializer_Git{
			Git: &api.GitInitializer{
				CheckoutLocation: "/foo",
				CloneTaget:       "head",
				Config: &api.GitConfig{
					Authentication: api.GitAuthMethod_NO_AUTH,
				},
				RemoteUri:  "somewhere-else",
				TargetMode: api.CloneTargetMode_LOCAL_BRANCH,
			},
		},
	})
	init = append(init, &api.WorkspaceInitializer{
		Spec: &api.WorkspaceInitializer_Git{
			Git: &api.GitInitializer{
				CheckoutLocation: "/bar",
				CloneTaget:       "head",
				Config: &api.GitConfig{
					Authentication: api.GitAuthMethod_NO_AUTH,
				},
				RemoteUri:  "somewhere-else",
				TargetMode: api.CloneTargetMode_LOCAL_BRANCH,
			},
		},
	})

	tests := []struct {
		Name        string
		Initializer *api.WorkspaceInitializer
		Expectation string
	}{
		{
			Name: "single git initializer",
			Initializer: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Git{
					Git: &api.GitInitializer{
						CheckoutLocation: "/foo",
						CloneTaget:       "head",
						Config: &api.GitConfig{
							Authentication: api.GitAuthMethod_NO_AUTH,
						},
						RemoteUri:  "somewhere-else",
						TargetMode: api.CloneTargetMode_LOCAL_BRANCH,
					},
				},
			},
			Expectation: "/foo",
		},
		{
			Name: "multiple git initializer",
			Initializer: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Composite{
					Composite: &api.CompositeInitializer{
						Initializer: init,
					},
				},
			},
			Expectation: "/foo,/bar",
		},
		{
			Name: "backup initializer",
			Initializer: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Backup{
					Backup: &api.FromBackupInitializer{
						CheckoutLocation: "/foobar",
					},
				},
			},
			Expectation: "/foobar",
		},
		{
			Name: "prebuild initializer",
			Initializer: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Prebuild{
					Prebuild: &api.PrebuildInitializer{
						Git: []*api.GitInitializer{
							{CheckoutLocation: "/foo"},
							{CheckoutLocation: "/bar"},
						},
					},
				},
			},
			Expectation: "/foo,/bar",
		},
		{
			Name: "nil initializer",
		},
		{
			Name: "snapshot initializer",
			Initializer: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Snapshot{
					Snapshot: &api.SnapshotInitializer{
						Snapshot:           "foo",
						FromVolumeSnapshot: true,
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			locations := strings.Join(api.GetCheckoutLocationsFromInitializer(test.Initializer), ",")
			if locations != test.Expectation {
				t.Errorf("expected %s, got %s", test.Expectation, locations)
			}
		})
	}
}

func TestExtractInjectSecretsFromInitializer(t *testing.T) {
	tests := []struct {
		Name        string
		Input       *api.WorkspaceInitializer
		Expectation map[string]string
	}{
		{
			Name: "git initializer",
			Input: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Git{
					Git: &api.GitInitializer{
						Config: &api.GitConfig{
							AuthPassword: "foobar",
						},
					},
				},
			},
			Expectation: map[string]string{
				"initializer.git": "foobar",
			},
		},
		{
			Name: "no secret git initializer",
			Input: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Git{
					Git: &api.GitInitializer{
						Config: &api.GitConfig{},
					},
				},
			},
			Expectation: map[string]string{},
		},
		{
			Name: "prebuild initializer",
			Input: &api.WorkspaceInitializer{
				Spec: &api.WorkspaceInitializer_Prebuild{
					Prebuild: &api.PrebuildInitializer{
						Git: []*api.GitInitializer{
							{
								Config: &api.GitConfig{
									AuthPassword: "foobar",
								},
							},
							{
								Config: &api.GitConfig{
									AuthPassword: "some value",
								},
							},
						},
					},
				},
			},
			Expectation: map[string]string{
				"initializer.prebuild.0.git": "foobar",
				"initializer.prebuild.1.git": "some value",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			original := proto.Clone(test.Input)
			act := api.GatherSecretsFromInitializer(test.Input)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected GatherSecretsFromInitializer (-want +got):\n%s", diff)
			}

			ignoreUnexported := []interface{}{
				api.WorkspaceInitializer{},
				api.WorkspaceInitializer_Git{},
				api.GitInitializer{},
				api.GitConfig{},
				api.PrebuildInitializer{},
			}
			if diff := cmp.Diff(original, test.Input, cmpopts.IgnoreUnexported(ignoreUnexported...)); diff != "" {
				t.Errorf("unexpected alteration from GatherSecretsFromInitializer (-want +got):\n%s", diff)
			}

			act = api.ExtractAndReplaceSecretsFromInitializer(test.Input)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected ExtractSecretsFromInitializer (-want +got):\n%s", diff)
			}

			_ = api.WalkInitializer(nil, test.Input, func(path []string, init *api.WorkspaceInitializer) error {
				git, ok := init.Spec.(*api.WorkspaceInitializer_Git)
				if !ok {
					return nil
				}
				if pwd := git.Git.Config.AuthPassword; pwd != "" && !strings.HasPrefix(pwd, "extracted-secret/") {
					t.Errorf("expected authPassword to be extracted, but got %s at %s", pwd, filepath.Join(path...))
				}

				return nil
			})

			injection := make(map[string][]byte, len(act))
			for k, v := range act {
				injection[k] = []byte(v)
			}

			err := api.InjectSecretsToInitializer(test.Input, injection)
			if err != nil {
				t.Fatal(err)
			}

			_ = api.WalkInitializer(nil, test.Input, func(path []string, init *api.WorkspaceInitializer) error {
				git, ok := init.Spec.(*api.WorkspaceInitializer_Git)
				if !ok {
					return nil
				}
				if pwd := git.Git.Config.AuthPassword; pwd != "" && strings.HasPrefix(pwd, "extracted-secret/") {
					t.Errorf("expected authPassword to be injected, but got %s at %s", pwd, filepath.Join(path...))
				}

				return nil
			})
		})
	}
}
