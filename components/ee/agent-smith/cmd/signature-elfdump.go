// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"debug/elf"
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

		executable, err := elf.NewFile(f)
		if err != nil {
			log.Fatalf("cannot anaylze ELF file: %v", err)
			return
		}

		syms, err := signature.ExtractELFSymbols(executable)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(strings.Join(syms, "\n"))

		strs, err := signature.ExtractELFStrings(executable)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("strings:\n%s", strs)
	},
}

func init() {
	signatureCmd.AddCommand(signatureElfdumpCmd)
}
