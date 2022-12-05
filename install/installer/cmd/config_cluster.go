// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

var configClusterOpts struct {
	Kube            kubeConfig
	Namespace       string
	EnsureNamespace bool
}

// configClusterCmd represents the validate command
var configClusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Perform configuration tasks against the cluster",
	Long: `Perform configuration tasks against the cluster

These will be deployed and run as Kubernetes resources.`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		log.Debugf("EnsureNamespace: %t", configClusterOpts.EnsureNamespace)

		if !configClusterOpts.EnsureNamespace {
			return nil
		}

		log.Infof("Ensuring namespace exists %s", configClusterOpts.Namespace)
		_, clientset, err := authClusterOrKubeconfig(configClusterOpts.Kube.Config)
		if err != nil {
			return err
		}

		_, err = clientset.CoreV1().Namespaces().Create(
			context.TODO(),
			&v1.Namespace{
				ObjectMeta: metav1.ObjectMeta{
					Name: configClusterOpts.Namespace,
				},
			},
			metav1.CreateOptions{},
		)

		if errors.IsAlreadyExists(err) {
			log.Debug("Namespace already exists")
			return nil
		}

		return err
	},
}

func init() {
	configCmd.AddCommand(configClusterCmd)

	configClusterCmd.Flags().StringVar(&configClusterOpts.Kube.Config, "kubeconfig", filepath.Join(homedir.HomeDir(), ".kube", "config"), "path to the kubeconfig file")
	configClusterCmd.PersistentFlags().StringVarP(&configClusterOpts.Namespace, "namespace", "n", getEnvvar("NAMESPACE", "default"), "namespace to deploy to")
	configClusterCmd.PersistentFlags().BoolVar(&configClusterOpts.EnsureNamespace, "ensure-namespace", true, "ensure that the namespace exists")
}

func authClusterOrKubeconfig(kubeconfig string) (*rest.Config, *kubernetes.Clientset, error) {
	// Try authenticating in-cluster with serviceaccount
	log.Debug("Attempting to authenticate with ServiceAccount")
	config, err := rest.InClusterConfig()
	if err != nil {
		// Try authenticating out-of-cluster with kubeconfig
		log.Debug("ServiceAccount failed - using KubeConfig")
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, nil, err
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, nil, err
	}

	return config, clientset, nil
}
