// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"context"

	"github.com/cockroachdb/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

var (
	ErrSecretDataNotFound = errors.New("secret data not found")
)

const (
	harvesterConfigSecretName = "harvester-kubeconfig"
	werftNamespace            = "werft"
)

func (c *Config) GetHarvesterKubeConfig(ctx context.Context) (*api.Config, error) {
	secret, err := c.coreClient.CoreV1().Secrets(werftNamespace).Get(ctx, harvesterConfigSecretName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	if _, ok := secret.Data["harvester-kubeconfig.yml"]; !ok {
		return nil, ErrSecretDataNotFound
	}

	config, err := clientcmd.Load(secret.Data["harvester-kubeconfig.yml"])
	if err != nil {
		return nil, err
	}

	return RenameContext(config, "default", "harvester")
}
