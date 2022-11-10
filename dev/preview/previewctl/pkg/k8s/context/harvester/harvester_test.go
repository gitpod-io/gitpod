// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package harvester

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
)

func TestLoad(t *testing.T) {
	type expStruct struct {
		config *api.Config
		err    error
	}

	testCases := []struct {
		name     string
		objects  []runtime.Object
		expected expStruct
	}{
		{
			name: "secret not found",
			objects: []runtime.Object{
				&v1.Secret{
					ObjectMeta: metav1.ObjectMeta{
						Name:      harvesterConfigSecretName,
						Namespace: werftNamespace,
					},
					Data: map[string][]byte{},
				},
			},
			expected: expStruct{
				config: nil,
				err:    ErrSecretDataNotFound,
			},
		},
		{
			name: "harvester config",
			objects: []runtime.Object{
				&v1.Secret{
					ObjectMeta: metav1.ObjectMeta{
						Name:      harvesterConfigSecretName,
						Namespace: werftNamespace,
					},
					Data: map[string][]byte{
						"harvester-kubeconfig.yml": []byte(`
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: dGVzdF9kYXRh
    server: https://test.kube.gitpod-dev.com:6443
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
    client-key-data: dGVzdF9kYXRh`),
					},
				},
			},
			expected: expStruct{
				config: &api.Config{
					Preferences: api.Preferences{
						Extensions: map[string]runtime.Object{},
					},
					Contexts: map[string]*api.Context{
						"harvester": {
							Cluster:    "harvester",
							AuthInfo:   "harvester",
							Extensions: map[string]runtime.Object{},
						},
					},
					Clusters: map[string]*api.Cluster{
						"harvester": {
							LocationOfOrigin:         "",
							Server:                   "https://test.kube.gitpod-dev.com:6443",
							CertificateAuthorityData: []byte("test_data"),
							Extensions:               map[string]runtime.Object{},
						},
					},
					CurrentContext: "harvester",
					AuthInfos: map[string]*api.AuthInfo{
						"harvester": {
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
			c := &ConfigLoader{
				Client: &k8s.Config{CoreClient: fake.NewSimpleClientset(test.objects...)},
			}

			config, err := c.Load(context.TODO())

			assert.ErrorIs(t, test.expected.err, err)
			assert.Equal(t, test.expected.config, config)
		})
	}
}
