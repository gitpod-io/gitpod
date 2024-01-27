// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db_test

import (
	"context"
	"strconv"
	"testing"
	"time"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestPersonalAccessToken_Get(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	firstUserId := uuid.New()
	secondUserId := uuid.New()

	token := dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{UserID: firstUserId})
	token2 := dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{UserID: secondUserId})

	tokenEntries := []db.PersonalAccessToken{token, token2}

	dbtest.CreatePersonalAccessTokenRecords(t, conn, tokenEntries...)

	t.Run("nil token ID is rejected", func(t *testing.T) {
		_, err := db.GetPersonalAccessTokenForUser(context.Background(), conn, uuid.Nil, token.UserID)
		require.Error(t, err)
	})

	t.Run("nil user ID is rejected", func(t *testing.T) {
		_, err := db.GetPersonalAccessTokenForUser(context.Background(), conn, token.ID, uuid.Nil)
		require.Error(t, err)
	})

	t.Run("not matching user", func(t *testing.T) {
		_, err := db.GetPersonalAccessTokenForUser(context.Background(), conn, token.ID, token2.UserID)
		require.Error(t, err, db.ErrorNotFound)
	})

	t.Run("not matching token", func(t *testing.T) {
		_, err := db.GetPersonalAccessTokenForUser(context.Background(), conn, token2.ID, token.UserID)
		require.Error(t, err, db.ErrorNotFound)
	})

	t.Run("both token and user don't exist in the DB", func(t *testing.T) {
		_, err := db.GetPersonalAccessTokenForUser(context.Background(), conn, uuid.New(), uuid.New())
		require.Error(t, err, db.ErrorNotFound)
	})

	t.Run("valid", func(t *testing.T) {
		returned, err := db.GetPersonalAccessTokenForUser(context.Background(), conn, token.ID, token.UserID)
		require.NoError(t, err)
		require.Equal(t, token.ID, returned.ID)
		require.Equal(t, token.UserID, returned.UserID)
	})

}

func TestPersonalAccessToken_Create(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	request := db.PersonalAccessToken{
		ID:             uuid.New(),
		UserID:         uuid.New(),
		Hash:           "another-secure-hash",
		Name:           "another-name",
		Scopes:         []string{"read", "write"},
		ExpirationTime: time.Now().Add(5),
		CreatedAt:      time.Now(),
		LastModified:   time.Now(),
	}

	result, err := db.CreatePersonalAccessToken(context.Background(), conn, request)
	require.NoError(t, err)

	require.Equal(t, request.ID, result.ID)
}

func TestPersonalAccessToken_UpdateHash(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	firstUserId := uuid.New()
	secondUserId := uuid.New()

	token := dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{UserID: firstUserId})
	token2 := dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{UserID: secondUserId})

	tokenEntries := []db.PersonalAccessToken{token, token2}

	dbtest.CreatePersonalAccessTokenRecords(t, conn, tokenEntries...)

	var newHash = "another-secure-hash"
	var newExpirationTime = time.Now().Add(24 * time.Hour).UTC().Truncate(time.Millisecond)

	t.Run("not matching user", func(t *testing.T) {
		_, err := db.UpdatePersonalAccessTokenHash(context.Background(), conn, token.ID, token2.UserID, newHash, newExpirationTime)
		require.Error(t, err, db.ErrorNotFound)
	})

	t.Run("not matching token", func(t *testing.T) {
		_, err := db.UpdatePersonalAccessTokenHash(context.Background(), conn, token2.ID, token.UserID, newHash, newExpirationTime)
		require.Error(t, err, db.ErrorNotFound)
	})

	t.Run("both token and user don't exist in the DB", func(t *testing.T) {
		_, err := db.UpdatePersonalAccessTokenHash(context.Background(), conn, uuid.New(), uuid.New(), newHash, newExpirationTime)
		require.Error(t, err, db.ErrorNotFound)
	})

	t.Run("valid", func(t *testing.T) {
		returned, err := db.UpdatePersonalAccessTokenHash(context.Background(), conn, token.ID, token.UserID, newHash, newExpirationTime)
		require.NoError(t, err)
		require.Equal(t, token.ID, returned.ID)
		require.Equal(t, token.UserID, returned.UserID)
		require.Equal(t, newHash, returned.Hash)
		require.Equal(t, token.Name, returned.Name)
		require.Equal(t, token.Scopes, returned.Scopes)
		require.Equal(t, newExpirationTime, returned.ExpirationTime)
		require.Equal(t, token.CreatedAt, returned.CreatedAt)
	})
}

