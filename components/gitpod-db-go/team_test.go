package db

import (
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

func TestTeam(t *testing.T) {
	pass := os.Getenv("MYSQL_DB_PASS")
	require.NotEmpty(t, pass)

	db, err := Connect(ConnectionParams{
		User:     "gitpod",
		Password: pass,
		Host:     "tcp(127.0.0.1:3306)",
		Database: "gitpod",
	})
	require.NoError(t, err)

	team := Team{}
	tx := db.First(&team)
	require.NoError(t, tx.Error)

	teamToCreate := Team{
		ID:            uuid.New(),
		Name:          "foo-bar",
		Slug:          "foobar",
		CreationTime:  NewStringlyTime(time.Now()),
		MarkedDeleted: false,
	}
	tx = db.Create(&teamToCreate)
	require.NoError(t, tx.Error)
}

func TestTeam_Create(t *testing.T) {
	pass := os.Getenv("MYSQL_DB_PASS")
	require.NotEmpty(t, pass)

	db, err := Connect(ConnectionParams{
		User:     "gitpod",
		Password: pass,
		Host:     "tcp(127.0.0.1:3306)",
		Database: "gitpod",
	})
	require.NoError(t, err)

	team := Team{
		ID:            uuid.New(),
		Name:          "foo-bar",
		Slug:          "foobar",
		CreationTime:  NewStringlyTime(time.Now()),
		MarkedDeleted: false,
	}
	tx := db.Create(&team)
	require.NoError(t, tx.Error)
}
