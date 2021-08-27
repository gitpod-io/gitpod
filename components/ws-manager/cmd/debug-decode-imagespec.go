// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/protobuf/encoding/protojson"

	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
)

// debugDecodeInitializer represents the debugHeadlessLog command
var debugDecodeInitializer = &cobra.Command{
	Use:   "decode-imagespec <str>",
	Short: "Decodes and marshals an initializer config to JSON from a base64-encoded protobuf string",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		spec, err := regapi.ImageSpecFromBase64(args[0])
		if err != nil {
			return xerrors.Errorf("cannot unmarshal init config: %w", err)
		}

		marshaler := protojson.MarshalOptions{
			Indent:         "  ",
			UseEnumNumbers: false,
		}

		b, err := marshaler.Marshal(spec)
		if err != nil {
			return err
		}

		_, err = fmt.Fprint(os.Stdout, string(b))
		return err
	},
}

func init() {
	debugCmd.AddCommand(debugDecodeInitializer)
}
