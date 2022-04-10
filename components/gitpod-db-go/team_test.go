package db

import (
	"encoding/base64"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"os/exec"
	"testing"
	"time"
)

func TestCreateAndRead(t *testing.T) {
	db := getPreviewDB(t)

	teamToCreate := Team{
		ID:           uuid.New(),
		Name:         "foo-bar",
		Slug:         "foobar",
		CreationTime: NewVarcharTime(time.Now()),
	}
	tx := db.Debug().Create(&teamToCreate)
	require.NoError(t, tx.Error)

	retrieved := Team{}
	tx = db.Debug().First(&retrieved, teamToCreate.ID)
	require.NoError(t, tx.Error)

	require.Equal(t, teamToCreate.CreationTime, retrieved.CreationTime)
}

func getPreviewEnvDBPass(t *testing.T) string {
	cmd := `kubectl get secret mysql -o json | jq -r '.data["password"]'`
	out, err := exec.Command("/bin/bash", "-c", cmd).Output()
	require.NoError(t, err, "must retrieve db password")

	decoded, err := base64.StdEncoding.DecodeString(string(out))
	require.NoError(t, err)

	return string(decoded)
}

func getPreviewDB(t *testing.T) *gorm.DB {
	pass := getPreviewEnvDBPass(t)

	db, err := Connect(ConnectionParams{
		User:     "gitpod",
		Password: pass,
		Host:     "127.0.0.1:3306",
		Database: "gitpod",
	})
	require.NoError(t, err)

	return db
}
