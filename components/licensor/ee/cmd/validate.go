// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/licensor/ee/pkg/licensor"
)

// validateCmd represents the validate command
var validateCmd = &cobra.Command{
	Use:   "validate [license]",
	Short: "Validates a license - reads from stdin if no argument is provided",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		var lic []byte
		if len(args) == 0 {
			lic, err = io.ReadAll(os.Stdin)
			if err != nil {
				return err
			}
		} else {
			lic = []byte(args[0])
		}

		domain, _ := cmd.Flags().GetString("domain")
		e := licensor.NewEvaluator(lic, domain)
		if msg, valid := e.Validate(); !valid {
			return xerrors.Errorf(msg)
		}

		b, _ := json.MarshalIndent(e.Inspect(), "", "  ")
		fmt.Println(string(b))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(validateCmd)
	validateCmd.Flags().String("domain", "", "domain to evaluate the license against")
}
