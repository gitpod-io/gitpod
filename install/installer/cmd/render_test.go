// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"flag"
	"io/ioutil"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

var (
	update = flag.Bool("update", false, "update the golden files of this test")
)

func init() {
	// Ensure that the randomisation always returns the same values
	rootOpts.SeedValue = 42
}

func TestMain(m *testing.M) {
	flag.Parse()
	os.Exit(m.Run())
}

func TestRender(t *testing.T) {
	dir, err := ioutil.ReadDir("testdata/render")
	require.NoError(t, err)

	var testCases []struct {
		Name string
	}

	for _, d := range dir {
		if d.IsDir() {
			testCases = append(testCases, struct{ Name string }{
				Name: d.Name(),
			})
		}
	}

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {

			// reset seed for each test case
			setSeed()

			rootOpts.VersionMF = "testdata/render/versions.yaml"
			renderOpts.ConfigFN = "testdata/render/" + testCase.Name + "/config.yaml"
			goldenPath := "testdata/render/" + testCase.Name + "/output.golden"

			// Enable experimental config
			renderOpts.UseExperimentalConfig = true

			// Generate the YAML from the render function
			yaml, err := renderFn()
			require.NoError(t, err)

			// Concatenate the []strings with a newline between
			got := ""
			for _, item := range yaml {
				got += item + "\n"
			}

			if *update {
				err := os.WriteFile(goldenPath, []byte(got), 0600)
				require.NoError(t, err)
				return
			}

			// Get the expected output from the golden file
			f, err := os.OpenFile(goldenPath, os.O_RDWR, 0644)
			defer f.Close()
			require.NoError(t, err)

			content, err := ioutil.ReadAll(f)
			if err != nil {
				require.NoError(t, err)
			}

			// Compare
			if diff := cmp.Diff(string(content), got); diff != "" {
				t.Errorf("non-matching golden file %s (-want +got):\n%s", testCase.Name, diff)
			}
		})
	}
}
