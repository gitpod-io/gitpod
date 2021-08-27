package cmd

import (
	"fmt"

	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/spf13/cobra"
	"sigs.k8s.io/yaml"
)

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initializes a config file",
	Run: func(cmd *cobra.Command, args []string) {
		var cfg config.Config
		fc, err := yaml.Marshal(cfg)
		if err != nil {
			panic(err)
		}

		fmt.Print(string(fc))
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
