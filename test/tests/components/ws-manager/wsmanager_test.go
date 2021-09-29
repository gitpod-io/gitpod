// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanager_api "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestGetWorkspaces(t *testing.T) {
	f := features.New("workspaces").
		WithLabel("component", "ws-manager").
		Assess("it should get workspaces", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			wsman, err := api.WorkspaceManager()
			if err != nil {
				t.Fatal(err)
			}

			_, err = wsman.GetWorkspaces(ctx, &wsmanager_api.GetWorkspacesRequest{})
			if err != nil {
				t.Fatal(err)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
