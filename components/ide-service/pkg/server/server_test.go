// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	"testing"
	"time"

	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	api "github.com/gitpod-io/gitpod/ide-service-api"
	"github.com/gitpod-io/gitpod/ide-service-api/config"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
)

func TestResolveWorkspaceConfig(t *testing.T) {
	type fixture struct {
		api.ResolveWorkspaceConfigRequest
	}
	type gold struct {
		Resp *api.ResolveWorkspaceConfigResponse
		Err  string
	}

	cfg := &config.ServiceConfiguration{
		Server:        &baseserver.Configuration{},
		IDEConfigPath: "../../example-ide-config.json",
	}
	server := New(cfg, func() remotes.Resolver {
		return docker.NewResolver(docker.ResolverOptions{})
	})
	server.readIDEConfig(context.Background(), true)

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/resolve_ws_config_*.json",
		Test: func(t *testing.T, input any) interface{} {
			fixture := input.(*fixture)

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			resp, err := server.ResolveWorkspaceConfig(ctx, &fixture.ResolveWorkspaceConfigRequest)
			if err != nil {
				return &gold{Err: err.Error()}
			}
			return &gold{Resp: resp, Err: ""}
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}
