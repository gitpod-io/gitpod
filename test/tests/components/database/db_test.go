// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package database

import (
	"context"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestBuiltinUserExists(t *testing.T) {
	f := features.New("database").
		WithLabel("component", "database").
		Assess("it should exists a builtin user workspace", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			db, err := api.DB()
			if err != nil {
				t.Fatal(err)
			}

			rows, err := db.Query(`SELECT count(1) AS count FROM d_b_user WHERE id ="builtin-user-workspace-probe-0000000"`)
			if err != nil {
				t.Fatal(err)
			}
			defer rows.Close()

			if !rows.Next() {
				t.Fatal("no rows selected - should not happen")
			}

			var count int
			err = rows.Scan(&count)
			if err != nil {
				t.Fatal(err)
			}

			if count != 1 {
				t.Fatalf("expected a single builtin-user-workspace-probe-0000000, but found %d", count)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
