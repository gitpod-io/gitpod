// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/golang/protobuf/jsonpb"

	"github.com/spf13/cobra"
)

// debugDecodeInitializer represents the debugHeadlessLog command
var debugDecodeInitializer = &cobra.Command{
	Use:   "decode-imagespec <str>",
	Short: "Decodes and marshals an initializer config to JSON from a base64-encoded protobuf string",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		spec, err := regapi.ImageSpecFromBase64(args[0])
		if err != nil {
			return fmt.Errorf("cannot unmarshal init config: %w", err)
		}

		m := &jsonpb.Marshaler{
			EnumsAsInts: false,
			Indent:      "  ",
		}
		return m.Marshal(os.Stdout, spec)
	},
}

func init() {
	debugCmd.AddCommand(debugDecodeInitializer)
}
