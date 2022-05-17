// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"log"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
	"github.com/spf13/cobra"
)

var (
	watch = false
)

func installContextCmd() *cobra.Command {

	cmd := &cobra.Command{
		Use:   "install-context",
		Short: "Installs the kubectl context of a preview environment.",
		Run: func(cmd *cobra.Command, args []string) {
			p := preview.New(branch)

			err := p.InstallContext(watch)
			if err != nil {
				log.Fatalf("Couldn't install context for the '%s' preview", p.Branch)
			}
		},
	}

	cmd.Flags().BoolVar(&watch, "watch", false, "If wait is enabled, previewctl will keep trying to install the kube-context every 30 seconds.")
	return cmd
}
