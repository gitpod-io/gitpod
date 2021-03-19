// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/google/go-cmp/cmp"
)

func TestMarkWorkspace(t *testing.T) {
	tests := []struct {
		Description    string
		InitialState   map[string]string
		Operations     []*annotation
		ExpectedResult map[string]string
		ExpectedErr    string
	}{
		{"add mark", nil, []*annotation{addMark("foobar", "val")}, map[string]string{"foobar": "val"}, ""},
		{"remove mark", map[string]string{"foobar": "val"}, []*annotation{deleteMark("foobar")}, nil, ""},
		{"add/remove mark", nil, []*annotation{addMark("foobar", "val"), deleteMark("foobar")}, nil, ""},
	}

	for _, test := range tests {
		t.Run(test.Description, func(t *testing.T) {
			manager := forTestingOnlyGetManager(t)
			startCtx, err := forTestingOnlyCreateStartWorkspaceContext(manager, "foo", api.WorkspaceType_REGULAR)
			if err != nil {
				t.Errorf("cannot create test pod start context; this is a bug in the unit test itself: %v", err)
				return
			}

			pod, err := manager.createDefiniteWorkspacePod(startCtx)
			if err != nil {
				t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return
			}
			modificationPrior := make(map[string]string)
			for k, v := range pod.Annotations {
				modificationPrior[k] = v
			}
			for k, v := range test.InitialState {
				pod.Annotations[k] = v
			}

			err = manager.Clientset.Create(context.Background(), pod)
			if err != nil {
				t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return
			}

			err = manager.markWorkspace(context.Background(), startCtx.Request.Id, test.Operations...)
			if err != nil && err.Error() != test.ExpectedErr {
				t.Errorf("markWorkspace failed: %v", err)
				return
			}

			pod, _ = manager.findWorkspacePod(context.Background(), startCtx.Request.Id)
			modificationPosterior := make(map[string]string)
			for k, v := range pod.Annotations {
				if _, wasThereAlready := modificationPrior[k]; !wasThereAlready {
					modificationPosterior[k] = v
				}
			}

			for k, v := range test.ExpectedResult {
				postVal, exists := modificationPosterior[k]
				if !exists {
					t.Errorf("annotation %s was not found post modification", k)
					return
				}
				if postVal != v {
					t.Errorf("annotation value for %s does not match: expected %s, actual %s", k, v, postVal)
					return
				}
			}
			if len(modificationPosterior) != len(test.ExpectedResult) {
				t.Errorf("annotations do not match expectation: %v != %v", test.ExpectedResult, modificationPosterior)
			}
		})
	}
}

func TestModifyFinalizer(t *testing.T) {
	finalizer := "gitpod.io/finalizer"
	tests := []struct {
		Description string
		InitialSet  []string
		Finalizer   string
		Add         bool
		ExpectedSet []string
		ExpectedErr string
	}{
		{"add finalizer", nil, finalizer, true, []string{finalizer}, ""},
		{"add finalizer noop", []string{finalizer}, finalizer, true, []string{finalizer}, ""},
		{"remove finalizer", []string{finalizer}, finalizer, false, nil, ""},
		{"remove finalizer noop", []string{}, finalizer, false, nil, ""},
	}

	for _, test := range tests {
		t.Run(test.Description, func(t *testing.T) {
			manager := forTestingOnlyGetManager(t)
			startCtx, err := forTestingOnlyCreateStartWorkspaceContext(manager, "foo", api.WorkspaceType_REGULAR)
			if err != nil {
				t.Errorf("cannot create test pod start context; this is a bug in the unit test itself: %v", err)
				return
			}

			pod, err := manager.createDefiniteWorkspacePod(startCtx)
			if err != nil {
				t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return
			}
			pod.Finalizers = test.InitialSet

			err = manager.Clientset.Create(context.Background(), pod)
			if err != nil {
				t.Errorf("cannot create test pod; this is a bug in the unit test itself: %v", err)
				return
			}

			err = manager.modifyFinalizer(context.Background(), startCtx.Request.Id, test.Finalizer, test.Add)
			if err != nil && err.Error() != test.ExpectedErr {
				t.Errorf("modifyFinalizer failed: %v", err)
				return
			}

			pod, _ = manager.findWorkspacePod(context.Background(), startCtx.Request.Id)

			if diff := cmp.Diff(pod.Finalizers, test.ExpectedSet); diff != "" {
				t.Errorf("unexpected blob hash (-want +got):\n%s", diff)
			}
		})
	}
}
