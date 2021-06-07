// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/signature"
	"github.com/spf13/cobra"
)

// signatureNewCmd represents the newSignature command
var signatureNewCmd = &cobra.Command{
	Use:   "new <name>",
	Short: "produces a signature JSON",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ss, err := strconv.ParseInt(cmd.Flags().Lookup("slice-start").Value.String(), 10, 64)
		if err != nil {
			log.Fatal(err)
		}
		se, err := strconv.ParseInt(cmd.Flags().Lookup("slice-end").Value.String(), 10, 64)
		if err != nil {
			log.Fatal(err)
		}

		fn := cmd.Flags().Lookup("filename").Value.String()
		var fns []string
		if fn != "" {
			fns = []string{fn}
		}

		sig := signature.Signature{
			Name:    args[0],
			Kind:    signature.ObjectKind(cmd.Flags().Lookup("kind").Value.String()),
			Pattern: []byte(cmd.Flags().Lookup("pattern").Value.String()),
			Regexp:  cmd.Flags().Lookup("regexp").Value.String() == "true",
			Slice: signature.Slice{
				Start: ss,
				End:   se,
			},
			Filename: fns,
		}
		err = sig.Validate()
		if err != nil {
			log.Fatal(err)
		}
		out, err := json.Marshal(sig)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println(string(out))
	},
}

func init() {
	signatureCmd.AddCommand(signatureNewCmd)

	signatureNewCmd.Flags().BoolP("regexp", "r", false, "Make this a regexp signature")
	signatureNewCmd.Flags().StringP("pattern", "p", "", "The pattern of this signature")
	signatureNewCmd.Flags().StringP("kind", "k", "", "The kind of this signature (either empty string for any or ELF)")
	signatureNewCmd.Flags().StringP("filename", "f", "", "The filename this signature can apply to")
	signatureNewCmd.Flags().Int("slice-start", 0, "Start of the signature slice")
	signatureNewCmd.Flags().Int("slice-end", 0, "End of the signature slice")
}
