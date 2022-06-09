// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/rungp/pkg/builder"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "rungp",
	Short: "start a local dev-environment using a .gitpdod.yaml file",
}

var rootOpts struct {
	Workdir      string
	GitpodYamlFN string
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	wd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	rootCmd.PersistentFlags().StringVarP(&rootOpts.Workdir, "workdir", "w", wd, "Path to the working directory")
	rootCmd.PersistentFlags().StringVarP(&rootOpts.GitpodYamlFN, "gitpod-yaml", "f", ".gitpod.yml", "path to the .gitpod.yml file relative to the working directory")
}

func getConfig() (*gitpod.GitpodConfig, error) {
	fn := filepath.Join(rootOpts.Workdir, rootOpts.GitpodYamlFN)
	fc, err := ioutil.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg gitpod.GitpodConfig
	err = yaml.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, fmt.Errorf("unmarshal .gitpod.yml file failed: %v", err)
	}

	return &cfg, nil
}

func getBuilder(workdir string) (builder.Builder, error) {
	return &builder.DockerBuilder{
		Workdir: workdir,
		Images:  builder.DefaultImages,
	}, nil
}
