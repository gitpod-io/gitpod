// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package service

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestDescribeCluster(t *testing.T) {
	type Expectation struct {
		Error    string
		Response *api.DescribeClusterResponse
	}
	tests := []struct {
		Name        string
		Expectation Expectation
		Config      config.Configuration
	}{
		{
			Name:        "empty config",
			Expectation: Expectation{Response: &api.DescribeClusterResponse{WorkspaceClasses: []*api.WorkspaceClass{}}},
		},
		{
			Name: "preferred class",
			Config: config.Configuration{
				WorkspaceClasses: map[string]*config.WorkspaceClass{
					"default": {
						Name:             "Default Workspace",
						CreditsPerMinute: 0.4,
						Container: config.ContainerConfiguration{
							Limits: &config.ResourceLimitConfiguration{
								CPU:     &config.CpuResourceLimit{BurstLimit: "10"},
								Memory:  "15G",
								Storage: "20G",
							},
						},
					},
				},
				PreferredWorkspaceClass: "default",
			},
			Expectation: Expectation{
				Response: &api.DescribeClusterResponse{
					PreferredWorkspaceClass: "default",
					WorkspaceClasses: []*api.WorkspaceClass{
						{Id: "default", DisplayName: "Default Workspace", Description: "10 vCPU, 15GB memory, 20GB disk", CreditsPerMinute: 0.4},
					},
				},
			},
		},
		{
			Name: "multiple classes",
			Config: config.Configuration{
				WorkspaceClasses: map[string]*config.WorkspaceClass{
					"xlarge": {},
					"large":  {},
				},
			},
			Expectation: Expectation{
				Response: &api.DescribeClusterResponse{
					WorkspaceClasses: []*api.WorkspaceClass{
						{Id: "large", Description: "0 vCPU, 0GB memory, 0GB disk"},
						{Id: "xlarge", Description: "0 vCPU, 0GB memory, 0GB disk"},
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

			srv := WorkspaceManagerServer{Config: &test.Config}
			resp, err := srv.DescribeCluster(context.Background(), &api.DescribeClusterRequest{})
			if err != nil {
				act.Error = err.Error()
			}
			if resp != nil {
				act.Response = resp
			}

			if diff := cmp.Diff(test.Expectation, act, cmpopts.IgnoreUnexported(api.DescribeClusterResponse{}, api.WorkspaceClass{})); diff != "" {
				t.Errorf("DescribeCluster() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
