// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Init initializes viper which reads in configuration files/environment variables
func Init() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		panic(err)
	}

	configPath := filepath.Join(homeDir)
	configFile := filepath.Join(configPath, ".gp-cli.json")

	viper.SetConfigName(".gp-cli")
	viper.SetConfigType("json")
	viper.AddConfigPath(configPath)

	viper.SetEnvPrefix("gitpod")
	viper.AutomaticEnv()

	viper.SetDefault("host", "gitpod.io")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found; create and write a new one
			if err := os.MkdirAll(configPath, os.ModePerm); err != nil {
				panic("Failed to create config directory: " + err.Error())
			}
			viper.SafeWriteConfigAs(configFile)
		} else {
			// Config file was found but another error was produced
			panic("Failed to read config file: " + err.Error())
		}
	}
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
