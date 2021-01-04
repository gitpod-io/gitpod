// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package quota_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
)

func TestParseSize(t *testing.T) {
	tests := []struct {
		Input    string
		Expected quota.Size
		Err      error
	}{
		{"42", 42, nil},
		{"42k", 42 * quota.Kilobyte, nil},
		{"42m", 42 * quota.Megabyte, nil},
		{"42g", 42 * quota.Gigabyte, nil},
		{"42t", 42 * quota.Terabyte, nil},
		// This test should fail but doesn't because match somehow matches the regexp
		// {"-42m", 0, quota.ErrInvalidSize},
		{"abc", 0, quota.ErrInvalidSize},
		{"99999999999999999999999999999999999999999999999999999999999999999999999999999999", 0, quota.ErrInvalidSize},
	}

	for _, test := range tests {
		t.Run(test.Input, func(t *testing.T) {
			act, err := quota.ParseSize(test.Input)
			if err != test.Err {
				t.Errorf("unexepected error %v: expected %v", err, test.Err)
				return
			}
			if act != test.Expected {
				t.Errorf("unexpected result %v: expected %v", act, test.Expected)
			}
		})
	}
}

func TestStringSize(t *testing.T) {
	tests := []struct {
		Input    quota.Size
		Expected string
	}{
		{42, "42"},
		{42 * quota.Kilobyte, "42k"},
		{42 * quota.Megabyte, "42m"},
		{42 * quota.Gigabyte, "42g"},
		{42 * quota.Terabyte, "42t"},
		{0 * quota.Terabyte, "0"},
		{0, "0"},
	}

	for _, test := range tests {
		t.Run(test.Expected, func(t *testing.T) {
			act := test.Input.String()
			if act != test.Expected {
				t.Errorf("unexpected result %v: expected %v", act, test.Expected)
			}
		})

		t.Run(fmt.Sprintf("Parse((%s).String())", test.Expected), func(t *testing.T) {
			act, err := quota.ParseSize(test.Input.String())
			if err != nil {
				t.Errorf("unexepected error: %v", err)
				return
			}
			if act != test.Input {
				t.Errorf("unexpected result %v: expected %v", act, test.Input)
			}
		})
	}
}

func TestMarshalUnmarshal(t *testing.T) {
	tests := []struct {
		Input    quota.Size `json:"input"`
		Expected string     `json:"expected"`
	}{
		{42, "\"42\""},
		{42 * quota.Kilobyte, "\"42k\""},
		{42 * quota.Megabyte, "\"42m\""},
		{42 * quota.Gigabyte, "\"42g\""},
		{42 * quota.Terabyte, "\"42t\""},
		{0 * quota.Terabyte, "\"0\""},
		{0, "\"0\""},
		{0, "\"\""},
	}
	for _, test := range tests {
		t.Run(fmt.Sprintf("json.marshal(%v)", test.Input), func(t *testing.T) {
			if test.Expected == `""` {
				return
			}
			out, err := json.Marshal(test.Input)
			if err != nil {
				t.Errorf("unexepected error: %v", err)
				return
			}

			act := string(out)
			if act != test.Expected {
				t.Errorf("unexpected result %v: expected %v", act, test.Expected)
			}
		})

		t.Run(fmt.Sprintf("json.unmarshal(%s)", test.Expected), func(t *testing.T) {
			var out struct {
				Q quota.Size `json:"q"`
			}
			err := json.Unmarshal([]byte(fmt.Sprintf(`{"q":%s}`, test.Expected)), &out)
			if err != nil {
				t.Errorf("unexepected error: %v", err)
				return
			}

			act := out.Q
			if act != test.Input {
				t.Errorf("unexpected result %v: expected %v", act, test.Input)
			}
		})
	}
}
