// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestConnectionParamsFromEnv(t *testing.T) {
	t.Setenv("DB_USERNAME", "username")
	t.Setenv("DB_PASSWORD", "pass")
	t.Setenv("DB_HOST", "dbhost")
	t.Setenv("DB_PORT", "dbport")
	t.Setenv("DB_CA_CERT", "cacert")

	require.Equal(t, ConnectionParams{
		User:     "username",
		Password: "pass",
		Host:     "dbhost:dbport",
		Database: "gitpod",
		CaCert:   "cacert",
	}, ConnectionParamsFromEnv())
}
