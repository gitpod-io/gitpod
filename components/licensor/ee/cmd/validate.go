// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
		domain, _ := cmd.Flags().GetString("domain")
		licensorType, _ := cmd.Flags().GetString("licensor")

		var e *licensor.Evaluator
		switch licensorType {
		case string(licensor.LicenseTypeReplicated):
			e = licensor.NewReplicatedEvaluator()
		default:
			var lic []byte
			if len(args) == 0 {
				lic, err = io.ReadAll(os.Stdin)
				if err != nil {
					return err
				}
			} else {
				lic = []byte(args[0])
			}

			e = licensor.NewGitpodEvaluator(lic, domain)
		}

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
	validateCmd.Flags().String("licensor", "gitpod", "licensor to use")
}
