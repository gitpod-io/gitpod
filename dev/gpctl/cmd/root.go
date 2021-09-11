// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	homedir "github.com/mitchellh/go-homedir"
	"github.com/spf13/cobra"
	"k8s.io/client-go/rest"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gpctl/pkg/prettyprint"
	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "gpctl",
	Short: "Gpctl controls a Gitpod installation",
	Args:  cobra.MinimumNArgs(1),
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	common_grpc.SetupLogging()

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringP("kubeconfig", "c", "$HOME/.kube/config", "Path to the kubeconfig file used for connecting to the cluster")

	rootCmd.PersistentFlags().StringP("output-format", "o", "template", "Output format. One of: string|json|jsonpath|template")
	rootCmd.PersistentFlags().String("output-template", "", "Output format Go template or jsonpath. Use with -o template or -o jsonpath")
}

func getKubeconfig() (*rest.Config, string, error) {
	kubeconfig, err := rootCmd.PersistentFlags().GetString("kubeconfig")
	if err != nil {
		return nil, "", err
	}

	if kubeconfig == "$HOME/.kube/config" {
		home, err := homedir.Dir()
		if err != nil {
			return nil, "", err
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	return util.GetKubeconfig(kubeconfig)
}

func getOutputFormat(defaultTemplate string, defaultJsonpath string) *prettyprint.Printer {
	format := prettyprint.TemplateFormat
	template := defaultTemplate
	jsonpath := defaultJsonpath
	if rootCmd.PersistentFlags().Lookup("output-format").Changed {
		fm, _ := rootCmd.PersistentFlags().GetString("output-format")
		switch fm {
		case "json":
			format = prettyprint.JSONFormat
		case "string":
			format = prettyprint.StringFormat
		case "template":
			format = prettyprint.TemplateFormat
		case "jsonpath":
			format = prettyprint.JSONPathFormat
			template = jsonpath
		default:
			log.WithField("format", fm).Warn("Unknown format, falling back to template")
		}
	}
	if rootCmd.PersistentFlags().Lookup("output-template").Changed {
		template, _ = rootCmd.PersistentFlags().GetString("output-template")
	}

	return &prettyprint.Printer{
		Template: template,
		Format:   format,
		Writer:   os.Stdout,
	}
}
