// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:generate sh -c "cd .. && go run main.go generate init-request > initreq-schema.json"

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/alecthomas/jsonschema"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/ws-daemon/api"
)

// generateInitReqSchemaCmd represents the generateConfig command
var generateInitReqSchemaCmd = &cobra.Command{
	Use:   "init-request",
	Short: "Generates JSON schema for an init workspace request",

	Run: func(cmd *cobra.Command, args []string) {
		schema := jsonschema.Reflect(&api.InitWorkspaceRequest{})

		schema.Title = "ws-manager config schema - generated using wsman generate init-request"
		out, err := json.MarshalIndent(schema, "", "  ")
		if err != nil {
			panic(err)
		}
		fmt.Print(string(out))
	},
}

func init() {
	generateCmd.AddCommand(generateInitReqSchemaCmd)
}
