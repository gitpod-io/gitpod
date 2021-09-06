// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package admin

import (
	"fmt"
	"math/rand"
	"testing"
	"time"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestAdminBlockUser(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	rand.Seed(time.Now().UnixNano())
	randN := rand.Intn(1000)

	adminUsername := fmt.Sprintf("admin%d", randN)
	adminUserId, err := integration.CreateUser(it, adminUsername, true)
	if err != nil {
		t.Fatalf("cannot create user: %q", err)
	}
	defer func() {
		err := integration.DeleteUser(it, adminUserId)
		if err != nil {
			t.Fatalf("error deleting user %q", err)
		}
	}()
	t.Logf("user '%s' with ID %s created", adminUsername, adminUserId)

	username := fmt.Sprintf("johndoe%d", randN)
	userId, err := integration.CreateUser(it, username, false)
	if err != nil {
		t.Fatalf("cannot create user: %q", err)
	}
	defer func() {
		err := integration.DeleteUser(it, userId)
		if err != nil {
			t.Fatalf("error deleting user %q", err)
		}
	}()
	t.Logf("user '%s' with ID %s created", username, userId)

	serverOpts := []integration.GitpodServerOpt{integration.WithGitpodUser(adminUsername)}
	server := it.API().GitpodServer(serverOpts...)
	err = server.AdminBlockUser(ctx, &protocol.AdminBlockUserRequest{UserID: userId, IsBlocked: true})
	if err != nil {
		t.Fatalf("cannot perform AdminBlockUser: %q", err)
	}

	blocked, err := integration.IsUserBlocked(it, userId)
	if err != nil {
		t.Fatalf("error checking if user is blocked: %q", err)
	}

	if !blocked {
		t.Fatalf("expected user '%s' with ID %s is blocked, but is not", username, userId)
	}
}
