// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	_ "embed"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/spf13/cobra"
	"sigs.k8s.io/yaml"
)

var renderOpts struct {
	ConfigFN  string
	Namespace string
}

//go:embed versions.yaml
var versionManifest []byte

// renderCmd represents the render command
var renderCmd = &cobra.Command{
	Use:   "render",
	Short: "Renders the Kubernetes manifests required to install Gitpod",
	Long: `Renders the Kubernetes manifests required to install Gitpod

A config file is required which can be generated with the init command.`,
	Example: `  # Default install.
  gitpod-installer render --config config.yaml | kubectl apply -f -

  # Install Gitpod into a non-default namespace.
  gitpod-installer render --config config.yaml --namespace gitpod | kubectl apply -f -`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfgFN, _ := cmd.PersistentFlags().GetString("config")

		rawCfg, cfgVersion, err := config.Load(cfgFN)
		if err != nil {
			return fmt.Errorf("error loading config: %w", err)
		}
		if cfgVersion != config.CurrentVersion {
			return fmt.Errorf("config version is mismatch: expected %s, got %s", config.CurrentVersion, cfgVersion)
		}
		cfg := rawCfg.(*configv1.Config)

		var versionMF versions.Manifest
		err = yaml.Unmarshal(versionManifest, &versionMF)
		if err != nil {
			return err
		}

		namespace, _ := cmd.PersistentFlags().GetString("namespace")

		ctx := &common.RenderContext{
			Config:          *cfg,
			VersionManifest: versionMF,
			Namespace:       namespace,
		}

		var renderable common.RenderFunc
		switch cfg.Kind {
		case configv1.InstallationFull:
			renderable = components.FullObjects
		case configv1.InstallationMeta:
			renderable = components.MetaObjects
		case configv1.InstallationWorkspace:
			renderable = components.WorkspaceObjects
		default:
			return fmt.Errorf("unsupported installation kind: %s", cfg.Kind)
		}

		objs, err := renderable(ctx)
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

		return nil
	},
}

func init() {
	rootCmd.AddCommand(renderCmd)

	renderCmd.PersistentFlags().StringVarP(&renderOpts.ConfigFN, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
	renderCmd.PersistentFlags().StringVarP(&renderOpts.Namespace, "namespace", "n", "default", "namespace to deploy to")
}
