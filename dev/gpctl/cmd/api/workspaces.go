// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"fmt"
	"io"

	"github.com/spf13/cobra"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

func newWorkspacesCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "workspaces",
		Short: "Retrieve information about workspaces",
	}

	cmd.AddCommand(newWorkspacesGetCommand())
	cmd.AddCommand(newWorkspacesOwnerTokenCommand())

	return cmd
}

func printProtoMsg(w io.Writer, m proto.Message) error {
	b, err := protojson.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal proto object: %w", err)
	}

	if _, err := fmt.Fprint(w, string(b)); err != nil {
		return fmt.Errorf("failed to write proto object to writer: %w", err)
	}

	return nil
}
