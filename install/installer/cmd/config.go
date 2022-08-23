// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var configOpts struct {
	ConfigFile string
}

// configCmd represents the validate command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Perform configuration tasks",
}

func init() {
	rootCmd.AddCommand(configCmd)

	dir, err := os.Getwd()
	if err != nil {
		log.WithError(err).Fatal("Failed to get working directory")
	}

	configCmd.PersistentFlags().StringVarP(&configOpts.ConfigFile, "config", "c", getEnvvar("CONFIG_FILE", filepath.Join(dir, "gitpod.config.yaml")), "path to the configuration file")
}
