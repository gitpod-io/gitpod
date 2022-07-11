// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer_test

import (
	"context"
	"fmt"
	"testing"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
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
