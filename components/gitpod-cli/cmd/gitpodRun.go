// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/base64"
	"io"
	"log"
	"os"
	"syscall"

	"github.com/spf13/cobra"
)

// This command takes a base64 stream, saves it to disk and executes it. We use this in
// agent-smith to upload/run the sentinel.
// We don't want this explanation to end up in the binary.

const delimiter = "@"

// gitpodRunCmd represents the gitpodRun command
var gitpodRunCmd = &cobra.Command{
	Use:    "__gitpod_run [<pathToExecutable>]",
	Short:  "Used by Gitpod to ensure smooth operation",
	Hidden: true,
	Args:   cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var tmpfile *os.File
		var err error
		if len(args) == 1 {
			tmpfile, err = os.OpenFile(args[0], os.O_WRONLY|os.O_CREATE, 0700)
		} else {
			tmpfile, err = os.CreateTemp("", "gp")
		}
		if err != nil {
			_ = os.Remove(tmpfile.Name())
			log.Fatal(err)
		}

		decoder := base64.NewDecoder(base64.RawStdEncoding, &delimitingReader{os.Stdin, false})
		_, err = io.Copy(tmpfile, decoder)
		if err != nil {
			_ = os.Remove(tmpfile.Name())
			log.Fatal(err)
		}
		tmpfile.Close()

		err = os.Chmod(tmpfile.Name(), 0700)
		if err != nil {
			_ = os.Remove(tmpfile.Name())
			log.Fatal(err)
		}
		err = syscall.Exec(tmpfile.Name(), []string{"gpr", "serve"}, []string{})
		if err != nil {
			_ = os.Remove(tmpfile.Name())
			log.Fatal(err)
		}
	},
}

type delimitingReader struct {
	io.Reader
	EOF bool
}

func (p *delimitingReader) Read(buf []byte) (int, error) {
	if p.EOF {
		return 0, io.EOF
	}

	n, err := p.Reader.Read(buf)
	if err != nil {
		return n, err
	}

	for i := 0; i < n; i++ {
		if buf[i] == delimiter[0] {
			p.EOF = true
			return i, io.EOF
		}
	}

	return n, err
}

func init() {
	rootCmd.AddCommand(gitpodRunCmd)
}
