// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/server"
	"github.com/spf13/cobra"
	"os"
	"path"
)

func init() {
	rootCmd.AddCommand(run())
}

func run() *cobra.Command {
	var (
		verbose    bool
		configPath string
	)

	cmd := &cobra.Command{
		Use:     "run",
		Short:   "Starts the service",
		Version: Version,
		Run: func(cmd *cobra.Command, args []string) {
			log.Init(ServiceName, Version, true, verbose)

			cfg, err := parseConfig(configPath)
			if err != nil {
				log.WithError(err).Fatal("Failed to get config. Did you specify --config correctly?")
			}

			err = server.Start(cfg, Version)
			if err != nil {
				log.WithError(err).Fatal("Failed to start usage server.")
			}
		},
	}

	localConfig := path.Join(os.ExpandEnv("GOMOD"), "..", "config.json")

	cmd.Flags().BoolVar(&verbose, "verbose", false, "Toggle verbose logging (debug level)")
	cmd.Flags().StringVar(&configPath, "config", localConfig, "Configuration file for running usage component")

	return cmd
}

func parseConfig(path string) (server.Config, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return server.Config{}, fmt.Errorf("failed to read config from %s: %w", path, err)
	}

	var cfg server.Config
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		return server.Config{}, fmt.Errorf("failed to parse config from %s: %w", path, err)
	}

	return cfg, nil
}
