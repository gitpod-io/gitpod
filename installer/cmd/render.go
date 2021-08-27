package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/components"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/spf13/cobra"
	"sigs.k8s.io/yaml"
)

var renderOpts struct {
	ConfigFN string
}

// renderCmd represents the render command
var renderCmd = &cobra.Command{
	Use:   "render",
	Short: "Renders the Kubernetes manifests required to install Gitpod",

	RunE: func(cmd *cobra.Command, args []string) error {
		cfgFN, _ := cmd.PersistentFlags().GetString("config")
		cfg, err := config.Load(cfgFN)
		if err != nil {
			return err
		}

		f, err := components.Objects.Render(cfg)
		if err != nil {
			return err
		}

		for _, o := range f {
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
