// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"os"
	"text/template"

	_ "embed"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/spf13/cobra"
)

//go:embed cellconfig/*
var configTemplates embed.FS

var renderCellOpts struct {
	Template   string
	ConfigOnly bool
}

// renderCmd represents the render command
var renderCellCmd = &cobra.Command{
	Use:   "render-cell",
	Short: "Renders the Kubernetes manifests required to install Gitpod in a Dedicated cell",
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		tpl := template.New("installer-config.yaml").Delims("[[", "]]")
		tpl, err := tpl.ParseFS(configTemplates, "cellconfig/*")
		if err != nil {
			return fmt.Errorf("cannot parse installer config template: %w", err)
		}

		tplCfg, err := io.ReadAll(os.Stdin)
		if err != nil {
			return fmt.Errorf("cannot load config template parameter from STDIN: %w", err)
		}
		rawCfg, cfgVersion, err := config.Load(string(tplCfg), rootOpts.StrictConfigParse)
		if err != nil {
			return fmt.Errorf("error loading config: %w", err)
		}
		if cfgVersion != "cell/v1" {
			return fmt.Errorf("unsupported config version: expected cell/v1, got %s", cfgVersion)
		}

		buf := bytes.NewBuffer(nil)
		err = tpl.ExecuteTemplate(buf, renderCellOpts.Template+".yaml", rawCfg)
		if err != nil {
			return fmt.Errorf("cannot render config template %s: %w", renderCellOpts.Template, err)
		}
		if renderCellOpts.ConfigOnly {
			fmt.Println(buf.String())
			return nil
		}

		actualConfig, cfgVersion, err := config.Load(buf.String(), true)
		if err != nil {
			return fmt.Errorf("config template produced invalid config: %w", err)
		}
		if cfgVersion != config.CurrentVersion {
			return fmt.Errorf("config template version is mismatch: expected %s, got %s", config.CurrentVersion, cfgVersion)
		}

		yaml, err := renderKubernetesObjects(cfgVersion, actualConfig.(*configv1.Config))
		if err != nil {
			return err
		}

		err = saveYamlToFiles(".", yaml)
		if err != nil {
			return err
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(renderCellCmd)

	renderCellCmd.PersistentFlags().BoolVar(&renderCellOpts.ConfigOnly, "debug-config", false, "only render the config to stdout, not the kubernetes yaml")
	renderCellCmd.PersistentFlags().StringVar(&renderCellOpts.Template, "template", "", "cell template to use - either workspace or meta")
	_ = renderCellCmd.MarkFlagRequired("template")
}
