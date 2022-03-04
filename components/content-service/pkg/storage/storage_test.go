// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"errors"
	"testing"

	"golang.org/x/xerrors"
)

func TestBlobObjectName(t *testing.T) {
	tests := []struct {
		Name             string
		Input            string
		ExpectedBlobName string
		ExpectedError    error
	}{
		{
			Name:             "simple name",
			Input:            "my-simple-name",
			ExpectedBlobName: "blobs/my-simple-name",
		},
		{
			Name:             "name with slash",
			Input:            "my-object-name/with-slash",
			ExpectedBlobName: "blobs/my-object-name/with-slash",
		},
		{
			Name:          "name with whitespace",
			Input:         "name with whitespace",
			ExpectedError: invalidNameError("name with whitespace"),
		},
		{
			Name:          "name with invalid char",
			Input:         "ä-is-invalid",
			ExpectedError: invalidNameError("ä-is-invalid"),
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			actualBlobName, err := blobObjectName(test.Input)
			if actualBlobName != test.ExpectedBlobName {
				t.Fatalf("unexpected object name: is '%s' but expected '%s'", actualBlobName, test.ExpectedBlobName)
			}
			if !equivalentError(err, test.ExpectedError) {
				t.Fatalf("unexpected error: is '%v' but expected '%v'", err, test.ExpectedError)
			}
		})
	}
}

func invalidNameError(name string) error {
	return xerrors.Errorf(`blob name '%s' needs to match regex '^[a-zA-Z0-9._\-\/]+$'`, name)
}

func equivalentError(e1 error, e2 error) bool {
	if e1 == e2 {
		return true
	}
	if errors.Is(e1, e2) {
		return true
	}
	if e1 == nil || e2 == nil {
		return false
	}
	if e1.Error() == e2.Error() {
		return true
	}
	return false
}
