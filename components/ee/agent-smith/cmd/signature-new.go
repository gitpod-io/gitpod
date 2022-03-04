// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
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

		kinds := map[string]classifier.ObjectKind{
			"elf-symbols":   classifier.ObjectELFSymbols,
			"elf-rodata":    classifier.ObjectELFRodata,
			"expensive-any": classifier.ObjectAny,
		}
		kindv := cmd.Flags().Lookup("kind").Value.String()
		kind, ok := kinds[kindv]
		if !ok {
			fmt.Fprintf(os.Stderr, "unknown kind: %s\n", kindv)
			fmt.Fprintf(os.Stderr, "valid choices are (--kind):\n")
			for k := range kinds {
				fmt.Fprintf(os.Stderr, "\t%s\n", k)
			}
			os.Exit(1)
		}

		sig := classifier.Signature{
			Name:    args[0],
			Kind:    kind,
			Pattern: []byte(cmd.Flags().Lookup("pattern").Value.String()),
			Regexp:  cmd.Flags().Lookup("regexp").Value.String() == "true",
			Slice: classifier.Slice{
				Start: ss,
				End:   se,
			},
			Filename: fns,
			Domain:   classifier.DomainProcess,
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
