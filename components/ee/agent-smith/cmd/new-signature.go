// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/spf13/cobra"
)

// newSignatureCmd represents the newSignature command
var newSignatureCmd = &cobra.Command{
	Use:   "new-signature <name>",
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

		sig := classifier.Signature{
			Name:    args[0],
			Kind:    classifier.ObjectKind(cmd.Flags().Lookup("kind").Value.String()),
			Pattern: []byte(cmd.Flags().Lookup("pattern").Value.String()),
			Regexp:  cmd.Flags().Lookup("regexp").Value.String() == "true",
			Slice: classifier.Slice{
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
	rootCmd.AddCommand(newSignatureCmd)

	newSignatureCmd.Flags().BoolP("regexp", "r", false, "Make this a regexp signature")
	newSignatureCmd.Flags().StringP("pattern", "p", "", "The pattern of this signature")
	newSignatureCmd.Flags().StringP("kind", "k", "", "The kind of this signature (either empty string for any or ELF)")
	newSignatureCmd.Flags().StringP("filename", "f", "", "The filename this signature can apply to")
	newSignatureCmd.Flags().Int("slice-start", 0, "Start of the signature slice")
	newSignatureCmd.Flags().Int("slice-end", 0, "End of the signature slice")
}
