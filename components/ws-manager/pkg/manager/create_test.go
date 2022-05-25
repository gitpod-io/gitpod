// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
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
	type WorkspaceClass struct {
		DefaultTemplate    *corev1.Pod                   `json:"defaultTemplate,omitempty"`
		PrebuildTemplate   *corev1.Pod                   `json:"prebuildTemplate,omitempty"`
		ProbeTemplate      *corev1.Pod                   `json:"probeTemplate,omitempty"`
		ImagebuildTemplate *corev1.Pod                   `json:"imagebuildTemplate,omitempty"`
		RegularTemplate    *corev1.Pod                   `json:"regularTemplate,omitempty"`
		ResourceRequests   *config.ResourceConfiguration `json:"resourceRequests,omitempty"`
		ResourceLimits     *config.ResourceConfiguration `json:"resourceLimits,omitempty"`
	}
	type tpl struct {
		FN      string
		Content interface{}
		Setter  func(fn string)
	}
	toTpl := func(path string, cls WorkspaceClass, c *config.WorkspacePodTemplateConfiguration) []tpl {
		return []tpl{
			{filepath.Join(path, "default-template.yaml"), cls.DefaultTemplate, func(fn string) { c.DefaultPath = fn }},
			{filepath.Join(path, "prebuild-template.yaml"), cls.PrebuildTemplate, func(fn string) { c.PrebuildPath = fn }},
			{filepath.Join(path, "probe-template.yaml"), cls.ProbeTemplate, func(fn string) { c.ProbePath = fn }},
			{filepath.Join(path, "imagebuild-template.yaml"), cls.ImagebuildTemplate, func(fn string) { c.ImagebuildPath = fn }},
			{filepath.Join(path, "regular-template.yaml"), cls.RegularTemplate, func(fn string) { c.RegularPath = fn }},
		}
	}
	type fixture struct {
		WorkspaceClass

		Spec         *json.RawMessage          `json:"spec,omitempty"`    // *api.StartWorkspaceSpec
		Request      *json.RawMessage          `json:"request,omitempty"` // *api.StartWorkspaceRequest
		Context      *startWorkspaceContext    `json:"context,omitempty"`
		CACertSecret string                    `json:"caCertSecret,omitempty"`
		Classes      map[string]WorkspaceClass `json:"classes,omitempty"`

		EnforceAffinity   bool `json:"enforceAffinity,omitempty"`
		DebugWorkspacePod bool `json:"debugWorkspacePod,omitempty"`
	}
	type gold struct {
		Pod   corev1.Pod `json:"reason,omitempty"`
		Error string     `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/cdwp_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			mgmtCfg := forTestingOnlyManagerConfig()
			mgmtCfg.WorkspaceCACertSecret = fixture.CACertSecret
			mgmtCfg.DebugWorkspacePod = fixture.DebugWorkspacePod

			if fixture.Classes == nil {
				fixture.Classes = make(map[string]WorkspaceClass)
			}

			var files []tpl
			if _, exists := fixture.Classes[config.DefaultWorkspaceClass]; !exists {
				if fixture.WorkspaceClass.ResourceLimits != nil || fixture.WorkspaceClass.ResourceRequests != nil {
					// there's no default class in the fixture. If there are limits configured, use those
					fixture.Classes[config.DefaultWorkspaceClass] = fixture.WorkspaceClass
				}
			}

			for n, cls := range fixture.Classes {
				var cfgCls config.WorkspaceClass
				cfgCls.Container.Requests = cls.ResourceRequests
				cfgCls.Container.Limits = cls.ResourceLimits

				files = append(files, toTpl(n, cls, &cfgCls.Templates)...)
				mgmtCfg.WorkspaceClasses[n] = &cfgCls
			}

			manager := &Manager{Config: mgmtCfg}

			// create in-memory file system
			mapFS := fstest.MapFS{}
			for _, f := range files {
				if f.Content == nil {
					continue
				}

				b, err := yaml.Marshal(f.Content)
				if err != nil {
					t.Errorf("cannot re-marshal %s template: %v", f.FN, err)
					return nil
				}

				mapFS[f.FN] = &fstest.MapFile{Data: b}

				f.Setter(f.FN)
			}
			config.FS = mapFS

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

				if req.Spec.Class == "" {
					fmt.Println()
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

func TestCreatePVCForWorkspacePod(t *testing.T) {
	type WorkspaceClass struct {
		PVCConfig        *config.PVCConfiguration      `json:"pvcConfig,omitempty"`
		ResourceRequests *config.ResourceConfiguration `json:"resourceRequests,omitempty"`
		ResourceLimits   *config.ResourceConfiguration `json:"resourceLimits,omitempty"`
	}
	type fixture struct {
		WorkspaceClass

		Spec         *json.RawMessage          `json:"spec,omitempty"`    // *api.StartWorkspaceSpec
		Request      *json.RawMessage          `json:"request,omitempty"` // *api.StartWorkspaceRequest
		Context      *startWorkspaceContext    `json:"context,omitempty"`
		CACertSecret string                    `json:"caCertSecret,omitempty"`
		Classes      map[string]WorkspaceClass `json:"classes,omitempty"`

		EnforceAffinity bool `json:"enforceAffinity,omitempty"`
	}
	type gold struct {
		PVC   corev1.PersistentVolumeClaim `json:"reason,omitempty"`
		Error string                       `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/cpwp_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			mgmtCfg := forTestingOnlyManagerConfig()
			mgmtCfg.WorkspaceCACertSecret = fixture.CACertSecret

			if fixture.Classes == nil {
				fixture.Classes = make(map[string]WorkspaceClass)
			}

			if _, exists := fixture.Classes[config.DefaultWorkspaceClass]; !exists {
				if fixture.WorkspaceClass.ResourceLimits != nil || fixture.WorkspaceClass.ResourceRequests != nil {
					// there's no default class in the fixture. If there are limits configured, use those
					fixture.Classes[config.DefaultWorkspaceClass] = fixture.WorkspaceClass
				}
			}

			for n, cls := range fixture.Classes {
				var cfgCls config.WorkspaceClass
				cfgCls.Container.Requests = cls.ResourceRequests
				cfgCls.Container.Limits = cls.ResourceLimits
				if cls.PVCConfig != nil {
					cfgCls.PVC = *cls.PVCConfig
				}

				mgmtCfg.WorkspaceClasses[n] = &cfgCls
			}

			manager := &Manager{Config: mgmtCfg}

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

			pvc, serr := manager.createPVCForWorkspacePod(fixture.Context)
			result := gold{}
			if serr != nil {
				result.Error = serr.Error()
				return &result
			}
			result.PVC = *pvc

			return &result
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}
