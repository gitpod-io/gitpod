// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package smoketest

import (
	"context"
	"os"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestStartWorkspaceWithImageBuild(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	f := features.New("Start regular workspace").
		Assess("it can start a regular workspace with image build", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			_, err := api.CreateUser(username, userToken)
			if err != nil {
				t.Fatal(err)
			}

			_, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, "imagebuild/https://github.com/gitpod-integration-test/example", username, api)
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
				defer scancel()

				sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
				defer sapi.Done(t)

				_, _ = stopWs(true, sapi)
			}()
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}
