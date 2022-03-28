package db

import (
	"fmt"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
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
	if tx := db.First(&team); tx.Error != nil {
		require.NoError(t, tx.Error)
	}

	fmt.Println(team)
}
