// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer_test

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/google/go-cmp/cmp"
)

type InitializerFunc func(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, error)

func (f InitializerFunc) Run(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, error) {
	return f(ctx, mappings)
}

type RecordingInitializer struct {
	CallCount int
}

func (f *RecordingInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, error) {
	f.CallCount++
	return csapi.WorkspaceInitFromOther, nil
}

func TestGetCheckoutLocationsFromInitializer(t *testing.T) {
	var init []*csapi.WorkspaceInitializer
	init = append(init, &csapi.WorkspaceInitializer{
		Spec: &csapi.WorkspaceInitializer_Git{
			Git: &csapi.GitInitializer{
				CheckoutLocation: "/foo",
				CloneTaget:       "head",
				Config: &csapi.GitConfig{
					Authentication: csapi.GitAuthMethod_NO_AUTH,
				},
				RemoteUri:  "somewhere-else",
				TargetMode: csapi.CloneTargetMode_LOCAL_BRANCH,
			},
		},
	})
	init = append(init, &csapi.WorkspaceInitializer{
		Spec: &csapi.WorkspaceInitializer_Git{
			Git: &csapi.GitInitializer{
				CheckoutLocation: "/bar",
				CloneTaget:       "head",
				Config: &csapi.GitConfig{
					Authentication: csapi.GitAuthMethod_NO_AUTH,
				},
				RemoteUri:  "somewhere-else",
				TargetMode: csapi.CloneTargetMode_LOCAL_BRANCH,
			},
		},
	})

	tests := []struct {
		Name        string
		Initializer *csapi.WorkspaceInitializer
		Expectation string
	}{
		{
			Name: "single git initializer",
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Git{
					Git: &csapi.GitInitializer{
						CheckoutLocation: "/foo",
						CloneTaget:       "head",
						Config: &csapi.GitConfig{
							Authentication: csapi.GitAuthMethod_NO_AUTH,
						},
						RemoteUri:  "somewhere-else",
						TargetMode: csapi.CloneTargetMode_LOCAL_BRANCH,
					},
				},
			},
			Expectation: "/foo",
		},
		{
			Name: "multiple git initializer",
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Composite{
					Composite: &csapi.CompositeInitializer{
						Initializer: init,
					},
				},
			},
			Expectation: "/foo,/bar",
		},
		{
			Name: "backup initializer",
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Backup{
					Backup: &csapi.FromBackupInitializer{
						CheckoutLocation: "/foobar",
					},
				},
			},
			Expectation: "/foobar",
		},
		{
			Name: "prebuild initializer",
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Prebuild{
					Prebuild: &csapi.PrebuildInitializer{
						Git: []*csapi.GitInitializer{
							{CheckoutLocation: "/foo"},
							{CheckoutLocation: "/bar"},
						},
					},
				},
			},
			Expectation: "/foo,/bar",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			locations := strings.Join(initializer.GetCheckoutLocationsFromInitializer(test.Initializer), ",")
			if locations != test.Expectation {
				t.Errorf("expected %s, got %s", test.Expectation, locations)
			}
		})
	}
}

func TestExtractInjectSecretsFromInitializer(t *testing.T) {
	tests := []struct {
		Name        string
		Input       *csapi.WorkspaceInitializer
		Expectation map[string]string
	}{
		{
			Name: "git initializer",
			Input: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Git{
					Git: &csapi.GitInitializer{
						Config: &csapi.GitConfig{
							AuthPassword: "foobar",
						},
					},
				},
			},
			Expectation: map[string]string{
				"initializer/git": "foobar",
			},
		},
		{
			Name: "no secret git initializer",
			Input: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Git{
					Git: &csapi.GitInitializer{
						Config: &csapi.GitConfig{},
					},
				},
			},
			Expectation: map[string]string{},
		},
		{
			Name: "prebuild initializer",
			Input: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Prebuild{
					Prebuild: &csapi.PrebuildInitializer{
						Git: []*csapi.GitInitializer{
							{
								Config: &csapi.GitConfig{
									AuthPassword: "foobar",
								},
							},
							{
								Config: &csapi.GitConfig{
									AuthPassword: "some value",
								},
							},
						},
					},
				},
			},
			Expectation: map[string]string{
				"initializer/prebuild/0/git": "foobar",
				"initializer/prebuild/1/git": "some value",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := initializer.ExtractSecretsFromInitializer(test.Input)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected ExtractSecretsFromInitializer (-want +got):\n%s", diff)
			}

			_ = initializer.WalkInitializer(nil, test.Input, func(path []string, init *csapi.WorkspaceInitializer) error {
				git, ok := init.Spec.(*csapi.WorkspaceInitializer_Git)
				if !ok {
					return nil
				}
				if pwd := git.Git.Config.AuthPassword; pwd != "" && !strings.HasPrefix(pwd, "extracted-secret/") {
					t.Errorf("expected authPassword to be extracted, but got %s at %s", pwd, filepath.Join(path...))
				}

				return nil
			})

			err := initializer.InjectSecretsToInitializer(test.Input, act)
			if err != nil {
				t.Fatal(err)
			}

			_ = initializer.WalkInitializer(nil, test.Input, func(path []string, init *csapi.WorkspaceInitializer) error {
				git, ok := init.Spec.(*csapi.WorkspaceInitializer_Git)
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

func TestCompositeInitializer(t *testing.T) {
	tests := []struct {
		Name     string
		Children []initializer.Initializer
		Eval     func(t *testing.T, src csapi.WorkspaceInitSource, err error, children []initializer.Initializer)
	}{
		{
			Name: "empty",
			Eval: func(t *testing.T, src csapi.WorkspaceInitSource, err error, children []initializer.Initializer) {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			},
		},
		{
			Name: "single",
			Children: []initializer.Initializer{
				&RecordingInitializer{},
			},
			Eval: func(t *testing.T, src csapi.WorkspaceInitSource, err error, children []initializer.Initializer) {
				if cc := children[0].(*RecordingInitializer).CallCount; cc != 1 {
					t.Errorf("unexpected call count: expected 1, got %d", cc)
				}
			},
		},
		{
			Name: "multiple",
			Children: []initializer.Initializer{
				&RecordingInitializer{},
				&RecordingInitializer{},
				&RecordingInitializer{},
			},
			Eval: func(t *testing.T, src csapi.WorkspaceInitSource, err error, children []initializer.Initializer) {
				for i := range children {
					if cc := children[i].(*RecordingInitializer).CallCount; cc != 1 {
						t.Errorf("unexpected call count on initializer %d: expected 1, got %d", i, cc)
					}
				}
			},
		},
		{
			Name: "error propagation",
			Children: []initializer.Initializer{
				&RecordingInitializer{},
				InitializerFunc(func(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, error) {
					return csapi.WorkspaceInitFromOther, fmt.Errorf("error happened here")
				}),
				&RecordingInitializer{},
			},
			Eval: func(t *testing.T, src csapi.WorkspaceInitSource, err error, children []initializer.Initializer) {
				if err == nil {
					t.Errorf("expected error, got nothing")
				}
				if cc := children[0].(*RecordingInitializer).CallCount; cc != 1 {
					t.Errorf("unexpected call count on first initializer: expected 1, got %d", cc)
				}
				if cc := children[2].(*RecordingInitializer).CallCount; cc != 0 {
					t.Errorf("unexpected call count on last initializer: expected 0, got %d", cc)
				}
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			comp := initializer.CompositeInitializer(test.Children)
			src, err := comp.Run(context.Background(), nil)
			test.Eval(t, src, err, test.Children)
		})
	}
}
