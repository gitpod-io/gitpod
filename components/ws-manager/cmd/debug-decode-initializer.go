// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/base64"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
)

// debugDecodeImageSpec represents the debugHeadlessLog command
var debugDecodeImageSpec = &cobra.Command{
	Use:   "decode-initalizer <str>",
	Short: "Decodes and marshals an image spec to JSON from a base64-encoded protobuf string",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		initializerPB, err := base64.StdEncoding.DecodeString(args[0])
		if err != nil {
			return xerrors.Errorf("cannot decode init config: %w", err)
		}

		var initializer csapi.WorkspaceInitializer
		err = proto.Unmarshal(initializerPB, &initializer)
		if err != nil {
			return xerrors.Errorf("cannot unmarshal init config: %w", err)
		}

		marshaler := protojson.MarshalOptions{
			Indent:         "  ",
			UseEnumNumbers: false,
		}

		b, err := marshaler.Marshal(&initializer)
		if err != nil {
			return err
		}

		_, err = fmt.Fprint(os.Stdout, string(b))
		return err
	},
}

func init() {
	debugCmd.AddCommand(debugDecodeImageSpec)
}
