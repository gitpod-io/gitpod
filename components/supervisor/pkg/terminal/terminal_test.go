// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"bytes"
	"context"
	"io"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/supervisor/api"
)

func TestTitle(t *testing.T) {
	t.Skip("skipping flakey tests")

	tests := []struct {
		Desc        string
		Title       string
		Command     string
		Default     string
		Expectation string
	}{
		{
			Desc:        "with args",
			Command:     "watch ls",
			Default:     "bash",
			Expectation: "watch",
		},
		{
			Desc:        "with predefined title",
			Title:       "run app",
			Command:     "sh",
			Default:     "run app: bash",
			Expectation: "run app: sh",
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			mux := NewMux()
			defer mux.Close()

			tmpWorkdir, err := os.MkdirTemp("", "workdirectory")
			if err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(tmpWorkdir)

			terminalService := NewMuxTerminalService(mux)
			terminalService.DefaultWorkdir = tmpWorkdir

			term, err := terminalService.OpenWithOptions(context.Background(), &api.OpenTerminalRequest{}, TermOptions{
				Title: test.Title,
			})
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(test.Default, term.Terminal.Title); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}

			listener := &TestTitleTerminalServiceListener{
				resps: make(chan *api.ListenTerminalResponse),
			}
			titles := listener.Titles(2)
			go func() {
				//nolint:errcheck
				terminalService.Listen(&api.ListenTerminalRequest{Alias: term.Terminal.Alias}, listener)
			}()

			// initial event could contain not contain updates
			time.Sleep(100 * time.Millisecond)

			title := <-titles
			if diff := cmp.Diff(test.Default, title); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}

			_, err = terminalService.Write(context.Background(), &api.WriteTerminalRequest{Alias: term.Terminal.Alias, Stdin: []byte(test.Command + "\r\n")})
			if err != nil {
				t.Fatal(err)
			}

			_, err = terminalService.Shutdown(context.Background(), &api.ShutdownTerminalRequest{Alias: term.Terminal.Alias})
			if err != nil {
				t.Fatal(err)
			}

			title = <-titles
			if diff := cmp.Diff(test.Expectation, title); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}

type TestTitleTerminalServiceListener struct {
	resps chan *api.ListenTerminalResponse
	grpc.ServerStream
}

func (listener *TestTitleTerminalServiceListener) Send(resp *api.ListenTerminalResponse) error {
	listener.resps <- resp
	return nil
}

func (listener *TestTitleTerminalServiceListener) Context() context.Context {
	return context.Background()
}

func (listener *TestTitleTerminalServiceListener) Titles(size int) chan string {
	title := make(chan string, size)
	go func() {
		//nolint:gosimple
		for {
			select {
			case resp := <-listener.resps:
				{
					titleChanged, ok := resp.Output.(*api.ListenTerminalResponse_Title)
					if ok {
						title <- titleChanged.Title
						break
					}
				}
			}
		}
	}()
	return title
}

func TestAnnotations(t *testing.T) {
	tests := []struct {
		Desc        string
		Req         *api.OpenTerminalRequest
		Opts        *TermOptions
		Expectation map[string]string
	}{
		{
			Desc: "no annotations",
			Req: &api.OpenTerminalRequest{
				Annotations: map[string]string{},
			},
			Expectation: map[string]string{},
		},
		{
			Desc: "request annotation",
			Req: &api.OpenTerminalRequest{
				Annotations: map[string]string{
					"hello": "world",
				},
			},
			Expectation: map[string]string{
				"hello": "world",
			},
		},
		{
			Desc: "option annotation",
			Req: &api.OpenTerminalRequest{
				Annotations: map[string]string{
					"hello": "world",
				},
			},
			Opts: &TermOptions{
				Annotations: map[string]string{
					"hello": "foo",
					"bar":   "baz",
				},
			},
			Expectation: map[string]string{
				"hello": "world",
				"bar":   "baz",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			mux := NewMux()
			defer mux.Close()

			terminalService := NewMuxTerminalService(mux)
			var err error
			if test.Opts == nil {
				_, err = terminalService.Open(context.Background(), test.Req)
			} else {
				_, err = terminalService.OpenWithOptions(context.Background(), test.Req, *test.Opts)
			}
			if err != nil {
				t.Fatal(err)
				return
			}

			lr, err := terminalService.List(context.Background(), &api.ListTerminalsRequest{})
			if err != nil {
				t.Fatal(err)
				return
			}
			if len(lr.Terminals) != 1 {
				t.Fatalf("expected exactly one terminal, got %d", len(lr.Terminals))
				return
			}

			if diff := cmp.Diff(test.Expectation, lr.Terminals[0].Annotations); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}
}

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
			terminal, ok := terminalService.Mux.Get(resp.Terminal.Alias)
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
			actual := strings.Split(stdoutOutput.String(), "\r\n")
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

func TestWorkDirProvider(t *testing.T) {
	mux := NewMux()
	defer mux.Close()

	terminalService := NewMuxTerminalService(mux)

	type AssertWorkDirTest struct {
		expectedWorkDir string
		providedWorkDir string
	}
	assertWorkDir := func(arg *AssertWorkDirTest) {
		term, err := terminalService.Open(context.Background(), &api.OpenTerminalRequest{
			Workdir: arg.providedWorkDir,
		})
		if err != nil {
			t.Fatal(err)
		}
		if diff := cmp.Diff(arg.expectedWorkDir, term.Terminal.CurrentWorkdir); diff != "" {
			t.Errorf("unexpected output (-want +got):\n%s", diff)
		}
		_, err = terminalService.Shutdown(context.Background(), &api.ShutdownTerminalRequest{
			Alias: term.Terminal.Alias,
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	staticWorkDir, err := os.MkdirTemp("", "staticworkdir")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(staticWorkDir)

	terminalService.DefaultWorkdir = staticWorkDir
	assertWorkDir(&AssertWorkDirTest{
		expectedWorkDir: staticWorkDir,
	})

	dynamicWorkDir := ""
	terminalService.DefaultWorkdirProvider = func() string {
		return dynamicWorkDir
	}
	assertWorkDir(&AssertWorkDirTest{
		expectedWorkDir: staticWorkDir,
	})

	dynamicWorkDir, err = os.MkdirTemp("", "dynamicworkdir")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dynamicWorkDir)
	assertWorkDir(&AssertWorkDirTest{
		expectedWorkDir: dynamicWorkDir,
	})

	providedWorkDir, err := os.MkdirTemp("", "providedworkdir")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(providedWorkDir)
	assertWorkDir(&AssertWorkDirTest{
		providedWorkDir: providedWorkDir,
		expectedWorkDir: providedWorkDir,
	})
}
