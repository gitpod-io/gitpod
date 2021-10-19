// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"debug/elf"
	"encoding/json"
	"log"
	"os"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/spf13/cobra"
)

var signatureElfdumpOpts struct {
	Symbols bool
	Rodata  bool
}

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

		var result struct {
			Symbols []string `json:"symbols"`
			Rodata  []byte   `json:"rodata"`
		}

		executable, err := elf.NewFile(f)
		if err != nil {
			log.Fatalf("cannot anaylze ELF file: %v", err)
			return
		}

		result.Symbols, err = classifier.ExtractELFSymbols(executable)
		if err != nil {
			log.Fatal(err)
		}

		result.Rodata, err = classifier.ExtractELFRodata(executable)
		if err != nil {
			log.Fatal(err)
		}

		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		enc.Encode(result)
	},
}

func init() {
	signatureCmd.AddCommand(signatureElfdumpCmd)
	signatureElfdumpCmd.Flags().BoolVar(&signatureElfdumpOpts.Symbols, "symbols", true, "extract ELF symbols")
	signatureElfdumpCmd.Flags().BoolVar(&signatureElfdumpOpts.Rodata, "rodata", true, "extract ELF rodata")
}
