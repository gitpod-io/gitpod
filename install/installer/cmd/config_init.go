// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
	"k8s.io/utils/pointer"
)

var configInitOpts struct {
	OverwriteConfig bool
}

// configInitCmd represents the validate command
var configInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Create a base config file",
	Long: `Create a base config file

This file contains all the credentials to install a Gitpod instance and
be saved to a repository.`,
	Example: `  # Save config to config.yaml.
gitpod-installer config init -c ./gitpod.config.yaml`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Check file isn't present
		exists, err := configFileExists()
		if err != nil {
			return err
		}
		if *exists && !configInitOpts.OverwriteConfig {
			return fmt.Errorf("file %s exists - to overwrite add --overwrite flag", configOpts.ConfigFile)
		}

		cfg, err := config.NewDefaultConfig()
		if err != nil {
			return err
		}

		return saveConfigFile(cfg)
	},
}

func configFileExists() (*bool, error) {
	if _, err := os.Stat(configOpts.ConfigFile); err == nil {
		return pointer.Bool(true), nil
	} else if errors.Is(err, os.ErrNotExist) {
		return pointer.Bool(false), nil
	} else {
		return nil, err
	}
}

func configFileExistsAndInit() (*bool, error) {
	// Check file is present
	exists, err := configFileExists()
	if err != nil {
		return nil, err
	}
	if !*exists {
		return nil, fmt.Errorf(`file %s does not exist - please run "config init"`, configOpts.ConfigFile)
	}
	return exists, nil
}

func saveConfigFile(cfg interface{}) error {
	fc, err := config.Marshal(config.CurrentVersion, cfg)
	if err != nil {
		return err
	}

	err = os.WriteFile(configOpts.ConfigFile, fc, 0644)
	if err != nil {
		return err
	}

	log.Infof("File written to %s\n", configOpts.ConfigFile)

	return nil
}

func init() {
	configCmd.AddCommand(configInitCmd)

	configInitCmd.Flags().BoolVar(&configInitOpts.OverwriteConfig, "overwrite", false, "overwrite config file if it exists")
}
