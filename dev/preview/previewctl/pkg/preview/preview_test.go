// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package preview_test

import (
	"fmt"
	"log"
	"testing"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func TestInstallContext(t *testing.T) {
	fmt.Println("Test not implemented")
}

func TestGetPreviewName(t *testing.T) {
	testCases := []struct {
		testName       string
		branch         string
		expectedResult string
	}{
		{
			testName:       "Short branch without special characters",
			branch:         "/refs/heads/testing",
			expectedResult: "testing",
		},
		{
			testName:       "Upper to lower case",
			branch:         "/refs/heads/SCREAMMING",
			expectedResult: "screamming",
		},
		{
			testName:       "Special characters",
			branch:         "/refs/heads/as/test&123.4",
			expectedResult: "as-test-123-4",
		},
		{
			testName:       "Hashed long branch",
			branch:         "/refs/heads/this-is-a-long-branch-that-should-be-replaced-with-a-hash",
			expectedResult: "this-is-a-a868caa3c3",
		},
	}

	for _, tc := range testCases {
		previewName, err := preview.GetName(tc.branch)
		if err != nil {
			t.Fatal(err)
		}

		if tc.expectedResult != previewName {
			log.Fatalf("Test '%s' failed. Expected '%s' but got '%s'", tc.testName, tc.expectedResult, previewName)
		}
	}
}

func TestListAllPreviews(t *testing.T) {
	fmt.Println("Test not implemented")
}
