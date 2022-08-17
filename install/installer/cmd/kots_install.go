// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/spf13/cobra"
	"k8s.io/utils/pointer"
)

// kotsInstallCmd represents the validate command
var kotsInstallCmd = &cobra.Command{
	Use:   "install",
	Short: "Install a KOTS deployment",
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, err := os.MkdirTemp("", "gitpod")
		if err != nil {
			return err
		}

		configFilePath := fmt.Sprintf("%s/config.yaml", dir)

		configFileInit, err := initFunc()
		if err != nil {
			return err
		}

		if err := os.WriteFile(configFilePath, configFileInit, 0644); err != nil {
			return err
		}

		// Initialise the config file
		_, _, cfg, err := loadConfig(configFilePath)
		if err != nil {
			return err
		}

		cfg.Domain = os.Getenv("DOMAIN")
		cfg.License = &configv1.ObjectRef{
			Kind: configv1.ObjectRefSecret,
			Name: "gitpod-license",
		}

		openVsxProxyUrl := os.Getenv("OPENVSXURL")
		if openVsxProxyUrl != "" {
			cfg.OpenVSX.URL = openVsxProxyUrl
		}

		if os.Getenv("DB_INCLUSTER") == "0" {
			cfg.Database.InCluster = pointer.Bool(false)

			if os.Getenv("DB_CLOUDSQL_ENABLED") == "1" {
				cfg.Database.CloudSQL = &configv1.DatabaseCloudSQL{
					Instance: os.Getenv("DB_CLOUDSQL_INSTANCE"),
					ServiceAccount: configv1.ObjectRef{
						Kind: configv1.ObjectRefSecret,
						Name: "cloudsql",
					},
				}
			} else {
				cfg.Database.External = &configv1.DatabaseExternal{
					Certificate: configv1.ObjectRef{
						Kind: configv1.ObjectRefSecret,
						Name: "database",
					},
				}
			}
		}

		if os.Getenv("HAS_LOCAL_REGISTRY") == "1" {
			cfg.Repository = os.Getenv("LOCAL_REGISTRY_ADDRESS")
			cfg.ImagePullSecrets = []configv1.ObjectRef{
				{
					Kind: configv1.ObjectRefSecret,
					Name: os.Getenv("IMAGE_PULL_SECRET_NAME"),
				},
			}
			cfg.ContainerRegistry.PrivateBaseImageAllowList = []string{
				os.Getenv("LOCAL_REGISTRY_HOST"),
				"docker.io",
			}
		}

		// Save the file
		fc, err := config.Marshal(config.CurrentVersion, cfg)
		if err != nil {
			return err
		}

		if err := os.WriteFile(configFilePath, fc, 0644); err != nil {
			return err
		}

		return nil
	},
}

func init() {
	kotsCmd.AddCommand(kotsInstallCmd)
}
