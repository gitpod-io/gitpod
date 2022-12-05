// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/installer/pkg/config"
	"github.com/spf13/cobra"
	"k8s.io/utils/pointer"
)

var configOpts struct {
	ConfigFile string
}

// configCmd represents the validate command
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Perform configuration tasks",
}

// configFileExists checks if the configuration file is present on disk
func configFileExists() (*bool, error) {
	if _, err := os.Stat(configOpts.ConfigFile); err == nil {
		return pointer.Bool(true), nil
	} else if errors.Is(err, os.ErrNotExist) {
		return pointer.Bool(false), nil
	} else {
		return nil, err
	}
}

// configFileExistsAndInit checks if the config file exists, if not it returns a "run config init" error
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

// saveConfigFile converts the config to YAML and saves to disk
func saveConfigFile(cfg interface{}) error {
	fc, err := config.Marshal(config.CurrentVersion, cfg)
	if err != nil {
		return err
	}

	err = os.WriteFile(configOpts.ConfigFile, fc, 0644)
	if err != nil {
		return err
	}

	log.Infof("File written to %s", configOpts.ConfigFile)

	return nil
}

func init() {
	rootCmd.AddCommand(configCmd)

	dir, err := os.Getwd()
	if err != nil {
		log.WithError(err).Fatal("Failed to get working directory")
	}

	configCmd.PersistentFlags().StringVarP(&configOpts.ConfigFile, "config", "c", getEnvvar("GITPOD_INSTALLER_CONFIG", filepath.Join(dir, "gitpod.config.yaml")), "path to the configuration file")
}
