// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dockerregistry

import (
	"encoding/base64"
	"encoding/json"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/kubectl/pkg/cmd/create"
)

func secret(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !*ctx.Config.ContainerRegistry.InCluster {
		return nil, nil
	}

	user, err := common.RandomString(20)
	if err != nil {
		return nil, err
	}

	password, err := common.RandomString(20)
	if err != nil {
		return nil, err
	}

	// todo(sje): handle if bypassing registry with proxy
	registryHost := "registry." + ctx.Config.Domain

	config, err := json.Marshal(create.DockerConfigJSON{
		Auths: map[string]create.DockerConfigEntry{
			registryHost: {
				Auth: base64.StdEncoding.EncodeToString([]byte(user + ":" + password)),
			},
		},
	})
	if err != nil {
		return nil, err
	}

	return []runtime.Object{&corev1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      BuiltInRegistrySecret,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Type: corev1.SecretTypeDockerConfigJson,
		Data: map[string][]byte{
			".dockerconfigjson": config,
			"user":              []byte(user),
			"password":          []byte(password),
		},
	}}, nil
}
