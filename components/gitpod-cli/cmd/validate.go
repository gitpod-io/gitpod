// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"
	"os"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/spf13/cobra"
	"github.com/xeipuuv/gojsonschema"
	yaml "gopkg.in/yaml.v2"
)

var validateCommand = &cobra.Command{
	Use:   "validate",
	Short: "Validate your .gitpod.yml file is valid or not",
	Run: func(_ *cobra.Command, _ []string) {

		// Load .gitpod.yml schema
		schemaLoader := gojsonschema.NewReferenceLoader("https://gitpod.io/schemas/gitpod-schema.json")

		// Load .gitpod.yml file
		filePathOfGitpodConfig := os.Getenv("GITPOD_REPO_ROOT") + "/.gitpod.yml"

		data, err := os.ReadFile(filePathOfGitpodConfig)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				fmt.Println(".gitpod.yml file does not exist")
				return
			}
			panic(errors.New("read .gitpod.yml file failed: " + err.Error() + "\n"))
		}

		// TODO: Better error handling messages.
		var config *gitpod.GitpodConfig
		if err = yaml.Unmarshal(data, &config); err != nil {
			fmt.Println(".gitpod.yml is invalid. see errors :\n" + err.Error() + "\n")
			return
		}

		documentLoader := gojsonschema.NewGoLoader(config)

		result, err := gojsonschema.Validate(schemaLoader, documentLoader)
		if err != nil {
			panic(err.Error())
		}

		if result.Valid() {
			fmt.Println(".gitpod.yml is valid")
		} else {
			fmt.Println(".gitpod.yml is invalid")
		}
	},
}

func init() {
	rootCmd.AddCommand(validateCommand)
}
