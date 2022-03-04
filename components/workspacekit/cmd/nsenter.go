// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"

	"github.com/gitpod-io/gitpod/common-go/nsenter"
)

var nsenterOpts struct {
	Target  int
	MountNS bool
	NetNS   bool
}

var nsenterCmd = &cobra.Command{
	Use:     "nsenter <cmd> <args ...>",
	Short:   "enters namespaces and executes the arg",
	Args:    cobra.MinimumNArgs(1),
	Aliases: []string{"handler"},
	Run: func(_ *cobra.Command, args []string) {
		if os.Getenv("_LIBNSENTER_INIT") != "" {
			err := unix.Exec(args[0], args, os.Environ())
			if err != nil {
				log.Fatalf("cannot exec: %v", err)
			}
			return
		}

		var ns []nsenter.Namespace
		if nsenterOpts.MountNS {
			ns = append(ns, nsenter.NamespaceMount)
		}
		if nsenterOpts.NetNS {
			ns = append(ns, nsenter.NamespaceNet)
		}
		err := nsenter.Run(nsenterOpts.Target, args, nil, ns...)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(nsenterCmd)

	nsenterCmd.Flags().IntVar(&nsenterOpts.Target, "target", 0, "target PID")
	nsenterCmd.Flags().BoolVar(&nsenterOpts.MountNS, "mount", false, "enter mount namespace")
	nsenterCmd.Flags().BoolVar(&nsenterOpts.NetNS, "net", false, "enter network namespace")
}
