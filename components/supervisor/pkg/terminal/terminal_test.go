// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"bytes"
	"context"
	"io"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/go-cmp/cmp"
	"golang.org/x/sync/errgroup"
)

func TestTerminals(t *testing.T) {
	tests := []struct {
		Desc        string
		Stdin       []string
		Expectation func(terminal *Term) string
	}{
		{
			Desc: "recorded output should be equals read output",
			Stdin: []string{
				"echo \"yarn\"",
				"echo \"gp sync-done init\"",
				"echo \"yarn --cwd theia-training watch\"",
				"history",
				"exit",
			},
			Expectation: func(terminal *Term) string {
				return string(terminal.Stdout.recorder.Bytes())
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			terminalService := NewMuxTerminalService(NewMux())
			resp, err := terminalService.Open(context.Background(), &api.OpenTerminalRequest{})
			if err != nil {
				t.Fatal(err)
			}
			terminal, ok := terminalService.Mux.Get(resp.Alias)
			if !ok {
				t.Fatal("no terminal")
			}
			stdoutOutput := bytes.NewBuffer(nil)

			go func() {
				// give the io.Copy some time to start
				time.Sleep(500 * time.Millisecond)

				for _, stdin := range test.Stdin {
					terminal.PTY.Write([]byte(stdin + "\r\n"))
				}
			}()
			io.Copy(stdoutOutput, terminal.Stdout.Listen())

			expectation := strings.Split(test.Expectation(terminal), "\r\n")
			actual := strings.Split(string(stdoutOutput.Bytes()), "\r\n")
			if diff := cmp.Diff(expectation, actual); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}

func TestConcurrent(t *testing.T) {
	var (
		terminals     = NewMux()
		terminalCount = 2
		listenerCount = 2
	)

	eg, _ := errgroup.WithContext(context.Background())
	for i := 0; i < terminalCount; i++ {
		alias, err := terminals.Start(exec.Command("/bin/bash", "-i"), TermOptions{
			ReadTimeout: 0,
		})
		if err != nil {
			t.Fatal(err)
		}
		term, ok := terminals.Get(alias)
		if !ok {
			t.Fatal("terminal is not found")
		}

		for j := 0; j < listenerCount; j++ {
			stdout := term.Stdout.Listen()
			eg.Go(func() error {
				buf := new(strings.Builder)
				_, err = io.Copy(buf, stdout)
				if err != nil {
					return err
				}
				return nil
			})
		}

		_, err = term.PTY.Write([]byte("echo \"Hello World\"; exit\n"))
		if err != nil {
			t.Fatal(err)
		}
	}
	err := eg.Wait()
	if err != nil {
		t.Fatal(err)
	}
}
