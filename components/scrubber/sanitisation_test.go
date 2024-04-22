// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestSanitiser(t *testing.T) {
	tests := []struct {
		Name        string
		Func        Sanitisatiser
		Opts        []SanitiserOption
		Expectation string
		Input       string
	}{
		{Func: SanitiseRedact, Name: "redact empty string", Expectation: "[redacted]"},
		{Func: SanitiseRedact, Name: "redact sensitive string", Input: "foo@bar.com", Expectation: "[redacted]"},
		{Func: SanitiseRedact, Name: "redact key name", Opts: []SanitiserOption{SanitiseWithKeyName("foo")}, Input: "foo@bar.com", Expectation: "[redacted:foo]"},
		{Func: SanitiseHash, Name: "hash empty string", Expectation: "[redacted:md5:d41d8cd98f00b204e9800998ecf8427e]"},
		{Func: SanitiseHash, Name: "hash sensitive string", Input: "foo@bar.com", Expectation: "[redacted:md5:f3ada405ce890b6f8204094deb12d8a8]"},
		{Func: SanitiseHash, Name: "hash key name", Opts: []SanitiserOption{SanitiseWithKeyName("foo")}, Input: "foo@bar.com", Expectation: "[redacted:md5:f3ada405ce890b6f8204094deb12d8a8:foo]"},
		{Func: SanitiseHashURLPathSegments, Name: "hash contextURL", Input: "https://github.com/gitpod-io/gitpod/pull/19402", Expectation: "[redacted:md5:3097fca9b1ec8942c4305e550ef1b50a]/[redacted:md5:308cb0f82b8a4966a32f7c360315c160]/[redacted:md5:5bc8d0354fba47db774b70d2a9161bbb]/pull/19402"},
		{Func: SanitiseHashURLPathSegments, Name: "hash contextURL with query", Input: "https://github.com/gitpod-io/gitpod/pull/19402?foo=bar&foo=baz", Expectation: "[redacted:md5:3097fca9b1ec8942c4305e550ef1b50a]/[redacted:md5:308cb0f82b8a4966a32f7c360315c160]/[redacted:md5:5bc8d0354fba47db774b70d2a9161bbb]/pull/19402?[redacted:md5:d76c5fb536a9f4866aed3c0d7a0d0f76]"},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := test.Func(test.Input, test.Opts...)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("act: %s", act)
				t.Errorf("sanitiser mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
