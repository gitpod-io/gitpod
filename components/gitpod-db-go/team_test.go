package db

import (
	"encoding/base64"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"os/exec"
	"testing"
	"time"
)

func TestTeam(t *testing.T) {
	pass := getPreviewEnvDBPass(t)

	db, err := Connect(ConnectionParams{
		User:     "gitpod",
		Password: pass,
		Host:     "127.0.0.1:3306",
		Database: "gitpod",
	})
	require.NoError(t, err)
	//
	//team := Team{}
	//tx := db.Debug().First(&team)
	//require.NoError(t, tx.Error)

	teamToCreate := Team{
		ID:            uuid.New(),
		Name:          "foo-bar",
		Slug:          "foobar",
		CreationTime:  NewVarCharTime(time.Now()),
		MarkedDeleted: false,
	}
	tx := db.Debug().Create(&teamToCreate)
	require.NoError(t, tx.Error)

	retrieved := Team{}
	tx = db.Debug().First(&retrieved, teamToCreate.ID)
	require.NoError(t, tx.Error)

	require.Equal(t, teamToCreate.CreationTime, retrieved.CreationTime)
}

//func TestTeam_Create(t *testing.T) {
//	pass := getPreviewEnvDBPass(t)
//
//	db, err := Connect(ConnectionParams{
//		User:     "gitpod",
//		Password: pass,
//		Host:     "tcp(127.0.0.1:3306)",
//		Database: "gitpod",
//	})
//	require.NoError(t, err)
//
//	//team := Team{
//	//	ID:            uuid.New(),
//	//	Name:          "foo-bar",
//	//	Slug:          "foobar",
//	//	CreationTime:  NewStringlyTime(time.Now()),
//	//	MarkedDeleted: false,
//	//}
//	//tx := db.Create(&team)
//	//require.NoError(t, tx.Error)
//}

func getPreviewEnvDBPass(t *testing.T) string {
	cmd := `kubectl get secret mysql -o json | jq -r '.data["password"]'`
	out, err := exec.Command("/bin/bash", "-c", cmd).Output()
	require.NoError(t, err, "must retrieve db password")

	decoded, err := base64.StdEncoding.DecodeString(string(out))
	require.NoError(t, err)

	return string(decoded)
}
