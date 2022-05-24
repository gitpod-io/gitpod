// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestVarcharTime_Scan(t *testing.T) {
	for _, scenario := range []struct {
		Name string

		Input    interface{}
		Expected time.Time
		Error    bool
	}{
		{
			Name:  "nil value errors",
			Input: nil,
			Error: true,
		},
		{
			Name:  "empty uint8 slice errors",
			Input: []uint8{},
			Error: true,
		},
		{
			Name:  "fails with string",
			Input: "2019-05-10T09:54:28.185Z",
			Error: true,
		},
		{
			Name:     "parses valid ISO 8601 from TypeScript",
			Input:    []uint8("2019-05-10T09:54:28.185Z"),
			Expected: time.Date(2019, 05, 10, 9, 54, 28, 185000000, time.UTC),
		},
	} {
		t.Run(scenario.Name, func(t *testing.T) {
			var vt VarcharTime
			err := vt.Scan(scenario.Input)
			if scenario.Error {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, scenario.Expected, time.Time(vt))
			}
		})
	}
}
