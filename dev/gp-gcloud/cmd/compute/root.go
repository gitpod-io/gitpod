// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package compute

import (
	"github.com/spf13/cobra"
)

func NewCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "compute",
		Short: "gcloud compute wrapper",
	}

	cmd.AddCommand(newInstanceTemplatesCommand())

	return cmd
}

func newInstanceTemplatesCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "instance-templates",
		Short: "instance-templates wrapper",
	}

	cmd.AddCommand(newInstanceTemplatesCreateCommand())

	return cmd
}
