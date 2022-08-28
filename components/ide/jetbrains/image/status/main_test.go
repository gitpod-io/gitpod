// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"strings"
	"testing"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"
)

func TestGetProductConfig(t *testing.T) {
	expectation := &protocol.JetbrainsProduct{}
	actual := getProductConfig(&protocol.GitpodConfig{
		Jetbrains: &protocol.Jetbrains{
			Intellij: expectation,
		},
	}, "intellij")

	if diff := cmp.Diff(expectation, actual); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}
}

func TestParseGitpodConfig(t *testing.T) {
	gitpodConfig, _ := parseGitpodConfig("testdata")
	assert.Equal(t, 1, len(gitpodConfig.Jetbrains.Intellij.Plugins))
	assert.Equal(t, "both", gitpodConfig.Jetbrains.Intellij.Prebuilds.Version)
	assert.Equal(t, "-Xmx3g", gitpodConfig.Jetbrains.Intellij.Vmoptions)
	assert.Equal(t, "-Xmx4096m -XX:MaxRAMPercentage=75", gitpodConfig.Jetbrains.Goland.Vmoptions)
}

func TestUpdateVMOptions(t *testing.T) {
	tests := []struct {
		Desc        string
		Alias       string
		EnvVar      map[string]string
		Src         string
		Expectation string
	}{
		{"goland64.vmoptions", "goland", nil, "-Xms128m\n-Xmx750m\n-Dsun.tools.attach.tmp.only=true", "-Xms128m\n-Xmx750m\n-Dsun.tools.attach.tmp.only=true\n-Dgtw.disable.exit.dialog=true"},
		{"idea64.vmoptions", "intellij", nil, "-Xms128m\n-Xmx750m\n-Dsun.tools.attach.tmp.only=true", "-Xms128m\n-Xmx750m\n-Dsun.tools.attach.tmp.only=true\n-Dgtw.disable.exit.dialog=true"},
		{"idea64.vmoptions (INTELLIJ_VMOPTIONS env set)", "intellij", map[string]string{"INTELLIJ_VMOPTIONS": "-Xmx2048m"}, "-Xms128m\n-Xmx750m\n-Dsun.tools.attach.tmp.only=true", "-Xms128m\n-Xmx2048m\n-Dsun.tools.attach.tmp.only=true\n-Dgtw.disable.exit.dialog=true"},
		{"idea64.vmoptions (INTELLIJ_VMOPTIONS env set)", "intellij", map[string]string{"INTELLIJ_VMOPTIONS": "-Xmx4096m"}, "-Xms128m\n-Xmx2g\n-Dsun.tools.attach.tmp.only=true", "-Xms128m\n-Xmx4096m\n-Dsun.tools.attach.tmp.only=true\n-Dgtw.disable.exit.dialog=true"},
		{"idea64.vmoptions (INTELLIJ_VMOPTIONS env set)", "intellij", map[string]string{"INTELLIJ_VMOPTIONS": "-Xmx4096m -XX:MaxRAMPercentage=75"}, "-Xms128m\n-Xmx2g\n-Dsun.tools.attach.tmp.only=true", "-Xms128m\n-Xmx4096m\n-XX:MaxRAMPercentage=75\n-Dsun.tools.attach.tmp.only=true\n-Dgtw.disable.exit.dialog=true"},
		{"goland64.vmoptions (GOLAND_VMOPTIONS env set with conflicting options)", "goland", map[string]string{"GOLAND_VMOPTIONS": "-ea -XX:+IgnoreUnrecognizedVMOptions -XX:MaxRAMPercentage=75 -XX:MaxRAMPercentage=50"}, "-Xms128m\n-Xmx2g\n-Dsun.tools.attach.tmp.only=true", "-Xms128m\n-Xmx2g\n-Dsun.tools.attach.tmp.only=true\n-Dgtw.disable.exit.dialog=true\n-ea\n-XX:+IgnoreUnrecognizedVMOptions\n-XX:MaxRAMPercentage=50"},
	}
	for _, test := range tests {
		for v := range test.EnvVar {
			t.Setenv(v, test.EnvVar[v])
		}
		// compare vmoptions string content equality (i.e. split into slices and compare ignore order)
		lessFunc := func(a, b string) bool { return a < b }

		t.Run(test.Desc, func(t *testing.T) {
			actual := updateVMOptions(nil, test.Alias, strings.Fields(test.Src))
			if diff := cmp.Diff(strings.Fields(test.Expectation), actual, cmpopts.SortSlices(lessFunc)); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})

		t.Run("updateVMOptions multiple time should be stable", func(t *testing.T) {
			actual := strings.Fields(test.Src)
			for i := 0; i < 5; i++ {
				actual = updateVMOptions(nil, test.Alias, actual)
				if diff := cmp.Diff(strings.Fields(test.Expectation), actual, cmpopts.SortSlices(lessFunc)); diff != "" {
					t.Errorf("unexpected output (-want +got):\n%s", diff)
				}
			}
		})
	}
}
