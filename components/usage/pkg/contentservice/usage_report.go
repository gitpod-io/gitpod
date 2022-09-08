// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"time"
)

type InvalidSession struct {
	Reason  string
	Session db.WorkspaceInstanceForUsage
}

type UsageReport struct {
	GenerationTime time.Time `json:"generationTime"`

	From time.Time `json:"from"`
	To   time.Time `json:"to"`

	InvalidSessions []InvalidSession `json:"invalidSessions"`

	UsageRecords []db.WorkspaceInstanceUsage `json:"usageRecords"`
}

func (r *UsageReport) GetUsageRecordsForAttributionID(attributionID db.AttributionID) []db.WorkspaceInstanceUsage {
	var sessions []db.WorkspaceInstanceUsage
	for _, sess := range r.UsageRecords {
		if sess.AttributionID == attributionID {
			sessions = append(sessions, sess)
		}
	}

	return sessions
}
