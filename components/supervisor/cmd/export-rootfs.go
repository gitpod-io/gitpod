// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/exec"
	"os/signal"
	"syscall"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var rootFS = "/.debug/rootfs"

func exportRootFS(ctx context.Context, buildDir, dockerPath, imageTag string) error {
	err := os.RemoveAll(rootFS)
	if err != nil {
		return err
	}
	err = os.MkdirAll(rootFS, 0775)
	if err != nil {
		return err
	}

	name := imageTag + "-0"

	rm := func() {
		_ = exec.CommandContext(ctx, dockerPath, "rm", "-f", name).Run()
	}

	rm()
	createCmd := exec.CommandContext(ctx, dockerPath, "create", "--name", name, imageTag)
	createCmd.Stderr = os.Stderr
	err = createCmd.Run()
	if err != nil {
		return err
	}
	defer rm()

	exportCmd := exec.CommandContext(ctx, dockerPath, "cp", name+":/", rootFS)
	exportCmd.Stdout = os.Stdout
	exportCmd.Stderr = os.Stderr
	return exportCmd.Run()
}

var exportRootFScmd = &cobra.Command{
	Use: "export-rootfs <buildDir> <dockerPath> <imageTag>",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
		go func() {
			<-sigChan
			cancel()
		}()

		var exitCode int
		err := exportRootFS(ctx, args[0], args[1], args[2])
		if errr, ok := err.(*exec.ExitError); ok {
			exitCode = errr.ExitCode()
		} else if err != nil {
			exitCode = 1
			log.WithError(err).Error()
		}
		os.Exit(exitCode)
	},
}

func init() {
	rootCmd.AddCommand(exportRootFScmd)
}
