// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/go-test/deep"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"sigs.k8s.io/yaml"
)

func TestMain(m *testing.M) {
	// Set to highest logging level to keep console clean
	log.Log.Logger.SetLevel(logrus.PanicLevel)

	os.Exit(m.Run())
}

type envvarTestData struct {
	Envvars map[string]string `json:"envvars"`
}

func TestBuildFromEnvvars(t *testing.T) {
	baseDir := "testdata/envvars"

	dir, err := ioutil.ReadDir(baseDir)
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
			cfg, version, err := config.Load("", true)
			require.NoError(t, err)

			apiVersion, err := config.LoadConfigVersion(version)
			require.NoError(t, err)

			testPath := filepath.Join(baseDir, testCase.Name)
			envvarsFile := filepath.Join(testPath, "envvars.yaml")
			expectFile := filepath.Join(testPath, "expect.yaml")

			// Load the envvars
			envF, err := os.OpenFile(envvarsFile, os.O_RDONLY, 0644)
			defer envF.Close()
			require.NoError(t, err)

			envContent, err := ioutil.ReadAll(envF)
			require.NoError(t, err)

			var env envvarTestData
			err = yaml.Unmarshal(envContent, &env)
			require.NoError(t, err)

			// Load the expected output
			expectF, err := os.OpenFile(expectFile, os.O_RDONLY, 0644)
			defer expectF.Close()
			require.NoError(t, err)

			expectContent, err := ioutil.ReadAll(expectF)
			require.NoError(t, err)

			for k, v := range env.Envvars {
				t.Setenv(k, v)
			}

			err = apiVersion.BuildFromEnvvars(cfg)
			require.NoError(t, err)

			expect, _, err := config.Load(string(expectContent), true)
			require.NoError(t, err)

			if diff := deep.Equal(cfg, expect); diff != nil {
				t.Error(diff)
			}
		})
	}
}
