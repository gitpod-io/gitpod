// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path"

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/spf13/cobra"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// clustersGetTlsConfigCmd is the "clusters get-tls-config" cmd
var clustersGetTlsConfigCmd = &cobra.Command{
	Use:   "get-tls-config",
	Short: "Fetches ws-manager TLS config and stores them in a local folder",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		cfg, namespace, err := getKubeconfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get kubeconfig")
		}
		clientSet, err := kubernetes.NewForConfig(cfg)
		if err != nil {
			log.WithError(err).Fatal("cannot create clientset")
		}

		namespaceOverride, err := cmd.Flags().GetString("namespace")
		if err != nil {
			log.Fatal(err)
		}
		if namespaceOverride != "" {
			namespace = namespaceOverride
		}

		secretName, err := cmd.Flags().GetString("secretName")
		if err != nil {
			log.Fatal(err)
		}

		tlsPath, err := cmd.Flags().GetString("tls-path")
		if err != nil {
			log.Fatal(err)
		}

		secret, err := clientSet.CoreV1().Secrets(namespace).Get(ctx, secretName, metav1.GetOptions{})
		if err != nil {
			log.Fatal(err)
		}

		if _, err := os.Stat(tlsPath); os.IsNotExist(err) {
			err = os.Mkdir(tlsPath, 0744)
			if err != nil {
				log.Fatal(err)
			}
		}
		writeFileFromSecretData := func(filename string) {
			filepath := path.Join(tlsPath, filename)
			data := secret.Data[filename]
			err = ioutil.WriteFile(filepath, data, 0744)
			if err != nil {
				log.Fatal(err)
			}
		}
		writeFileFromSecretData("ca.crt")
		writeFileFromSecretData("tls.crt")
		writeFileFromSecretData("tls.key")

		fmt.Printf("wrote ws-manager TLS config to: %s\n", tlsPath)
	},
}

func init() {
	clustersGetTlsConfigCmd.Flags().String("secretName", "ws-manager-client-tls", "secret name")
	clustersGetTlsConfigCmd.Flags().String("namespace", "", "override the namespace in the current kubectx")
	clustersGetTlsConfigCmd.Flags().String("tls-path", "./wsman-tls", "folder to write the secrets to")

	clustersCmd.AddCommand(clustersGetTlsConfigCmd)
}
