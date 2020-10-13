// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/go-cmp/cmp"
)

func TestTerminals(t *testing.T) {
	tests := []struct {
		Desc        string
		Stdin       []string
		Delay       time.Duration
		Expectation func(terminal *Term) string
	}{
		{
			Desc: "recorded output should be equals read output",
			Stdin: []string{
				"echo \"yarn\"",
				"echo \"gp sync-done init\"",
				"echo \"yarn --cwd theia-training watch\"",
				"history",
			},
			Delay: 1000 * time.Millisecond,
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
			go io.Copy(stdoutOutput, terminal.Stdout.Listen())

			for _, stdin := range test.Stdin {
				terminal.PTY.Write([]byte(stdin + "\r\n"))
				time.Sleep(test.Delay)
			}

			err = terminalService.Mux.Close(resp.Alias)
			if err != nil {
				t.Fatal(err)
			}

			expectation := strings.Split(test.Expectation(terminal), "\r\n")
			actual := strings.Split(string(stdoutOutput.Bytes()), "\r\n")
			if diff := cmp.Diff(expectation, actual); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}
