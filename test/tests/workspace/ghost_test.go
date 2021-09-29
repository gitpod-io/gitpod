// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestGhostWorkspace(t *testing.T) {
	f := features.New("ghost").
		WithLabel("component", "ws-manager").
		Assess("it can start a ghost workspace", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			// there's nothing specific about ghost that we want to test beyond that they start properly
			ws, err := integration.LaunchWorkspaceDirectly(ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
				req.Type = wsmanapi.WorkspaceType_GHOST
				req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
					Name:  "GITPOD_TASKS",
					Value: `[{ "init": "echo \"some output\" > someFile; sleep 20; exit 0;" }]`,
				})
				return nil
			}))
			if err != nil {
				t.Fatal(err)
			}

			_, err = integration.WaitForWorkspaceStart(ctx, ws.Req.Id, api)
			if err != nil {
				t.Fatal(err)
			}

			err = integration.DeleteWorkspace(ctx, api, ws.Req.Id)
			if err != nil {
				t.Fatal(err)
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
