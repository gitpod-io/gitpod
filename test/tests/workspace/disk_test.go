// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"strings"

	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/pkg/report"
)

type DiskTest struct {
	Name            string
	ContextURL      string
	SpaceToAllocate string
	TestFilePath    string
	ExpectError     bool
}

func TestDiskActions(t *testing.T) {
	tests := []DiskTest{
		{
			Name:            "xfs-quota-is_exceeded",
			ContextURL:      "github.com/gitpod-io/empty",
			SpaceToAllocate: "55G",
			TestFilePath:    "/workspace/is-exceeded",
			ExpectError:     true,
		},
		{
			Name:            "xfs-quota-is_OK",
			ContextURL:      "github.com/gitpod-io/empty",
			SpaceToAllocate: "4G",
			TestFilePath:    "/workspace/is-OK",
			ExpectError:     false,
		},
	}
	runDiskTests(t, tests)
}

func runDiskTests(t *testing.T, tests []DiskTest) {
	f := features.New("ResourceLimiting").
		WithLabel("component", "workspace").
		Assess("it can enforce disk limits", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*len(tests))*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			defer api.Done(t)

			for _, test := range tests {
				test := test
				t.Run(test.Name, func(t *testing.T) {
					report.SetupReport(t, report.FeatureResourceLimit, fmt.Sprintf("Test to open %v", test.ContextURL))

					t.Parallel()

					nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, test.ContextURL, username, api)
					if err != nil {
						t.Fatal(err)
					}

					t.Cleanup(func() {
						sctx, scancel := context.WithTimeout(context.Background(), 10*time.Minute)
						scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						sapi.Done(t)
						_, err := stopWs(false, sapi)
						if err != nil {
							t.Fatal(err)
						}
					})
					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(),
						kubeconfig, cfg.Client(),
						integration.WithInstanceID(nfo.LatestInstance.ID),
					)
					if err != nil {
						t.Fatal(err)
					}
					defer rsa.Close()
					integration.DeferCloser(t, closer)
					diskClient := integration.Disk(rsa)

					err = diskClient.Fallocate(test.TestFilePath, test.SpaceToAllocate)

					if test.ExpectError {
						if err != nil && strings.Contains(err.Error(), integration.NoSpaceErrorMsg) {
							// NOM
						} else {
							t.Fatalf("expected an error object containing %s, got '%v'!", integration.NoSpaceErrorMsg, err)
						}
					} else {
						if err != nil {
							t.Fatal(err)
						}
					}
					t.Log("test finished successfully")
				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
