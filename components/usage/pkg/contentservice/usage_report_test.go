// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"encoding/json"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestUsageReport_ToJSON(t *testing.T) {
	report := UsageReport{
		GenerationTime: time.Now().UTC(),
		From:           time.Now().UTC(),
		To:             time.Now().UTC(),
		InvalidSessions: []InvalidSession{
			{
				Reason:  "some-reason",
				Session: db.WorkspaceInstanceForUsage{},
			},
		},
		UsageRecords: []db.WorkspaceInstanceUsage{
			dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{}),
		},
	}

	b, err := json.Marshal(report)
	require.NoError(t, err)

	var actual UsageReport
	err = json.Unmarshal(b, &actual)
	require.NoError(t, err)

	require.EqualValues(t, report, actual)
}

func TestUsageReport_GetUsageRecordsForAttributionID(t *testing.T) {
	attributionID_A, attributionID_B := db.NewTeamAttributionID(uuid.New().String()), db.NewTeamAttributionID(uuid.New().String())

	report := UsageReport{
		GenerationTime: time.Now(),
		From:           time.Now(),
		To:             time.Now(),
		UsageRecords: []db.WorkspaceInstanceUsage{
			dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
				AttributionID: attributionID_A,
			}),
			dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
				AttributionID: attributionID_A,
			}),
			dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
				AttributionID: attributionID_B,
			}),
		},
	}

	filteredToAttributionA := report.GetUsageRecordsForAttributionID(attributionID_A)
	require.Equal(t, []db.WorkspaceInstanceUsage{report.UsageRecords[0], report.UsageRecords[1]}, filteredToAttributionA)

	filteredToAttributionB := report.GetUsageRecordsForAttributionID(attributionID_B)
	require.Equal(t, []db.WorkspaceInstanceUsage{report.UsageRecords[2]}, filteredToAttributionB)

	filteredToAbsentAttribution := report.GetUsageRecordsForAttributionID(db.NewTeamAttributionID(uuid.New().String()))
	require.Len(t, filteredToAbsentAttribution, 0)
}
