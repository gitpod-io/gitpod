// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/spf13/cobra"
)

// signatureElfdumpCmd represents the signatureElfdump command
var signatureElfdumpCmd = &cobra.Command{
	Use:   "elfdump <binary>",
	Short: "Dumps all signatures found in an ELF binary",
	Run: func(cmd *cobra.Command, args []string) {
		f, err := os.OpenFile(args[0], os.O_RDONLY, 0644)
		if err != nil {
			log.Fatal(err)
		}
		defer f.Close()

		syms, err := signature.ExtractELFSymbols(f)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println(strings.Join(syms, "\n"))
	},
}

func init() {
	signatureCmd.AddCommand(signatureElfdumpCmd)
}
