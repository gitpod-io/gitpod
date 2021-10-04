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
)

var renderOpts struct {
	ConfigFN  string
	Namespace string
}

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

		versionManifest, err := versions.GetManifest()
		if err != nil {
			return err
		}

		namespace, err := cmd.Root().PersistentFlags().GetString("namespace")
		if err != nil {
			return err
		}

		ctx := &common.RenderContext{
			Config:          *cfg,
			VersionManifest: *versionManifest,
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

		rendered, err := common.RenderToYaml(ctx, renderable)
		if err != nil {
			return err
		}

		fmt.Printf("%s\n", rendered)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(renderCmd)

	renderCmd.PersistentFlags().StringVarP(&renderOpts.ConfigFN, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
}
