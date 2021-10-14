// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"github.com/spf13/cobra"
	"helm.sh/helm/v3/pkg/cli/values"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/yaml"
)

var certManagerOpts struct {
	Namespace string
}

// create the namespace
var certManKubeObjs = common.CompositeRenderFunc(
	func(_ *common.RenderContext) ([]runtime.Object, error) {
		return common.CreateNamespace(certManagerOpts.Namespace)
	},
)

var cerManHelmCharts = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.CertManager(), helm.TemplateConfig{
		Namespace: certManagerOpts.Namespace,
	}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		return &common.HelmConfig{
			Enabled: true,
			Values: &values.Options{
				Values: []string{
					"installCRDs=true",
					"extraArgs={--dns01-recursive-nameservers-only=true,--dns01-recursive-nameservers=8.8.8.8:53\\,1.1.1.1:53}",
				},
			},
		}, nil
	}),
)

// certManagerCmd represents the certManager command
var certManagerCmd = &cobra.Command{
	Use:   "cert-manager",
	Short: "Install Cert Manager to your cluster",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := &common.RenderContext{
			Namespace: certManagerOpts.Namespace,
		}

		objs, err := certManKubeObjs(ctx)
		if err != nil {
			return err
		}

		charts, err := cerManHelmCharts(ctx)
		if err != nil {
			return err
		}

		for _, o := range objs {
			fc, err := yaml.Marshal(o)
			if err != nil {
				return err
			}

			fmt.Printf("---\n%s\n", string(fc))
		}

		for _, c := range charts {
			fmt.Printf("---\n%s\n", c)
		}

		return nil
	},
}

func init() {
	dependencyCmd.AddCommand(certManagerCmd)

	certManagerCmd.PersistentFlags().StringVarP(&certManagerOpts.Namespace, "namespace", "n", "cert-manager", "namespace to deploy to")
}
