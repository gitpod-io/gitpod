// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:generate sh -c "cd .. && go run main.go generate config > config-schema.json"

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/alecthomas/jsonschema"
	"github.com/spf13/cobra"
)

// generateConfigCmd represents the generateConfig command
var generateConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Generates JSON schema for the configuration",

	Run: func(cmd *cobra.Command, args []string) {
		schema := jsonschema.Reflect(&config{})
		// schema.Definitions["Backup"].Properties["timeout"].Type = "string"
		schema.Definitions["Configuration"].Properties["workspaceSizeLimit"].Type = "string"

		schema.Title = "ws-sync config schema - generated using ws-sync generate config"
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
