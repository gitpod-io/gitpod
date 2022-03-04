// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

func CreateUser(username string, admin bool, api *ComponentAPI) (userId string, err error) {
	userUUID, err := uuid.NewRandom()
	if err != nil {
		return
	}
	userId = userUUID.String()

	rolesOrPermissions := "[]"
	if admin {
		rolesOrPermissions = `["admin"]`
	}

	db, err := api.DB()
	if err != nil {
		return
	}

	_, err = db.Exec("INSERT INTO d_b_user (id, creationDate, name, rolesOrPermissions) VALUES (?, NOW(), ?, ?)",
		userId,
		username,
		rolesOrPermissions,
	)
	return
}

func DeleteUser(userId string, api *ComponentAPI) (err error) {
	db, err := api.DB()
	if err != nil {
		return
	}

	_, err = db.Exec("DELETE FROM d_b_user WHERE id = ?", userId)
	return
}

func IsUserBlocked(userId string, api *ComponentAPI) (blocked bool, err error) {
	db, err := api.DB()
	if err != nil {
		return
	}

	rows, err := db.Query("SELECT blocked FROM d_b_user WHERE id = ?", userId)
	if err != nil {
		return
	}
	defer rows.Close()

	if !rows.Next() {
		return false, xerrors.Errorf("no rows selected - should not happen")
	}

	err = rows.Scan(&blocked)
	return
}
