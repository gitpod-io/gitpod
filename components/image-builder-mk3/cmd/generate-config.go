// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:generate sh -c "cd .. && CGO_ENABLED=0 go run main.go generate config > config-schema.json"

package cmd

import (
	"encoding/json"
	"fmt"
	"github.com/alecthomas/jsonschema"
	"github.com/gitpod-io/gitpod/image-builder/api/config"
	"github.com/spf13/cobra"
)

// generateCmd represents the generate command
var generateCmd = &cobra.Command{
	Use:   "generate <type>",
	Short: "Generate Typescript/JSON schema for parts of this application",
	Args:  cobra.ExactArgs(1),
}

func init() {
	rootCmd.AddCommand(generateCmd)
}

var generateConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Generates JSON schema for the configuration",

	Run: func(cmd *cobra.Command, args []string) {
		schema := jsonschema.Reflect(&config.ServiceConfig{})
		schema.Title = "image-builder config schema - generated using img generate config"
		out, err := json.MarshalIndent(schema, "", "  ")
		if err != nil {
			panic(err)
		}
		fmt.Print(string(out))
	},
}

func init() {
	generateCmd.AddCommand(generateConfigCmd)
}
