// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

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
		runtime, err := getRuntime(rootOpts.Workdir)
		if err != nil {
			return err
		}

		if cfg.Image == nil {
			// TODO(cw) fall back to default image
			return fmt.Errorf(".gitpod.yml is missing the image section")
		}

		spinner, err := pterm.DefaultSpinner.Start("building workspace image")
		if err != nil {
			return err
		}

		pterm.Println()

		ref := filepath.Join("local/workspace-image:latest")
		{
			area, _ := pterm.DefaultArea.Start("")
			err = bb.BuildImage(noopWriteCloser{&areaWriter{Area: area}}, ref, cfg)
			if err != nil {
				spinner.Fail(err)
				return err
			}
			area.Stop()
			spinner.Success()
		}

		shutdown := make(chan struct{})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go func() {
			err := runtime.StartWorkspace(ctx, os.Stdout, ref, cfg)
			if err != nil {
				pterm.Error.Print(err)
				close(shutdown)
			}
		}()

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		select {
		case <-sigChan:
			// give things a change to shut down
			pterm.Warning.Println("Received SIGTERM, shutting down")
			cancel()
			time.Sleep(1 * time.Second)
		case <-shutdown:
		}

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
