// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package harvester

import (
	"context"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	kctx "github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/gke"
)

const (
	ContextName = "harvester"

	harvesterConfigSecretName = "harvester-kubeconfig"
	werftNamespace            = "werft"
)

var (
	ErrSecretDataNotFound = errors.New("secret data not found")
)

var _ kctx.Loader = (*ConfigLoader)(nil)

type ConfigLoader struct {
	logger *logrus.Logger

	Client *k8s.Config
}

type ConfigLoaderOpts struct {
	Logger *logrus.Logger
}

func New(ctx context.Context, opts ConfigLoaderOpts) (*ConfigLoader, error) {
	client, err := k8s.NewFromDefaultConfigWithContext(opts.Logger, gke.DevContextName)
	if err != nil {
		return nil, err
	}

	return &ConfigLoader{
		logger: opts.Logger,
		Client: client,
	}, nil
}

func (k *ConfigLoader) setup() error {
	client, err := k8s.NewFromDefaultConfigWithContext(k.logger, gke.DevContextName)
	if err != nil {
		return err
	}

	k.Client = client

	return nil
}

func (k *ConfigLoader) Load(ctx context.Context) (*api.Config, error) {
	if k.Client == nil {
		if err := k.setup(); err != nil {
			return nil, err
		}
	}

	secret, err := k.Client.CoreClient.CoreV1().Secrets(werftNamespace).Get(ctx, harvesterConfigSecretName, metav1.GetOptions{})
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

	return k8s.RenameConfig(config, "default", "harvester")
}
