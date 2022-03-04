// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package testing

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/go-test/deep"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

var update = flag.Bool("update", false, "update .golden files")
var force = flag.Bool("force", false, "overwrite .golden files even if they already exist")

// FixtureTest is a test that is based on fixture and golden files. This is very convenient to test a largely variable surface with many variants.
type FixtureTest struct {
	T        *testing.T
	Path     string
	GoldPath func(path string) string
	Test     FixtureTestFunc
	Fixture  func() interface{}
	Gold     func() interface{}
}

// FixtureTestFunc implements the actual fixture test
type FixtureTestFunc func(t *testing.T, fixture interface{}) interface{}

// Run executes the fixture test - do not forget to call this one
func (ft *FixtureTest) Run() {
	t := ft.T

	fixtures, err := filepath.Glob(ft.Path)
	if err != nil {
		t.Error("cannot list test fixtures: ", err)
		return
	}

	for _, fn := range fixtures {
		t.Run(fn, func(t *testing.T) {
			fd, err := os.ReadFile(fn)
			if err != nil {
				t.Errorf("cannot read %s: %v", fn, err)
				return
			}

			fixture := ft.Fixture()
			if typ := reflect.TypeOf(fixture); typ.Kind() != reflect.Ptr {
				t.Error("Fixture() did not return a pointer")
				return
			}
			if msg, ok := fixture.(proto.Message); ok {
				err = protojson.Unmarshal(fd, msg)
				if err != nil {
					t.Errorf("cannot unmarshal %s: %v", fn, err)
					return
				}
			} else {
				err = json.Unmarshal(fd, fixture)
				if err != nil {
					t.Errorf("cannot unmarshal %s: %v", fn, err)
					return
				}
			}

			result := ft.Test(t, fixture)
			if result == nil {
				// Test routine is expected to complain using t.Errorf
				t.Logf("test routine for %s returned nil - continuing", fn)
				return
			}
			if typ := reflect.TypeOf(result); typ.Kind() != reflect.Ptr {
				t.Error("Test() did not return a pointer")
				return
			}

			actual, err := json.MarshalIndent(result, "", "    ")
			if err != nil {
				t.Errorf("cannot marshal status for %s: %v", fn, err)
				return
			}

			goldenFilePath := fmt.Sprintf("%s.golden", strings.TrimSuffix(fn, filepath.Ext(fn)))
			if ft.GoldPath != nil {
				goldenFilePath = ft.GoldPath(fn)
			}
			if *update {
				if _, err := os.Stat(goldenFilePath); *force || os.IsNotExist(err) {
					err = os.WriteFile(goldenFilePath, actual, 0600)
					if err != nil {
						t.Errorf("cannot write gold standard %s: %v", goldenFilePath, err)
						return
					}

					t.Logf("Wrote new gold standard in %s", goldenFilePath)
				} else {
					t.Logf("Did not overwrite gold standard in %s", goldenFilePath)
				}
			}

			expected, err := os.ReadFile(goldenFilePath)
			if err != nil {
				t.Errorf("cannot read golden file %s: %v", goldenFilePath, err)
				return
			}

			if !bytes.Equal(actual, expected) {
				expectedResult := ft.Gold()
				if typ := reflect.TypeOf(expectedResult); typ.Kind() != reflect.Ptr {
					t.Error("Gold() did not return a pointer")
					return
				}

				err = json.Unmarshal(expected, expectedResult)
				if err != nil {
					t.Errorf("cannot unmarshal JSON %s: %v", goldenFilePath, err)
					return
				}

				diff := deep.Equal(expectedResult, result)

				t.Errorf("fixture %s: %v", fn, diff)
				return
			}
		})
	}
}
