package db

import (
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestListAllProject(t *testing.T) {
	db := getPreviewDB(t)

	rows, err := db.Model(&Project{}).Rows()
	require.NoError(t, err)

	for rows.Next() {
		var project Project
		require.NoError(t, db.ScanRows(rows, &project))

		fmt.Println(project)
	}
}
