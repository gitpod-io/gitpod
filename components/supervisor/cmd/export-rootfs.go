// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/exec"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
)

var rootFS = "/.debug/rootfs"

func exportRootFS(dockerPath string, imageTag string) error {
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
		_ = exec.Command(dockerPath, "rm", "-f", name).Run()
	}

	rm()
	createCmd := exec.Command(dockerPath, "create", "--name", name, imageTag)
	createCmd.Stderr = os.Stderr
	err = createCmd.Run()
	if err != nil {
		return err
	}
	defer rm()

	exportCmd := exec.Command(dockerPath, "cp", name+":/", rootFS)
	exportCmd.Stdout = os.Stdout
	exportCmd.Stderr = os.Stderr
	return exportCmd.Run()
}

var exportRootFScmd = &cobra.Command{
	Use: "export-rootfs <dockerPath> <imageTag>",
	Run: func(cmd *cobra.Command, args []string) {
		var exitCode int
		err := exportRootFS(args[0], args[1])
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
