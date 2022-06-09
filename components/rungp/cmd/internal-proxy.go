// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
)

var internalProxyCmd = &cobra.Command{
	Use:    "proxy",
	Short:  "acts as ws-proxy replacement",
	Hidden: true,
}

func init() {
	rootCmd.AddCommand(internalCmd)
}
