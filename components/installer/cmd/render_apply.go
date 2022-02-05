// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"helm.sh/helm/v3/pkg/chart"
)

var applyCmd = &cobra.Command{
	Use:   "apply",
	Short: "Applies a configuration to your cluster",
	RunE: func(cmd *cobra.Command, args []string) error {
		// Get the version manifest
		versionMF, err := getVersionManifest()
		if err != nil {
			return err
		}

		// Render the Kubernetes objects
		objs, err := runRenderCmd()
		if err != nil {
			return err
		}

		// In a temp dir, build a Helm release
		dir, err := helm.CreateHelmChart(
			chart.Metadata{
				APIVersion:  "v2",
				Name:        "Gitpod",
				Description: "Always ready-to-code",
				Version:     "1.0.0",
				AppVersion:  versionMF.Version,
			},
			objs,
		)
		if err != nil {
			return err
		}

		fmt.Println(*dir)
		os.Exit(1)

		// Install/upgrade the Helm release
		err = helm.InstallOrUpgrade("gitpod", renderOpts.Namespace, *dir)
		if err != nil {
			return errors.Wrap(err, "INSTALLATION FAILED")
		}

		return nil
	},
}

func init() {
	renderCmd.AddCommand(applyCmd)
}
