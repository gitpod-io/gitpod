// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

func TestPortsConfig(t *testing.T) {
	tests := []struct {
		Desc           string
		WorkspacePorts []*gitpod.PortConfig
		GitpodConfig   *gitpod.GitpodConfig
		Expectation    *PortConfigTestExpectations
	}{
		{
			Desc:        "no configs",
			Expectation: &PortConfigTestExpectations{},
		},
		{
			Desc: "workspace port config",
			WorkspacePorts: []*gitpod.PortConfig{
				{
					Port:       9229,
					OnOpen:     "ignore",
					Visibility: "public",
				},
			},
			Expectation: &PortConfigTestExpectations{
				WorkspaceConfigs: []*gitpod.PortConfig{
					{
						Port:       9229,
						OnOpen:     "ignore",
						Visibility: "public",
					},
				},
			},
		},
		{
			Desc: "instance port config",
			GitpodConfig: &gitpod.GitpodConfig{
				Ports: []*gitpod.PortsItems{
					{
						Port:       9229,
						OnOpen:     "ignore",
						Visibility: "public",
					},
				},
			},
			Expectation: &PortConfigTestExpectations{
				InstancePortConfigs: []*gitpod.PortConfig{
					{
						Port:       9229,
						OnOpen:     "ignore",
						Visibility: "public",
					},
				},
			},
		},
		{
			Desc: "instance range config",
			GitpodConfig: &gitpod.GitpodConfig{
				Ports: []*gitpod.PortsItems{
					{
						Port:       "9229-9339",
						OnOpen:     "ignore",
						Visibility: "public",
					},
				},
			},
			Expectation: &PortConfigTestExpectations{
				InstanceRangeConfigs: []*RangeConfig{
					{
						PortsItems: &gitpod.PortsItems{
							Port:       "9229-9339",
							OnOpen:     "ignore",
							Visibility: "public",
						},
						Start: 9229,
						End:   9339,
					},
				},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			configService := &testGitpodConfigService{
				configs: make(chan *gitpod.GitpodConfig),
			}
			defer close(configService.configs)

			context, cancel := context.WithCancel(context.Background())
			defer cancel()

			workspaceID := "test"

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			gitpodAPI := gitpod.NewMockAPIInterface(ctrl)
			gitpodAPI.EXPECT().GetWorkspace(context, workspaceID).Times(1).Return(&gitpod.WorkspaceInfo{
				Workspace: &gitpod.Workspace{
					Config: &gitpod.WorkspaceConfig{
						Ports: test.WorkspacePorts,
					},
				},
			}, nil)

			service := NewConfigService(workspaceID, configService, gitpodAPI)
			updates, errors := service.Observe(context)

			actual := &PortConfigTestExpectations{}
			select {
			case err := <-errors:
				t.Fatal(err)
			case change := <-updates:
				for _, config := range change.workspaceConfigs {
					actual.WorkspaceConfigs = append(actual.WorkspaceConfigs, config)
				}
			}

			if test.GitpodConfig != nil {
				go func() {
					configService.configs <- test.GitpodConfig
				}()
				select {
				case err := <-errors:
					t.Fatal(err)
				case change := <-updates:
					actual.InstanceRangeConfigs = change.instanceRangeConfigs
					for _, config := range change.instancePortConfigs {
						actual.InstancePortConfigs = append(actual.InstancePortConfigs, config)
					}
				}
			}

			if diff := cmp.Diff(test.Expectation, actual); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}

type PortConfigTestExpectations struct {
	WorkspaceConfigs     []*gitpod.PortConfig
	InstancePortConfigs  []*gitpod.PortConfig
	InstanceRangeConfigs []*RangeConfig
}

type testGitpodConfigService struct {
	configs chan *gitpod.GitpodConfig
}

func (service *testGitpodConfigService) Watch(ctx context.Context) {
}

func (service *testGitpodConfigService) Observe(ctx context.Context) <-chan *gitpod.GitpodConfig {
	return service.configs
}
