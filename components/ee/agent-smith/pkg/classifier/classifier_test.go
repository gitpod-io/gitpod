// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package classifier_test

import (
	"testing"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/google/go-cmp/cmp"
)

func TestCommandlineClassifier(t *testing.T) {
	var (
		allowed = []string{"allowed"}
		blocked = []string{"blocked"}
	)

	type Input struct {
		Executable string
		Cmdline    []string
	}
	tests := []struct {
		Name        string
		AllowList   []string
		BlockList   []string
		Input       Input
		Expectation *classifier.Classification
	}{
		{
			Name:        "empty lists",
			Expectation: &classifier.Classification{Level: classifier.LevelNoMatch, Classifier: classifier.ClassifierCommandline},
		},
		{
			Name:        "blocked cmd positive",
			BlockList:   blocked,
			Input:       Input{Cmdline: blocked},
			Expectation: &classifier.Classification{Level: classifier.LevelAudit, Classifier: classifier.ClassifierCommandline, Message: `matched "blocked"`},
		},
		{
			Name:        "blocked exec positive",
			BlockList:   blocked,
			Input:       Input{Executable: "./" + blocked[0]},
			Expectation: &classifier.Classification{Level: classifier.LevelAudit, Classifier: classifier.ClassifierCommandline, Message: `matched "blocked"`},
		},
		{
			Name:        "blocked negative",
			BlockList:   blocked,
			Input:       Input{Cmdline: allowed},
			Expectation: &classifier.Classification{Level: classifier.LevelNoMatch, Classifier: classifier.ClassifierCommandline},
		},
		{
			Name:        "alowed positive",
			AllowList:   allowed,
			BlockList:   blocked,
			Input:       Input{Cmdline: []string{allowed[0], blocked[0]}},
			Expectation: &classifier.Classification{Level: classifier.LevelNoMatch, Classifier: classifier.ClassifierCommandline},
		},
		{
			Name:        "alowed cmd positive",
			AllowList:   allowed,
			BlockList:   blocked,
			Input:       Input{Executable: allowed[0] + "/" + blocked[0]},
			Expectation: &classifier.Classification{Level: classifier.LevelNoMatch, Classifier: classifier.ClassifierCommandline},
		},
		{
			Name:        "alowed negative",
			AllowList:   blocked,
			BlockList:   blocked,
			Input:       Input{Cmdline: []string{allowed[0], blocked[0]}},
			Expectation: &classifier.Classification{Level: classifier.LevelNoMatch, Classifier: classifier.ClassifierCommandline},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			class, err := classifier.NewCommandlineClassifier("test", classifier.LevelAudit, test.AllowList, test.BlockList)
			if err != nil {
				t.Fatal(err)
			}

			act, err := class.Matches(test.Input.Executable, test.Input.Cmdline)
			if err != nil {
				t.Error(err)
				return
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected CommandlineClassifier (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCountingMetricsClassifierFilesystemInterface(t *testing.T) {
	// Create a signature classifier with filesystem signatures
	signatures := []*classifier.Signature{
		{
			Name:     "test-filesystem",
			Domain:   classifier.DomainFileSystem,
			Pattern:  []byte("malware"),
			Filename: []string{"malware.exe"},
		},
	}

	sigClassifier := classifier.NewSignatureMatchClassifier("test", classifier.LevelAudit, signatures)
	countingClassifier := classifier.NewCountingMetricsClassifier("counting", sigClassifier)

	// Test that CountingMetricsClassifier implements FileClassifier
	var fsc classifier.FileClassifier = countingClassifier

	// Test filesystem file matching (file doesn't exist, should return no match without error)
	result, err := fsc.MatchesFile("/nonexistent/path/malware.exe")
	if err != nil {
		t.Fatalf("MatchesFile failed: %v", err)
	}

	// Should return no match since file doesn't exist, but no error
	if result.Level != classifier.LevelNoMatch {
		t.Errorf("Expected LevelNoMatch for nonexistent file, got %v", result.Level)
	}

	// Test that the interface delegation works by checking that it doesn't panic
	// and returns a valid Classification
	if result == nil {
		t.Error("Expected non-nil Classification result")
	}
}
