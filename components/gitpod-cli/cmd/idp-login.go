// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var idpLoginOpts struct {
	Scope string
}

var idpLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to a service for which trust has been established",
}

func init() {
	idpCmd.AddCommand(idpLoginCmd)

	idpLoginCmd.Flags().StringVar(&idpLoginOpts.Scope, "scope", "", "scopes string of the ID token")
}
