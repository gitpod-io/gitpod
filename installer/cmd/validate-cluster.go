// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/spf13/cobra"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

var validateClusterOpts struct {
	Kube kubeConfig
}

// validateClusterCmd represents the cluster command
var validateClusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Validate the cluster configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkKubeConfig(&validateClusterOpts.Kube); err != nil {
			return err
		}

		res, err := clientcmd.BuildConfigFromFlags("", validateClusterOpts.Kube.Config)
		if err != nil {
			return err
		}

		clientset, err := kubernetes.NewForConfig(res)
		if err != nil {
			return err
		}

		result, err := cluster.Validate(clientset, res)
		if err != nil {
			return err
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

func init() {
	validateCmd.AddCommand(validateClusterCmd)

	validateClusterCmd.PersistentFlags().StringVar(&validateClusterOpts.Kube.Config, "kubeconfig", "", "Path to the kubeconfig file")
}
