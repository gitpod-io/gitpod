// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package bastion

import (
	"errors"
	"testing"
)

func TestSummarrizeErrors(t *testing.T) {
	type testCase struct {
		label    string
		errs     []error
		expected error
	}

	tests := []testCase{
		{
			label:    "no errors",
			errs:     nil,
			expected: nil,
		},
		{
			label:    "1 error",
			errs:     []error{errors.New("one")},
			expected: errors.New("one"),
		},
		{
			label:    "2 error",
			errs:     []error{errors.New("one"), errors.New("two")},
			expected: errors.New("multiple errors: one, two"),
		},
		{
			label:    "3 error",
			errs:     []error{errors.New("one"), errors.New("two"), errors.New("three")},
			expected: errors.New("multiple errors: one, two, three"),
		},
	}

	for _, tc := range tests {
		t.Run(tc.label, func(t *testing.T) {
			actual := summarizeErrors(tc.errs)
			if tc.expected == nil || actual == nil {
				if actual != tc.expected {
					t.Errorf("expected: %v, intead got: %v", tc.expected, actual)
				}
				return
			}
			if actual.Error() != tc.expected.Error() {
				t.Errorf("expected: %v, intead got: %v", tc.expected, actual)
			}
		})
	}

}
