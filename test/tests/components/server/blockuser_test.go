// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestAdminBlockUser(t *testing.T) {
	f := features.New("block user").
		WithLabel("component", "server").
		Assess("it should block new created user", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			rand.Seed(time.Now().UnixNano())
			randN := rand.Intn(1000)

			adminUsername := fmt.Sprintf("admin%d", randN)
			adminUserId, err := integration.CreateUser(adminUsername, true, api)
			if err != nil {
				t.Fatalf("cannot create user: %q", err)
			}

			t.Cleanup(func() {
				err := integration.DeleteUser(adminUserId, api)
				if err != nil {
					t.Fatalf("error deleting user %q", err)
				}
			})
			t.Logf("user '%s' with ID %s created", adminUsername, adminUserId)

			username := fmt.Sprintf("johndoe%d", randN)
			userId, err := integration.CreateUser(username, false, api)
			if err != nil {
				t.Fatalf("cannot create user: %q", err)
			}
			t.Cleanup(func() {
				err := integration.DeleteUser(userId, api)
				if err != nil {
					t.Fatalf("error deleting user %q", err)
				}
			})
			t.Logf("user '%s' with ID %s created", username, userId)

			serverOpts := []integration.GitpodServerOpt{integration.WithGitpodUser(adminUsername)}
			server, err := api.GitpodServer(serverOpts...)
			if err != nil {
				t.Fatalf("cannot perform AdminBlockUser: %q", err)
			}

			err = server.AdminBlockUser(ctx, &protocol.AdminBlockUserRequest{UserID: userId, IsBlocked: true})
			if err != nil {
				t.Fatalf("cannot perform AdminBlockUser: %q", err)
			}

			blocked, err := integration.IsUserBlocked(userId, api)
			if err != nil {
				t.Fatalf("error checking if user is blocked: %q", err)
			}

			if !blocked {
				t.Fatalf("expected user '%s' with ID %s is blocked, but is not", username, userId)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
