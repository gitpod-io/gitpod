// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"context"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/google/uuid"
	"golang.org/x/xerrors"
)

// CreateUser creates a new admin user in the Gitpod installation
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

// GitHubToken returns the GitHub token of the user from Gitpod
func GitHubToken(ctx context.Context, username string, api *ComponentAPI) (token string, err error) {
	server, err := api.GitpodServer(WithGitpodUser(username))
	if err != nil {
		return "", xerrors.Errorf("cannot connect to server: %q", err)
	}
	tkn, err := server.GetToken(ctx, &protocol.GetTokenSearchOptions{
		Host: "github.com",
	})
	if err != nil {
		return "", xerrors.Errorf("cannot get token: %w", err)
	}
	return tkn.Value, nil
}
