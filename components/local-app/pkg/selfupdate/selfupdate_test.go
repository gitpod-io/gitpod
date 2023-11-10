// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package selfupdate

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Masterminds/semver/v3"
	"github.com/google/go-cmp/cmp"
	"github.com/opencontainers/go-digest"
)

func TestGenerateManifest(t *testing.T) {
	type Expectation struct {
		Error    string
		Manifest *Manifest
	}
	tests := []struct {
		Name           string
		Expectation    Expectation
		Files          []string
		FilenameParser FilenameParserFunc
	}{
		{
			Name: "happy path",
			Expectation: Expectation{
				Manifest: &Manifest{
					Version: semver.MustParse("v1.0"),
					Binaries: []Binary{
						{
							Filename: "gitpod-linux-amd64",
							OS:       "linux",
							Arch:     "amd64",
							Digest:   "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
						},
					},
				},
			},
			Files: []string{
				"gitpod-linux-amd64",
				"nonsense",
			},
			FilenameParser: DefaultFilenameParser,
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

			loc, err := os.MkdirTemp("", "selfupdate")
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				os.RemoveAll(loc)
			})
			for _, f := range test.Files {
				err = os.WriteFile(filepath.Join(loc, f), []byte("test"), 0644)
				if err != nil {
					t.Fatal(err)
				}
			}

			res, err := GenerateManifest(semver.MustParse("v1.0"), loc, test.FilenameParser)
			if err != nil {
				act.Error = err.Error()
			}
			act.Manifest = res

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("GenerateManifest() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestReplaceSelf(t *testing.T) {
	type File struct {
		OS       string
		Arch     string
		Filename string
		Content  []byte
	}
	type Expectation struct {
		Error string
	}
	tests := []struct {
		Name        string
		Expectation Expectation
		Files       []File
	}{
		{
			Name: "happy path",
			Files: []File{
				{
					OS:       runtime.GOOS,
					Arch:     runtime.GOARCH,
					Filename: "gitpod-" + runtime.GOOS + "-" + runtime.GOARCH,
					Content:  []byte("#!/bin/sh"),
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var mf Manifest
			mf.Version = semver.MustParse("v1.0")
			for _, f := range test.Files {
				mf.Binaries = append(mf.Binaries, Binary{
					OS:       f.OS,
					Arch:     f.Arch,
					Filename: f.Filename,
					Digest:   digest.FromBytes(f.Content),
				})
			}

			mux := http.NewServeMux()
			mux.Handle("/manifest.json", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(mf)
			}))
			for _, f := range test.Files {
				mux.Handle("/"+f.Filename, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					_, _ = w.Write(f.Content)
				}))
			}
			srv := httptest.NewServer(mux)
			t.Cleanup(func() { srv.Close() })

			dlmf, err := DownloadManifest(context.Background(), srv.URL)
			if err != nil {
				t.Fatal(err)
			}

			var act Expectation

			err = ReplaceSelf(context.Background(), dlmf)
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("ReplaceSelf() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
