// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/rungp/pkg/console"
	"github.com/gitpod-io/gitpod/rungp/pkg/runtime"
	"github.com/spf13/cobra"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts a workspace",

	RunE: func(cmd *cobra.Command, args []string) error {
		log := console.PTermLog{
			Verbose: rootOpts.Verbose,
		}

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

		buildingPhase := log.StartPhase("[building]", "workspace image")
		ref := filepath.Join("local/workspace-image:latest")
		bldLog := log.Log()
		err = bb.BuildImage(bldLog, ref, cfg)
		if err != nil {
			buildingPhase.Failure(err.Error())
			bldLog.Show()
			return err
		}
		buildingPhase.Success()

		shutdown := make(chan struct{})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go func() {
			runLogs := console.Observe(log, filepath.Join("/workspace", cfg.WorkspaceLocation))
			opts := runOpts.StartOpts
			opts.Logs = runLogs
			err := runtime.StartWorkspace(ctx, ref, cfg, opts)
			if err != nil {
				runLogs.Show()
				close(shutdown)
				return
			}
		}()

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		select {
		case <-sigChan:
			// give things a change to shut down
			log.FixedMessagef("Received SIGTERM, shutting down")
			cancel()
			time.Sleep(1 * time.Second)
		case <-shutdown:
		}

		return nil
	},
}

var runOpts struct {
	StartOpts runtime.StartOpts
}

func init() {
	rootCmd.AddCommand(runCmd)
	runCmd.Flags().BoolVar(&runOpts.StartOpts.NoPortForwarding, "no-port-forwarding", false, "disable port-forwarding for ports in the .gitpod.yml")
	runCmd.Flags().IntVar(&runOpts.StartOpts.PortOffset, "port-offset", 0, "shift exposed ports by this number")
	runCmd.Flags().IntVar(&runOpts.StartOpts.IDEPort, "ide-port", 8080, "port to expose open vs code server")
}
