// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gke

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/api/container/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/gcloud"
)

func Test_Load(t *testing.T) {
	type expStruct struct {
		config *api.Config
		err    error
	}

	type testCase struct {
		name     string
		client   *mockGetClusterClient
		expected *expStruct
	}

	testCases := []testCase{
		{
			name: "Get config",
			client: &mockGetClusterClient{
				cert: "dGVzdF9kYXRh",
			},
			expected: &expStruct{
				config: &api.Config{
					APIVersion: "v1",
					Kind:       "Config",
					Contexts: map[string]*api.Context{
						DevContextName: {
							Cluster:  DevContextName,
							AuthInfo: DevContextName,
						},
					},
					Clusters: map[string]*api.Cluster{
						DevContextName: {
							CertificateAuthorityData: []byte("test_data"),
							Server:                   "https://test",
						},
					},
					AuthInfos: map[string]*api.AuthInfo{
						DevContextName: {
							Exec: &api.ExecConfig{
								Command:    "gke-gcloud-auth-plugin",
								APIVersion: "client.authentication.k8s.io/v1beta1",
								InstallHint: `Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke`,
								ProvideClusterInfo: true,
								InteractiveMode:    api.IfAvailableExecInteractiveMode,
							},
						},
					},
				},
				err: nil,
			},
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			k := &ConfigLoader{
				Client: test.client,
				Opts: ConfigLoaderOpts{
					Name:               "test",
					RenamedContextName: DevContextName,
				},
			}

			config, err := k.Load(context.TODO())

			assert.ErrorIs(t, test.expected.err, err)
			assert.Equal(t, test.expected.config, config)
		})
	}
}

type mockGetClusterClient struct {
	gcloud.Client

	cert string
}

func (m *mockGetClusterClient) GetCluster(ctx context.Context, name, projectID, zone string) (*container.Cluster, error) {
	return &container.Cluster{
		MasterAuth: &container.MasterAuth{
			ClusterCaCertificate: m.cert,
		},
		Endpoint: name,
	}, nil
}
