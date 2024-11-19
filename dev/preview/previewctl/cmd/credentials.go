// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"path/filepath"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"

	kube "github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
)

var (
	DefaultKubeConfigPath = filepath.Join(homedir.HomeDir(), clientcmd.RecommendedHomeDir, clientcmd.RecommendedFileName)
)

func hasAccess(ctx context.Context, logger *logrus.Logger, contextName string) bool {
	config, err := kube.NewFromDefaultConfigWithContext(logger, contextName)
	if err != nil {
		if errors.Is(err, kube.ErrContextNotExists) {
			logger.Error(err)
			return false
		}

		logger.Fatal(err)
	}

	return config.HasAccess(ctx)
}

func getKubeConfigPath() string {
	if v := viper.GetString("KUBECONFIG"); v != "" {
		DefaultKubeConfigPath = v
	}

	return DefaultKubeConfigPath
}
