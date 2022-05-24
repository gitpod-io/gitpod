// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestConnectForTests(t *testing.T) {
	conn := ConnectForTests(t)
	require.NotNil(t, conn)
}
