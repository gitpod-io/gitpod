// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var validateClusterOpts struct {
	Kube   kubeConfig
	Config string
}

// validateClusterCmd represents the cluster command
var validateClusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Validate the cluster setup",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkKubeConfig(&validateClusterOpts.Kube); err != nil {
			return err
		}

		clientcfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
			&clientcmd.ClientConfigLoadingRules{ExplicitPath: validateClusterOpts.Kube.Config},
			&clientcmd.ConfigOverrides{},
		)
		res, err := clientcfg.ClientConfig()
		if err != nil {
			return err
		}
		namespace, _, err := clientcfg.Namespace()
		if err != nil {
			return err
		}

		result, err := cluster.ClusterChecks.Validate(context.Background(), res, namespace)
		if err != nil {
			return err
		}

		if validateClusterOpts.Config != "" {
			res, err := runClusterConfigValidation(context.Background(), res, namespace)
			if err != nil {
				return err
			}

			// Update the status
			switch res.Status {
			case cluster.ValidationStatusError:
				// Always change the status if error
				result.Status = cluster.ValidationStatusError
			case cluster.ValidationStatusWarning:
				// Only put to warning if status is ok
				if result.Status == cluster.ValidationStatusOk {
					result.Status = cluster.ValidationStatusWarning
				}
			}

			result.Items = append(result.Items, res.Items...)
		}

		jsonOut, err := json.MarshalIndent(result, "", "  ")
		if err != nil {
			return err
		}
		out := fmt.Sprintf("%s\n", string(jsonOut))

		if result.Status == cluster.ValidationStatusError {
			// Warnings are treated as valid
			_, err := fmt.Fprintln(os.Stderr, out)
			if err != nil {
				return err
			}
			os.Exit(1)
		}

		fmt.Printf(out)
		return nil
	},
}

func runClusterConfigValidation(ctx context.Context, restConfig *rest.Config, namespace string) (*cluster.ValidationResult, error) {
	_, version, cfg, err := loadConfig(validateClusterOpts.Config)
	if err != nil {
		return nil, err
	}
	apiVersion, err := config.LoadConfigVersion(version)
	if err != nil {
		return nil, err
	}
	return apiVersion.ClusterValidation(cfg).Validate(ctx, restConfig, namespace)
}

func init() {
	validateCmd.AddCommand(validateClusterCmd)

	validateClusterCmd.PersistentFlags().StringVar(&validateClusterOpts.Kube.Config, "kubeconfig", "", "path to the kubeconfig file")
	validateClusterCmd.PersistentFlags().StringVarP(&validateClusterOpts.Config, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
}
