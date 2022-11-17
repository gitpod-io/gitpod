// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestPersonalAccessToken_Get(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	token := db.PersonalAccessToken{
		ID:             uuid.New(),
		UserID:         uuid.New(),
		Hash:           "some-secure-hash",
		Name:           "some-name",
		Description:    "some-description",
		Scopes:         []string{"read", "write"},
		ExpirationTime: time.Now().Add(5),
		CreatedAt:      time.Now(),
		LastModified:   time.Now(),
	}

	tx := conn.Create(token)
	require.NoError(t, tx.Error)

	result, err := db.GetToken(context.Background(), conn, token.ID)
	require.NoError(t, err)
	require.Equal(t, token.ID, result.ID)
}

func TestPersonalAccessToken_Create(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	request := db.PersonalAccessToken{
		ID:             uuid.New(),
		UserID:         uuid.New(),
		Hash:           "another-secure-hash",
		Name:           "another-name",
		Description:    "another-description",
		Scopes:         []string{"read", "write"},
		ExpirationTime: time.Now().Add(5),
		CreatedAt:      time.Now(),
		LastModified:   time.Now(),
	}

	result, err := db.CreateToken(context.Background(), conn, request)
	require.NoError(t, err)

	require.Equal(t, request.ID, result.ID)
}
