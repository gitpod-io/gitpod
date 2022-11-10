// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"path/filepath"

	"github.com/cockroachdb/errors"
	kctx "github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/gke"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context/harvester"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/util/homedir"

	kube "github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
)

var (
	DefaultKubeConfigPath = filepath.Join(homedir.HomeDir(), clientcmd.RecommendedHomeDir, clientcmd.RecommendedFileName)
)

const (
	coreDevClusterName = "core-dev"
	coreDevProjectID   = "gitpod-core-dev"
	coreDevClusterZone = "europe-west1-b"
)

type getCredentialsOpts struct {
	logger *logrus.Logger

	serviceAccountPath string
	kubeConfigSavePath string
}

func newGetCredentialsCommand(logger *logrus.Logger) *cobra.Command {
	ctx := context.Background()
	opts := &getCredentialsOpts{
		logger: logger,
	}

	cmd := &cobra.Command{
		Use: "get-credentials",
		Long: `previewctl get-credentials retrieves the kubernetes configs for core-dev and harvester clusters,
merges them with the default config, and saves them to the path in KUBECONFIG or the default path '~/.kube/config'"`,
		RunE: func(cmd *cobra.Command, args []string) error {
			configs, err := opts.getCredentials(ctx)
			if err != nil {
				return err
			}

			opts.kubeConfigSavePath = getKubeConfigPath()
			return kube.OutputContext(opts.kubeConfigSavePath, configs)
		},
	}

	cmd.PersistentFlags().StringVar(&opts.serviceAccountPath, "gcp-service-account", "", "path to the GCP service account to use")

	return cmd
}

func (o *getCredentialsOpts) getCredentials(ctx context.Context) (*api.Config, error) {
	gkeLoader, err := gke.New(ctx, gke.ConfigLoaderOpts{
		Logger:             o.logger,
		ServiceAccountPath: o.serviceAccountPath,
		Name:               coreDevClusterName,
		ProjectID:          coreDevProjectID,
		Zone:               coreDevClusterZone,
		RenamedContextName: gke.DevContextName,
	})

	if err != nil {
		return nil, errors.Wrap(err, "failed to instantiate gke loader")
	}

	loaderMap := map[string]kctx.Loader{
		gke.DevContextName:    gkeLoader,
		harvester.ContextName: &harvester.ConfigLoader{},
	}

	for _, contextName := range []string{gke.DevContextName, harvester.ContextName} {
		loader := loaderMap[contextName]
		if kc, err := kube.NewFromDefaultConfigWithContext(o.logger, contextName); err == nil && kc.HasAccess(ctx) {
			continue
		}

		kc, err := loader.Load(ctx)
		if err != nil {
			return nil, err
		}

		configs, err := kube.MergeContextsWithDefault(kc)
		if err != nil {
			return nil, err
		}

		// always save the context at the default path
		err = kube.OutputContext(DefaultKubeConfigPath, configs)
		if err != nil {
			return nil, err
		}
	}

	return kube.MergeContextsWithDefault()
}

func hasAccess(ctx context.Context, logger *logrus.Logger, contextName string) bool {
	config, err := kube.NewFromDefaultConfigWithContext(logger, contextName)
	if err != nil {
		if errors.Is(err, kube.ErrContextNotExists) {
			return false
		}

		logger.Fatal(err)
	}

	return config.HasAccess(ctx)
}

func getKubeConfigPath() string {
	if v := os.Getenv("KUBECONFIG"); v != "" {
		DefaultKubeConfigPath = v
	}

	return DefaultKubeConfigPath
}
