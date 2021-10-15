// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

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
			class, err := classifier.NewCommandlineClassifier("test", test.AllowList, test.BlockList)
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
