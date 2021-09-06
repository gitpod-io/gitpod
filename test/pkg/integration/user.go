// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"github.com/google/uuid"
)

func CreateUser(it *Test, username string, admin bool) (userId string, err error) {
	userUUID, err := uuid.NewRandom()
	if err != nil {
		return
	}
	userId = userUUID.String()

	rolesOrPermissions := "[]"
	if admin {
		rolesOrPermissions = `["admin"]`
	}

	db := it.API().DB()
	_, err = db.Exec("INSERT INTO d_b_user (id, creationDate, name, rolesOrPermissions) VALUES (?, NOW(), ?, ?)",
		userId,
		username,
		rolesOrPermissions,
	)
	return
}

func DeleteUser(it *Test, userId string) (err error) {
	db := it.API().DB()
	_, err = db.Exec("DELETE FROM d_b_user WHERE id = ?", userId)
	return
}

func IsUserBlocked(it *Test, userId string) (blocked bool, err error) {
	db := it.API().DB()
	rows, err := db.Query("SELECT blocked FROM d_b_user WHERE id = ?", userId)
	if err != nil {
		return
	}
	defer rows.Close()
	if !rows.Next() {
		it.t.Fatal("no rows selected - should not happen")
	}

	err = rows.Scan(&blocked)
	return
}
