// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
)

// can be used with the helm-template like so:
// helm template ../../chart/ | sed -n '/ws-daemon-configmap.yaml/,$p' | sed '/---/q' | yq r - 'data[config.json]' | go run main.go validate-config

var validateConfigCmd = &cobra.Command{
	Use:   "validate-config",
	Short: "reads a ws-daemon configuration from STDIN and validates it",
	Run: func(cmd *cobra.Command, args []string) {
		ctnt, err := io.ReadAll(os.Stdin)
		if err != nil {
			log.WithError(err).Fatal("cannot read configuration")
		}

		var cfg config.Config
		err = json.Unmarshal(ctnt, &cfg)
		if err != nil {
			fmt.Println(string(ctnt))
			log.WithError(err).Fatal("cannot unmarshal configuration")
		}

		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(cfg)
	},
}

func init() {
	rootCmd.AddCommand(validateConfigCmd)
}
