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
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/yaml"
)

var renderOpts struct {
	ConfigFN string
}

//go:embed versions.yaml
var versionManifest []byte

// renderCmd represents the render command
var renderCmd = &cobra.Command{
	Use:   "render",
	Short: "Renders the Kubernetes manifests required to install Gitpod",

	RunE: func(cmd *cobra.Command, args []string) error {
		cfgFN, _ := cmd.PersistentFlags().GetString("config")
		cfg, err := config.Load(cfgFN)
		if err != nil {
			return fmt.Errorf("error loading config: %w", err)
		}

		var versionMF versions.Manifest
		err = yaml.Unmarshal(versionManifest, &versionMF)
		if err != nil {
			return err
		}

		ctx := &common.RenderContext{
			Config:          *cfg,
			VersionManifest: versionMF,
		}

		var renderable []common.Renderable
		switch cfg.Kind {
		case config.InstallationFull:
			renderable = []common.Renderable{components.MetaObjects, components.WorkspaceObjects}
		case config.InstallationMeta:
			renderable = []common.Renderable{components.MetaObjects}
		case config.InstallationWorkspace:
			renderable = []common.Renderable{components.WorkspaceObjects}
		default:
			return fmt.Errorf("unsupported installation kind: %s", cfg.Kind)
		}

		var objs []runtime.Object
		for _, r := range renderable {
			o, err := r.Render(ctx)
			if err != nil {
				return err
			}
			objs = append(objs, o...)
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
}
