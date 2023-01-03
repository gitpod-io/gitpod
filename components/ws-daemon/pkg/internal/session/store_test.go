// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package session

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

func TestDoHousekeeping(t *testing.T) {
	type File struct {
		Name  string
		IsDir bool
		Age   time.Duration
	}
	type Expectation struct {
		Error string
		Files []string
	}
	tests := []struct {
		Name        string
		Files       []File
		Expectation Expectation
	}{
		{
			Name: "empty store",
		},
		{
			Name: "with state file",
			Files: []File{
				{Name: "foo.workspace.json", IsDir: false},
				{Name: "foo", IsDir: true},
			},
			Expectation: Expectation{
				Files: []string{"foo", "foo.workspace.json"},
			},
		},
		{
			Name: "no state file",
			Files: []File{
				{Name: "foo", IsDir: true, Age: 4 * time.Hour},
				{Name: "foo-daemon", IsDir: true, Age: 4 * time.Hour},
			},
		},
		{
			Name: "daemon dir with state file",
			Files: []File{
				{Name: "foo.workspace.json", IsDir: false},
				{Name: "foo-daemon", IsDir: true},
			},
			Expectation: Expectation{
				Files: []string{"foo-daemon", "foo.workspace.json"},
			},
		},
		{
			Name: "daemon dir no state file",
			Files: []File{
				{Name: "foo-daemon", IsDir: true, Age: 4 * time.Hour},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			store, err := getTestStore()
			if err != nil {
				t.Fatal(err)
			}

			for _, f := range test.Files {
				loc := filepath.Join(store.Location, f.Name)
				var err error
				if f.IsDir {
					err = os.MkdirAll(loc, 0644)
				} else {
					err = ioutil.WriteFile(loc, nil, 0644)
				}
				if err != nil {
					t.Fatalf("cannot prepare file %s: %v", f.Name, err)
				}
				if f.Age > 0 {
					modtime := time.Now().Add(-f.Age)
					err = os.Chtimes(loc, modtime, modtime)
				}
				if err != nil {
					t.Fatalf("cannot prepare file %s: %v", f.Name, err)
				}
			}

			errs := store.doHousekeeping(context.Background())
			var act Expectation
			for _, err := range errs {
				if act.Error != "" {
					act.Error += "; "
				}
				act.Error = err.Error()
			}
			res, err := ioutil.ReadDir(store.Location)
			if err != nil {
				t.Fatal(err)
			}
			for _, f := range res {
				act.Files = append(act.Files, f.Name())
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected doHousekeeping result (-want +got):\n%s", diff)
			}
		})
	}
}
