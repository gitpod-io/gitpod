// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:generate sh -c "cd .. && go run main.go generate wsspec > wsspec-schema.json"

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/alecthomas/jsonschema"
	"github.com/spf13/cobra"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

var generateWsspecCmd = &cobra.Command{
	Use:   "wsspec",
	Short: "Generates JSON schema for a workspace spec",

	Run: func(cmd *cobra.Command, args []string) {
		schema := jsonschema.Reflect(&api.StartWorkspaceRequest{})
		schema.Title = "ws-manager wsspec schema - generated using wsman generate wsspec"
		schema.Ref = "#/definitions/StartWorkspaceSpec"

		initializers := map[string]interface{}{
			"WorkspaceInitializer_Empty":    &csapi.WorkspaceInitializer_Empty{},
			"WorkspaceInitializer_Git":      &csapi.WorkspaceInitializer_Git{},
			"WorkspaceInitializer_Snapshot": &csapi.WorkspaceInitializer_Snapshot{},
			"WorkspaceInitializer_Prebuild": &csapi.WorkspaceInitializer_Prebuild{},
		}
		initializerDefs := make([]*jsonschema.Type, 0)
		for k, t := range initializers {
			initializerDefs = append(initializerDefs, &jsonschema.Type{Ref: "#/definitions/" + k})

			ts := jsonschema.Reflect(t)
			for k, v := range ts.Definitions {
				schema.Definitions[k] = v
			}
		}
		schema.Definitions["WorkspaceInitializer"].Properties = nil
		schema.Definitions["WorkspaceInitializer"].Required = nil
		schema.Definitions["WorkspaceInitializer"].AdditionalProperties = []byte("true")
		schema.Definitions["WorkspaceInitializer"].AnyOf = initializerDefs

		out, err := json.MarshalIndent(schema, "", "  ")
		if err != nil {
			panic(err)
		}
		fmt.Print(string(out))
	},
}

func init() {
	generateCmd.AddCommand(generateWsspecCmd)
}
