// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"math/rand"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestValue(t *testing.T) {
	tests := []struct {
		Name        string
		Value       string
		Expectation string
	}{
		{Name: "empty string"},
		{Name: "email", Value: "foo@bar.com", Expectation: "[redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email]"},
		{Name: "email in text", Value: "The email is foo@bar.com or bar@foo.com", Expectation: "The email is [redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email] or [redacted:md5:dc8a42aba3651b0b1f088ef928ff3b1d:email]"},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := Default.Value(test.Value)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Value() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestKeyValue(t *testing.T) {
	const testValue = "testvalue"
	tests := []struct {
		Key         string
		Expectation string
	}{
		{Key: "email", Expectation: "[redacted:md5:e9de89b0a5e9ad6efd5e5ab543ec617c]"},
		{Key: "token", Expectation: "[redacted]"},
	}

	for _, test := range tests {
		t.Run(test.Key, func(t *testing.T) {
			act := Default.KeyValue(test.Key, testValue)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("KeyValue() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func BenchmarkKeyValue(b *testing.B) {
	key := HashedFieldNames[rand.Intn(len(HashedFieldNames))]

	for i := 0; i < b.N; i++ {
		Default.KeyValue(key, "value")
	}
}

func BenchmarkValue(b *testing.B) {
	const input = "This text contains {\"json\":\"data\"}, a workspace ID gitpodio-gitpod-uesaddev73c and an email foo@bar.com"

	for i := 0; i < b.N; i++ {
		Default.Value(input)
	}
}
