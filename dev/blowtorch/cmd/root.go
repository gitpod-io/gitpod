// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "blowtorch",
	Short: "blowtorch helps using toxiproxy to create network chaos in your k8s application",
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	hd, err := os.UserHomeDir()
	if err != nil {
		log.WithError(err).Warn("cannot determine user home dir")
	}
	rootCmd.PersistentFlags().String("kubeconfig", filepath.Join(hd, ".kube", "config"), "path to the kubeconfig file (defaults to $HOME/.kube/config)")

	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}

func getKubeconfig() (res *rest.Config, namespace string, err error) {
	kubeconfig, err := rootCmd.PersistentFlags().GetString("kubeconfig")
	if err != nil {
		return nil, "", err
	}

	if kubeconfig == "$HOME/.kube/config" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, "", err
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfig},
		&clientcmd.ConfigOverrides{},
	)
	namespace, _, err = cfg.Namespace()
	if err != nil {
		return nil, "", err
	}

	res, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, namespace, err
	}

	return res, namespace, nil
}