func TestPersonalAccessToken_Delete(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	firstUserId := uuid.New()
	secondUserId := uuid.New()

	token := dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{UserID: firstUserId})
	token2 := dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{UserID: secondUserId})

	tokenEntries := []db.PersonalAccessToken{token, token2}

	dbtest.CreatePersonalAccessTokenRecords(t, conn, tokenEntries...)

	t.Run("not matching user", func(t *testing.T) {
		count, err := db.DeletePersonalAccessTokenForUser(context.Background(), conn, token.ID, token2.UserID)
		require.Error(t, err, db.ErrorNotFound)
		require.Equal(t, int64(0), count)
	})

	t.Run("not matching token", func(t *testing.T) {
		count, err := db.DeletePersonalAccessTokenForUser(context.Background(), conn, token2.ID, token.UserID)
		require.Error(t, err, db.ErrorNotFound)
		require.Equal(t, int64(0), count)
	})

	t.Run("both token and user don't exist in the DB", func(t *testing.T) {
		count, err := db.DeletePersonalAccessTokenForUser(context.Background(), conn, uuid.New(), uuid.New())
		require.Error(t, err, db.ErrorNotFound)
		require.Equal(t, int64(0), count)
	})

	t.Run("valid", func(t *testing.T) {
		count, err := db.DeletePersonalAccessTokenForUser(context.Background(), conn, token.ID, token.UserID)
		require.NoError(t, err)
		require.Equal(t, int64(1), count)
		_, err = db.GetPersonalAccessTokenForUser(context.Background(), conn, token.ID, token.UserID)
		require.Error(t, err, db.ErrorNotFound)
	})
}

func TestListPersonalAccessTokensForUser(t *testing.T) {
	ctx := context.Background()
	conn := dbtest.ConnectForTests(t)
	pagination := db.Pagination{
		Page:     1,
		PageSize: 10,
	}

	userA := uuid.New()
	userB := uuid.New()

	now := time.Now().UTC()

	dbtest.CreatePersonalAccessTokenRecords(t, conn,
		dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			UserID:    userA,
			CreatedAt: now.Add(-1 * time.Minute),
		}),
		dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			UserID:    userA,
			CreatedAt: now,
		}),
		dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			UserID: userB,
		}),
	)

	tokensForUserA, err := db.ListPersonalAccessTokensForUser(ctx, conn, userA, pagination)
	require.NoError(t, err)
	require.Len(t, tokensForUserA.Results, 2)

	tokensForUserB, err := db.ListPersonalAccessTokensForUser(ctx, conn, userB, pagination)
	require.NoError(t, err)
	require.Len(t, tokensForUserB.Results, 1)

	tokensForUserWithNoData, err := db.ListPersonalAccessTokensForUser(ctx, conn, uuid.New(), pagination)
	require.NoError(t, err)
	require.Len(t, tokensForUserWithNoData.Results, 0)
}

func TestListPersonalAccessTokens_DeletedTokensAreNotListed(t *testing.T) {
	conn := dbtest.ConnectForTests(t)

	token := dbtest.CreatePersonalAccessTokenRecords(t, conn,
		dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{}),
	)[0]

	_, err := db.DeletePersonalAccessTokenForUser(context.Background(), conn, token.ID, token.UserID)
	require.NoError(t, err)

	listed, err := db.ListPersonalAccessTokensForUser(context.Background(), conn, token.UserID, db.Pagination{
		Page:     1,
		PageSize: 10,
	})
	require.NoError(t, err)
	require.Empty(t, listed.Results)
	require.EqualValues(t, 0, listed.Total)
}

