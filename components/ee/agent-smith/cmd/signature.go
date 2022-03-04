// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"github.com/spf13/cobra"
)

// signatureCmd represents the signature command
var signatureCmd = &cobra.Command{
	Use:   "signature",
	Short: "makes working with signatures easier",
	Args:  cobra.MinimumNArgs(1),
}

func init() {
	rootCmd.AddCommand(signatureCmd)
}
