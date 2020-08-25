// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"testing"
)

func TestDiff(t *testing.T) {
	type test struct {
		current   []int
		updated   []int
		additions []int
		removals  []int
	}

	tt := []test{
		{
			current:   []int{1, 2, 3, 4},
			updated:   []int{1, 4, 5, 6},
			additions: []int{5, 6},
			removals:  []int{2, 3},
		},
		{
			current:   []int{},
			updated:   []int{},
			additions: []int{},
			removals:  []int{},
		},
		{
			current:   []int{},
			updated:   []int{5},
			additions: []int{5},
			removals:  []int{},
		},
		{
			current:   []int{5},
			updated:   []int{},
			additions: []int{},
			removals:  []int{5},
		},
		{
			current:   []int{3, 4},
			updated:   []int{1, 2, 3, 4},
			additions: []int{1, 2},
			removals:  []int{},
		},
		{
			current:   []int{5, 6},
			updated:   []int{8, 9},
			additions: []int{8, 9},
			removals:  []int{5, 6},
		},
		{
			current:   []int{1, 2, 3, 4},
			updated:   []int{1, 2, 3, 4},
			additions: []int{},
			removals:  []int{},
		},
	}

	for _, test := range tt {
		removals, additions := diff(test.current, test.updated)
		expect(t, "additions", additions, test.additions)
		expect(t, "removals", removals, test.removals)
	}
}

func expect(t *testing.T, desc string, actual, expected []int) {
	if len(actual) != len(expected) {
		t.Fatalf("%s: expected arrays to be equal but got: %v (actual) vs. %v (expected)", desc, actual, expected)
	}

	for i := 0; i < len(expected); i++ {
		a := actual[i]
		e := expected[i]
		if a != e {
			t.Fatalf("%s: expected arrays to be equal but got: %v (actual) vs. %v (expected)", desc, actual, expected)
		}
	}
}
