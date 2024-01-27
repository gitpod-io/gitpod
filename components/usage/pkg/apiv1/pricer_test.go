// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
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
			actualCredits := DefaultWorkspacePricer.Credits("default", tc.Seconds)

			require.True(t, cmp.Equal(tc.ExpectedCredits, actualCredits, cmpopts.EquateApprox(0, 0.0000001)))
		})
	}
}

func TestWorkspaceInstanceForUsage_WorkspaceRuntimeSeconds(t *testing.T) {
	type Scenario struct {
		Name                   string
		Instance               *db.WorkspaceInstanceForUsage
		StopTimeIfStillRunning time.Time
		ExpectedCredits        float64
	}

	for _, s := range []Scenario{
		{
			Name: "does not use stop time if still running if the instance stopped",
			Instance: &db.WorkspaceInstanceForUsage{
				WorkspaceClass: db.WorkspaceClass_Default,
				StartedTime:    db.NewVarCharTime(time.Date(2022, 9, 8, 12, 0, 0, 0, time.UTC)),
				StoppingTime:   db.NewVarCharTime(time.Date(2022, 9, 8, 12, 6, 0, 0, time.UTC)),
			},
			// Override is before actual stop time
			StopTimeIfStillRunning: time.Date(2022, 9, 8, 11, 21, 29, 00, time.UTC),
			ExpectedCredits:        1,
		},
		{
			Name: "uses stop time when instance is not stopped",
			Instance: &db.WorkspaceInstanceForUsage{
				WorkspaceClass: db.WorkspaceClass_Default,
				StartedTime:    db.NewVarCharTime(time.Date(2022, 9, 8, 12, 0, 0, 0, time.UTC)),
			},
			StopTimeIfStillRunning: time.Date(2022, 9, 8, 12, 12, 0, 00, time.UTC),
			ExpectedCredits:        2,
		},
		{
			Name: "uses creation time when stop time if still running is less than started time",
			Instance: &db.WorkspaceInstanceForUsage{
				WorkspaceClass: db.WorkspaceClass_Default,
				StartedTime:    db.NewVarCharTime(time.Date(2022, 9, 8, 12, 0, 0, 0, time.UTC)),
			},
			StopTimeIfStillRunning: time.Date(2022, 9, 8, 11, 0, 0, 00, time.UTC),
			ExpectedCredits:        0,
		},
		{
			Name: "an errored instance that has no stopping time.",
			Instance: &db.WorkspaceInstanceForUsage{
				WorkspaceClass: db.WorkspaceClass_Default,
				StartedTime:    db.NewVarCharTime(time.Date(2022, 9, 8, 12, 0, 0, 0, time.UTC)),
				StoppedTime:    db.NewVarCharTime(time.Date(2022, 9, 8, 12, 0, 0, 0, time.UTC)),
			},
			StopTimeIfStillRunning: time.Date(2022, 9, 8, 11, 0, 0, 00, time.UTC),
			ExpectedCredits:        0,
		},
	} {
		t.Run(s.Name, func(t *testing.T) {
			credits := DefaultWorkspacePricer.CreditsUsedByInstance(s.Instance, s.StopTimeIfStillRunning)
			require.Equal(t, s.ExpectedCredits, credits)
		})
	}
}
