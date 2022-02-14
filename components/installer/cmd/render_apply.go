// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"helm.sh/helm/v3/pkg/chart"
)

var renderApplyOpts struct {
	WriteOnly bool
}

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

		if renderApplyOpts.WriteOnly {
			fmt.Println(fmt.Sprintf(`Installer config rendered to %s.

This can now be installed using Helm.`, *dir))
			return nil
		}

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

	applyCmd.Flags().BoolVar(&renderApplyOpts.WriteOnly, "write-only", false, "if set, the config will be written to disk only and will not be installed")
}
