// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestBilledSession_WriteRead(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	billedSession := &db.BilledSession{
		InstanceID: uuid.New(),
		From:       db.NewVarcharTime(time.Date(2022, 8, 04, 12, 00, 00, 00, time.UTC)),
		To:         db.NewVarcharTime(time.Date(2022, 9, 04, 12, 00, 00, 00, time.UTC)),
		System:     "chargebee",
		InvoiceID:  "some-invoice-ID",
	}

	tx := conn.Create(billedSession)
	require.NoError(t, tx.Error)

	read := &db.BilledSession{InstanceID: billedSession.InstanceID}
	tx = conn.First(read)
	require.NoError(t, tx.Error)
	require.Equal(t, billedSession.InstanceID, read.InstanceID)
	require.Equal(t, billedSession.From, read.From)
	require.Equal(t, billedSession.To, read.To)
	require.Equal(t, billedSession.System, read.System)
	require.Equal(t, billedSession.InvoiceID, read.InvoiceID)

	t.Cleanup(func() {
		conn.Model(&db.BilledSession{}).Delete(billedSession)
	})
}
