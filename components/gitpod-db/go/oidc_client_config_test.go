// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestCreateOIDCClientConfig_Create(t *testing.T) {
	conn := dbtest.ConnectForTests(t)
	created := dbtest.CreateOIDCClientConfigs(t, conn, db.OIDCClientConfig{})[0]

	retrieved, err := db.GetOIDCClientConfig(context.Background(), conn, created.ID)
	require.NoError(t, err)
	require.Equal(t, created, retrieved)
}

func TestListOIDCClientConfigsForOrganization(t *testing.T) {
	ctx := context.Background()
	conn := dbtest.ConnectForTests(t)

	orgA, orgB := uuid.New(), uuid.New()

	dbtest.CreateOIDCClientConfigs(t, conn,
		dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
			OrganizationID: &orgA,
		}),
		dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
			OrganizationID: &orgA,
		}),
		dbtest.NewOIDCClientConfig(t, db.OIDCClientConfig{
			OrganizationID: &orgB,
		}),
	)

	configsForOrgA, err := db.ListOIDCClientConfigsForOrganization(ctx, conn, orgA)
	require.NoError(t, err)
	require.Len(t, configsForOrgA, 2)

	configsForOrgB, err := db.ListOIDCClientConfigsForOrganization(ctx, conn, orgB)
	require.NoError(t, err)
	require.Len(t, configsForOrgB, 1)

	configsForRandomOrg, err := db.ListOIDCClientConfigsForOrganization(ctx, conn, uuid.New())
	require.NoError(t, err)
	require.Len(t, configsForRandomOrg, 0)
}
