// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"database/sql"
	"encoding/json"
	"fmt"
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
		RawSessions: []db.WorkspaceInstanceForUsage{
			{
				ID:          uuid.New(),
				WorkspaceID: dbtest.GenerateWorkspaceID(),
				OwnerID:     uuid.New(),
				ProjectID: sql.NullString{
					String: "project-id",
					Valid:  true,
				},
				WorkspaceClass:     "workspace-class",
				Type:               "regular",
				UsageAttributionID: db.NewTeamAttributionID(uuid.New().String()),
				CreationTime:       db.NewVarcharTime(time.Now()),
				StartedTime:        db.NewVarcharTime(time.Now()),
				StoppingTime:       db.NewVarcharTime(time.Now()),
				StoppedTime:        db.NewVarcharTime(time.Now()),
			},
		},
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

	fmt.Println(report, actual)
	require.EqualValues(t, report, actual)

}