func TestListPersonalAccessTokensForUser_PaginateThroughResults(t *testing.T) {
	ctx := context.Background()
	conn := dbtest.ConnectForTests(t).Debug()

	userA := uuid.New()

	total := 11
	var toCreate []db.PersonalAccessToken
	for i := 0; i < total; i++ {
		toCreate = append(toCreate, dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			UserID: userA,
			Name:   strconv.Itoa(i),
		}))
	}

	dbtest.CreatePersonalAccessTokenRecords(t, conn, toCreate...)

	batch1, err := db.ListPersonalAccessTokensForUser(ctx, conn, userA, db.Pagination{
		Page:     1,
		PageSize: 5,
	})
	require.NoError(t, err)
	require.Len(t, batch1.Results, 5)
	require.EqualValues(t, batch1.Total, total)

	batch2, err := db.ListPersonalAccessTokensForUser(ctx, conn, userA, db.Pagination{
		Page:     2,
		PageSize: 5,
	})
	require.NoError(t, err)
	require.Len(t, batch2.Results, 5)
	require.EqualValues(t, batch2.Total, total)

	batch3, err := db.ListPersonalAccessTokensForUser(ctx, conn, userA, db.Pagination{
		Page:     3,
		PageSize: 5,
	})
	require.NoError(t, err)
	require.Len(t, batch3.Results, 1)
	require.EqualValues(t, batch3.Total, total)
}

func TestUpdatePersonalAccessTokenForUser(t *testing.T) {

	newName := "second"
	newScopes := db.Scopes([]string{})

	t.Run("not found when record does not exist", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		_, err := db.UpdatePersonalAccessTokenForUser(context.Background(), conn, db.UpdatePersonalAccessTokenOpts{
			TokenID: uuid.New(),
			UserID:  uuid.New(),
			Name:    &newName,
		})
		require.Error(t, err)
		require.ErrorIs(t, err, db.ErrorNotFound)
	})

	t.Run("no modified field completes gracefully", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)
		name := "first"

		created := dbtest.CreatePersonalAccessTokenRecords(t, conn, dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			Name: name,
		}))[0]

		udpated, err := db.UpdatePersonalAccessTokenForUser(context.Background(), conn, db.UpdatePersonalAccessTokenOpts{
			TokenID: created.ID,
			UserID:  created.UserID,
			Name:    &name,
		})
		require.NoError(t, err)
		require.Equal(t, name, udpated.Name)
		require.Len(t, udpated.Scopes, 0)
	})

	t.Run("no update when all options are nil", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		created := dbtest.CreatePersonalAccessTokenRecords(t, conn, dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			Name: "first",
		}))[0]

		udpated, err := db.UpdatePersonalAccessTokenForUser(context.Background(), conn, db.UpdatePersonalAccessTokenOpts{
			TokenID: created.ID,
			UserID:  created.UserID,
		})
		require.NoError(t, err)
		require.Equal(t, created, udpated)
	})

	t.Run("updates name when it is not nil", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		created := dbtest.CreatePersonalAccessTokenRecords(t, conn, dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			Name: "first",
		}))[0]

		udpated, err := db.UpdatePersonalAccessTokenForUser(context.Background(), conn, db.UpdatePersonalAccessTokenOpts{
			TokenID: created.ID,
			UserID:  created.UserID,
			Name:    &newName,
		})
		require.NoError(t, err)
		require.Equal(t, newName, udpated.Name)
		require.Equal(t, created.Scopes, udpated.Scopes)
	})

	t.Run("updates scopes when it is not nil", func(t *testing.T) {
		conn := dbtest.ConnectForTests(t)

		created := dbtest.CreatePersonalAccessTokenRecords(t, conn, dbtest.NewPersonalAccessToken(t, db.PersonalAccessToken{
			Name:   "first",
			Scopes: db.Scopes([]string{"foo"}),
		}))[0]

		udpated, err := db.UpdatePersonalAccessTokenForUser(context.Background(), conn, db.UpdatePersonalAccessTokenOpts{
			TokenID: created.ID,
			UserID:  created.UserID,
			Scopes:  &newScopes,
		})
		require.NoError(t, err)
		require.Equal(t, created.Name, udpated.Name)
		require.Len(t, udpated.Scopes, len(newScopes))
	})
}
