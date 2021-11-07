// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/spf13/cobra"
	"os"
	"sigs.k8s.io/yaml"
	"strings"
)

var generatorOpts struct {
	ConfigFN  string
	Namespace string
}

// generateCmd represents the generate command
var generateCmd = &cobra.Command{
	Use: "generate",
	Args: func(cmd *cobra.Command, args []string) error {
		available, err := availableGenerators()
		if err != nil {
			return err
		}

		if len(args) != 1 {
			return fmt.Errorf("generator type must be one of: %s", strings.Join(available, ", "))
		}

		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		_, _, cfg, err := loadConfig(generatorOpts.ConfigFN)
		if err != nil {
			return err
		}

		versionMF, err := getVersionManifest()
		if err != nil {
			return err
		}

		ctx, err := common.NewRenderContext(*cfg, *versionMF, renderOpts.Namespace)
		if err != nil {
			return err
		}

		generators, err := getGenerators(args[0])
		if err != nil {
			return err
		}

		objs, err := generators(ctx)
		if err != nil {
			return err
		}

		for _, o := range objs {
			fc, err := yaml.Marshal(o)
			if err != nil {
				return err
			}

			fmt.Printf("---\n%s\n", fc)
		}

		return nil
	},
}

func getGenerators(generatorType string) (common.GeneratorFunc, error) {
	generator, found := common.Generators[generatorType]
	if !found {
		return nil, fmt.Errorf("unknown generator type: %s", generatorType)
	}

	return generator, nil
}

func availableGenerators() ([]string, error) {
	available := make([]string, 0)

	for key, _ := range common.Generators {
		available = append(available, key)
	}

	return available, nil
}

func init() {
	available, _ := availableGenerators()

	generateCmd.Short = fmt.Sprintf("Generator types: %s", strings.Join(available, ", "))

	rootCmd.AddCommand(generateCmd)

	generateCmd.Flags().StringVarP(&generatorOpts.ConfigFN, "config", "c", os.Getenv("GITPOD_INSTALLER_CONFIG"), "path to the config file")
	generateCmd.Flags().StringVarP(&generatorOpts.Namespace, "namespace", "n", "default", "namespace to deploy to")
}
