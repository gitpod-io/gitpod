// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var idpCmd = &cobra.Command{
	Use:    "idp",
	Short:  "Interact Gitpod's OIDC identity provider",
	Hidden: true,
}

func init() {
	rootCmd.AddCommand(idpCmd)
}
