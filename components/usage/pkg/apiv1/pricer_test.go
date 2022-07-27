// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"
)

func TestWorkspacePricer_Default(t *testing.T) {
	const (
		expectedCreditsPerMinute = float64(1) / 6
		expectedCreditsPerSecond = expectedCreditsPerMinute / 60
	)

	testCases := []struct {
		Name            string
		Seconds         int64
		ExpectedCredits float64
	}{
		{
			Name:            "0 seconds",
			Seconds:         0,
			ExpectedCredits: 0,
		},
		{
			Name:            "1 second",
			Seconds:         1,
			ExpectedCredits: 1 * expectedCreditsPerSecond,
		},
		{
			Name:            "60 seconds",
			Seconds:         60,
			ExpectedCredits: 1 * expectedCreditsPerMinute,
		},
		{
			Name:            "90 seconds",
			Seconds:         90,
			ExpectedCredits: 1.5 * expectedCreditsPerMinute,
		},
		{
			Name:            "6 minutes",
			Seconds:         360,
			ExpectedCredits: 6 * expectedCreditsPerMinute,
		},
		{
			Name:            "6 minutes and 1 second",
			Seconds:         361,
			ExpectedCredits: 6*expectedCreditsPerMinute + 1*expectedCreditsPerSecond,
		},
		{
			Name:            "1 hour",
			Seconds:         3600,
			ExpectedCredits: 60 * expectedCreditsPerMinute,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			actualCredits := DefaultWorkspacePricer.Credits(defaultWorkspaceClass, tc.Seconds)

			require.True(t, cmp.Equal(tc.ExpectedCredits, actualCredits, cmpopts.EquateApprox(0, 0.0000001)))
		})
	}
}
