// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/json"
	"testing"
	"testing/fstest"

	"google.golang.org/protobuf/encoding/protojson"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/yaml"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

func TestCreateDefiniteWorkspacePod(t *testing.T) {
	type fixture struct {
		Spec             *json.RawMessage              `json:"spec,omitempty"`    // *api.StartWorkspaceSpec
		Request          *json.RawMessage              `json:"request,omitempty"` // *api.StartWorkspaceRequest
		Context          *startWorkspaceContext        `json:"context,omitempty"`
		DefaultTemplate  *corev1.Pod                   `json:"defaultTemplate,omitempty"`
		PrebuildTemplate *corev1.Pod                   `json:"prebuildTemplate,omitempty"`
		ProbeTemplate    *corev1.Pod                   `json:"probeTemplate,omitempty"`
		RegularTemplate  *corev1.Pod                   `json:"regularTemplate,omitempty"`
		ResourceRequests *config.ResourceConfiguration `json:"resourceRequests,omitempty"`
	}
	type gold struct {
		Pod   corev1.Pod `json:"reason,omitempty"`
		Error string     `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/cdwp_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			manager := forTestingOnlyGetManager(t)
			fixture := input.(*fixture)
			if fixture.ResourceRequests != nil {
				var (
					cfg  = manager.Config
					cont = cfg.Container
					ws   = cont.Workspace
				)
				ws.Requests = *fixture.ResourceRequests
				cont.Workspace = ws
				cfg.Container = cont
				manager.Config = cfg
			}

			// create in-memory file system
			mapFS := fstest.MapFS{}

			config.FS = mapFS

			files := []struct {
				tplfn  string
				ctnt   interface{}
				setter func(fn string)
			}{
				{"default-template.yaml", fixture.DefaultTemplate, func(fn string) { manager.Config.WorkspacePodTemplate.DefaultPath = fn }},
				{"prebuild-template.yaml", fixture.PrebuildTemplate, func(fn string) { manager.Config.WorkspacePodTemplate.PrebuildPath = fn }},
				{"probe-template.yaml", fixture.ProbeTemplate, func(fn string) { manager.Config.WorkspacePodTemplate.ProbePath = fn }},
				{"regular-template.yaml", fixture.RegularTemplate, func(fn string) { manager.Config.WorkspacePodTemplate.RegularPath = fn }},
			}
			for _, f := range files {
				if f.ctnt == nil {
					continue
				}

				b, err := yaml.Marshal(f.ctnt)
				if err != nil {
					t.Errorf("cannot re-marshal %s template: %w", f.tplfn, err)
					return nil
				}

				mapFS[f.tplfn] = &fstest.MapFile{Data: b}

				f.setter(f.tplfn)
			}

			if fixture.Context == nil {
				var req api.StartWorkspaceRequest
				if fixture.Request == nil {
					if fixture.Spec == nil {
						t.Errorf("fixture has neither context, nor request, nor spec")
						return nil
					}

					var spec api.StartWorkspaceSpec
					err := protojson.Unmarshal([]byte(*fixture.Spec), &spec)
					if err != nil {
						t.Errorf("cannot unmarshal StartWorkspaceSpec: %v", err)
						return nil
					}

					req = api.StartWorkspaceRequest{
						Type: api.WorkspaceType_REGULAR,
						Id:   "test",
						Metadata: &api.WorkspaceMetadata{
							Owner:  "tester",
							MetaId: "foobar",
						},
						ServicePrefix: "foobarservice",
						Spec:          &spec,
					}
				} else {
					err := protojson.Unmarshal([]byte(*fixture.Request), &req)
					if err != nil {
						t.Errorf("cannot unmarshal StartWorkspaceReq: %v", err)
						return nil
					}
				}

				ctx, err := manager.newStartWorkspaceContext(context.Background(), &req)
				if err != nil {
					t.Errorf("cannot create startWorkspaceContext: %v", err)
					return nil
				}

				// tie down values that would otherwise change for each test
				ctx.CLIAPIKey = "Ab=5=rRA*9:C'T{;RRB\u003e]vK2p6`fFfrS"
				ctx.OwnerToken = "%7J'[Of/8NDiWE+9F,I6^Jcj_1\u0026}-F8p"

				fixture.Context = ctx
			}

			pod, serr := manager.createWorkspacePod(fixture.Context)
			result := gold{}
			if serr != nil {
				result.Error = serr.Error()
				return &result
			}
			result.Pod = *pod

			return &result
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}
