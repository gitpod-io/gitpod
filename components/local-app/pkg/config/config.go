// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

func GetConfigFileDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	configurationDir := filepath.Join(homeDir)

	return configurationDir, nil
}

func GetConfigFilePath(configurationDir string) string {
	configFile := filepath.Join(configurationDir, ".gp-cli.json")
	return configFile
}

// init initializes viper which reads in configuration files/environment variables
func init() {
	configDir, err := GetConfigFileDir()
	if err != nil {
		slog.Debug("Could not retrieve config file path", "err", err)
	}

	configFile := GetConfigFilePath(configDir)

	viper.SetConfigName(".gp-cli")
	viper.SetConfigType("json")
	viper.AddConfigPath(configDir)

	viper.SetEnvPrefix("gitpod")
	viper.AutomaticEnv()

	viper.SetDefault("host", "gitpod.io")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			slog.Debug("Config file not found", "path", configFile)
		} else {
			slog.Warn("Failed to read config file", "err", err)
		}
	}
}

func CreateConfigFile() error {
	configDir, err := GetConfigFileDir()
	if err != nil {
		slog.Error("Could not retrieve config file path", "err", err)
		return err
	}

	configFile := GetConfigFilePath(configDir)

	viper.SetConfigName(".gp-cli")
	viper.SetConfigType("json")
	viper.AddConfigPath(configDir)

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found; create and write a new one
			if err := os.MkdirAll(configDir, os.ModePerm); err != nil {
				return fmt.Errorf("Failed to create config directory: %w", err)
			}
			err = viper.SafeWriteConfigAs(configFile)
			if err != nil {
				return fmt.Errorf("Failed to write config file: %w", err)
			}
			slog.Info("Config file created", "path", configFile)
		} else {
			// Config file was found but another error was produced
			return fmt.Errorf("Failed to read config file: %w", err)
		}
	}

	return nil
}

func GetGitpodUrl() string {
	host := GetString("host")
	return fmt.Sprintf("https://%s", host)
}

func GetOrganizationId() string {
	return GetString("org_id")
}

func Set(key string, value interface{}) error {
	viper.Set(key, value)
	return viper.WriteConfig()
}

func Get(key string) interface{} {
	return viper.Get(key)
}

func GetString(key string) string {
	return viper.GetString(key)
}
