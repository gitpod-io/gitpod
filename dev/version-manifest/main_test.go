// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"io/fs"
	"testing"
	"testing/fstest"

	"github.com/google/go-cmp/cmp"
)

func TestProduceManifest(t *testing.T) {
	type Expectation struct {
		MF    string
		Error string
	}
	tests := []struct {
		Name        string
		FS          fs.FS
		Expectation Expectation
	}{
		{
			Name: "happy path",
			FS: fstest.MapFS{
				"c1/metadata.yaml":  &fstest.MapFile{Data: []byte("helm-component: c1")},
				"c1/imgnames.txt":   &fstest.MapFile{Data: []byte("failthis\nimgc1:v1")},
				"c2/metadata.yaml":  &fstest.MapFile{Data: []byte("helm-component: c2.nested")},
				"c2/imgnames.txt":   &fstest.MapFile{Data: []byte("failthis\nimgc2:v2\n\n")},
				"c20/metadata.yaml": &fstest.MapFile{Data: []byte("helm-component: c2.other")},
				"c20/imgnames.txt":  &fstest.MapFile{Data: []byte("failthis\nimgc2:v2\n\n")},
			},
			Expectation: Expectation{
				MF: `components:
  c1:
    version: v1

  c2:
    nested:
      version: v2

    other:
      version: v2

`,
			},
		},
		{
			Name: "imgnames only",
			FS: fstest.MapFS{
				"c1/imgnames.txt": &fstest.MapFile{Data: []byte("imgc1")},
			},
			Expectation: Expectation{MF: "components:\n"},
		},
		{
			Name: "incomplete metadata",
			FS: fstest.MapFS{
				"c1/metadata.yaml": &fstest.MapFile{Data: []byte("")},
				"c1/imgnames.txt":  &fstest.MapFile{Data: []byte("failthis\nimgc1")},
			},
			Expectation: Expectation{MF: "components:\n"},
		},
		{
			Name: "missing imgnames",
			FS: fstest.MapFS{
				"c1/metadata.yaml": &fstest.MapFile{Data: []byte("helm-component: foobar")},
			},
			Expectation: Expectation{Error: "cannot read image names for c1/metadata.yaml: open c1/imgnames.txt: file does not exist"},
		},
		{
			Name: "broken metadata",
			FS: fstest.MapFS{
				"c1/metadata.yaml": &fstest.MapFile{Data: []byte("invalid YAML")},
				"c1/imgnames.txt":  &fstest.MapFile{Data: []byte("failthis\nimgc1")},
			},
			Expectation: Expectation{Error: "cannot unmarshal c1/metadata.yaml: yaml: unmarshal errors:\n  line 1: cannot unmarshal !!str `invalid...` into main.MD"},
		},
		{
			Name: "invalid image name",
			FS: fstest.MapFS{
				"c1/metadata.yaml": &fstest.MapFile{Data: []byte("helm-component: foobar")},
				"c1/imgnames.txt":  &fstest.MapFile{Data: []byte("failthis\nimgc1")},
			},
			Expectation: Expectation{Error: "invalid image format: imgc1"},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			buf := bytes.NewBuffer(nil)
			err := produceManifest(buf, test.FS)
			var act Expectation
			if err != nil {
				act.Error = err.Error()
			} else {
				act.MF = buf.String()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("produceManifest() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
