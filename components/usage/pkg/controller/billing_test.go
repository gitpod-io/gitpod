// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestWorkspacePricer_Default(t *testing.T) {
	testCases := []struct {
		Name            string
		Seconds         int64
		ExpectedCredits int64
	}{
		{
			Name:            "0 seconds",
			Seconds:         0,
			ExpectedCredits: 0,
		},
		{
			Name:            "1 second",
			Seconds:         1,
			ExpectedCredits: 1,
		},
		{
			Name:            "60 seconds",
			Seconds:         60,
			ExpectedCredits: 1,
		},
		{
			Name:            "90 seconds",
			Seconds:         90,
			ExpectedCredits: 1,
		},
		{
			Name:            "6 minutes",
			Seconds:         360,
			ExpectedCredits: 1,
		},
		{
			Name:            "6 minutes and 1 second",
			Seconds:         361,
			ExpectedCredits: 2,
		},
		{
			Name:            "1 hour",
			Seconds:         3600,
			ExpectedCredits: 10,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			actualCredits := DefaultWorkspacePricer.Credits(defaultWorkspaceClass, tc.Seconds)

			require.Equal(t, tc.ExpectedCredits, actualCredits)
		})
	}
}
