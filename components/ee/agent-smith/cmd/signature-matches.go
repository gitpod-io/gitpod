// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/classifier"
	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

// signatureElfdumpCmd represents the signatureElfdump command
var signatureMatchesCmd = &cobra.Command{
	Use:   "matches <binary>",
	Short: "Finds all signatures that match the binary",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		f, err := os.OpenFile(args[0], os.O_RDONLY, 0644)
		if err != nil {
			log.Fatal(err)
		}
		defer f.Close()

		if cfgFile == "" {
			log.Info("no config present - reading signature from STDIN")
			var sig classifier.Signature
			err := json.NewDecoder(os.Stdin).Decode(&sig)
			if err != nil {
				log.Fatal(err)
			}

			match, err := sig.Matches(f)
			if err != nil {
				log.Fatal(err)
			}

			if !match {
				fmt.Println("no match")
				os.Exit(1)
			}
			fmt.Println(sig)
			return
		}

		cfg, err := config.GetConfig(cfgFile)
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}
		if cfg.Blocklists == nil {
			log.WithError(err).Fatal("no signatures configured")
		}

		var res []*classifier.Signature
		for _, bl := range cfg.Blocklists.Levels() {
			for _, s := range bl.Signatures {
				m, err := s.Matches(f)
				if err != nil {
					log.WithError(err).WithField("signature", s.Name).Warn("cannot match signature")
					continue
				}
				if !m {
					log.WithField("signature", s.Name).Debug("no match")
					continue
				}
				res = append(res, s)
			}
		}

		if len(res) == 0 {
			os.Exit(1)
		}

		for _, s := range res {
			fmt.Println(s)
		}
	},
}

func init() {
	signatureCmd.AddCommand(signatureMatchesCmd)
}
