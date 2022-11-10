// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k3s

import (
	"context"
	"testing"

	"github.com/cockroachdb/errors"
	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd/api"

	pssh "github.com/gitpod-io/gitpod/previewctl/pkg/ssh"
)

func Test_LoadK3SConfig(t *testing.T) {
	type k3sExpStruct struct {
		config *api.Config
		err    error
	}
	type testCase struct {
		name     string
		cmd      pssh.MockCmd
		expected *k3sExpStruct
	}

	testCases := []testCase{
		{
			name: "k3s config not found",
			cmd: pssh.MockCmd{
				CMD:    catK3sConfigCmd,
				STDOUT: []byte(""),
				STDERR: []byte("cat: /etc/rancher/k3s/k3s.yaml: No such file or directory"),
				Err:    errors.New("some error that will be irrelevant"),
			},
			expected: &k3sExpStruct{
				config: nil,
				err:    ErrK3SConfigNotFound,
			},
		},
		{
			name: "returned config",
			cmd: pssh.MockCmd{
				CMD: catK3sConfigCmd,
				STDOUT: []byte(`
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: dGVzdF9kYXRh
    server: https://default.kube.gitpod-dev.com:6443
  name: default
contexts:
- context:
    cluster: default
    user: default
  name: default
current-context: default
kind: Config
preferences: {}
users:
- name: default
  user:
    client-certificate-data: dGVzdF9kYXRh
    client-key-data: dGVzdF9kYXRh
`),
				STDERR: nil,
				Err:    nil,
			},
			expected: &k3sExpStruct{
				config: &api.Config{
					Preferences: api.Preferences{
						Extensions: map[string]runtime.Object{},
					},
					Contexts: map[string]*api.Context{
						"k3s": {
							Cluster:    "k3s",
							AuthInfo:   "k3s",
							Extensions: map[string]runtime.Object{},
						},
					},
					Clusters: map[string]*api.Cluster{
						"k3s": {
							Server:                   "https://k3s.kube.gitpod-dev.com:6443",
							CertificateAuthorityData: []byte("test_data"),
							Extensions:               map[string]runtime.Object{},
						},
					},
					CurrentContext: "k3s",
					AuthInfos: map[string]*api.AuthInfo{
						"k3s": {
							ClientCertificateData: []byte("test_data"),
							ClientKeyData:         []byte("test_data"),
							Extensions:            map[string]runtime.Object{},
						},
					},
					Extensions: map[string]runtime.Object{},
				},
				err: nil,
			},
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			c := &pssh.MockClient{Command: test.cmd}
			k := &ConfigLoader{client: c, opts: ConfigLoaderOpts{
				PreviewName: "k3s",
			}}

			config, err := k.Load(context.TODO())

			assert.ErrorIs(t, test.expected.err, err)
			assert.Equal(t, test.expected.config, config)
		})
	}
}
