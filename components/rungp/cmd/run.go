// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"io"

	"github.com/pterm/pterm"
	"github.com/spf13/cobra"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts a workspace",

	RunE: func(cmd *cobra.Command, args []string) error {
		pterm.DefaultSpinner.ShowTimer = true

		cfg, err := getConfig()
		if err != nil {
			return err
		}

		bb, err := getBuilder(rootOpts.Workdir)
		if err != nil {
			return err
		}

		if cfg.Image == nil {
			// TODO(cw) fall back to default image
			return fmt.Errorf(".gitpod.yml is missing the image section")
		}

		var baseRef string
		switch {
		case cfg.Image == nil:
			baseRef = "gitpod/workspace-full:latest"
		case cfg.Image.Ref != "":
			baseRef = cfg.Image.Ref
		default:
			spinner, err := pterm.DefaultSpinner.Start("building base image")
			if err != nil {
				return err
			}

			area, _ := pterm.DefaultArea.Start("")

			ref, err := bb.BuildBaseImage(noopWriteCloser{&areaWriter{Area: area}}, cfg.Image.Obj)

			if err != nil {
				spinner.Fail(err)
				return err
			}
			area.Stop()
			spinner.Success()
			baseRef = ref
		}

		spinner, err := pterm.DefaultSpinner.Start("building workspace image")
		if err != nil {
			return err
		}

		area, _ := pterm.DefaultArea.Start("")

		ref, err := bb.BuildWorkspaceImage(noopWriteCloser{&areaWriter{Area: area}}, baseRef)

		if err != nil {
			spinner.Fail(err)
			return err
		}
		area.Stop()
		spinner.Success()

		fmt.Println(ref)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

type noopWriteCloser struct{ io.Writer }

func (noopWriteCloser) Close() error {
	return nil
}

type areaWriter struct {
	buf  string
	Area *pterm.AreaPrinter
}

func (a *areaWriter) Write(buf []byte) (n int, err error) {
	a.buf += string(buf)
	a.Area.Update(a.buf)
	return len(buf), nil
}
