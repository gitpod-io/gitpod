// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestCreateOIDCClientConfig_Create(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{})[0]

	retrieved, err := db.GetOIDCClientConfig(context.Background(), conn, created.ID)
	require.NoError(t, err)
	require.Equal(t, created, retrieved)
}
