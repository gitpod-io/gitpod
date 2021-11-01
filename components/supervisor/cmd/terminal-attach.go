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
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

var terminalAttachOpts struct {
	Interactive bool
	ForceResize bool
}

var terminalAttachCmd = &cobra.Command{
	Use:   "attach <alias>",
	Short: "attaches to a terminal",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var (
			alias  string
			client = api.NewTerminalServiceClient(dialSupervisor())
		)
		if len(args) == 0 {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			resp, err := client.List(ctx, &api.ListTerminalsRequest{})
			if err != nil {
				log.WithError(err).Fatal("cannot list terminals")
			}
			if len(resp.Terminals) == 0 {
				log.Fatal("no terminal available")
			}
			if len(resp.Terminals) > 1 {
				fmt.Fprintln(os.Stderr, "More than one terminal, please choose explicitly:")
				for _, r := range resp.Terminals {
					fmt.Fprintf(os.Stderr, "\t%s\n", r.Alias)
				}
				os.Exit(1)
			}

			alias = resp.Terminals[0].Alias
		} else {
			alias = args[0]
		}

		attachToTerminal(
			context.Background(),
			client,
			alias,
			attachToTerminalOpts{
				ForceResize: terminalAttachOpts.ForceResize,
				Interactive: terminalAttachOpts.Interactive,
			},
		)
	},
}

type attachToTerminalOpts struct {
	Interactive bool
	ForceResize bool
	Token       string
}

func attachToTerminal(ctx context.Context, client api.TerminalServiceClient, alias string, opts attachToTerminalOpts) {
	// Copy to stdout/stderr
	listen, err := client.Listen(ctx, &api.ListenTerminalRequest{
		Alias: alias,
	})
	if err != nil {
		log.WithError(err).Fatal("cannot attach to terminal")
	}
	var exitCode int
	errchan := make(chan error, 5)
	go func() {
		for {
			resp, err := listen.Recv()
			if err != nil {
				errchan <- err
			}
			os.Stdout.Write(resp.GetData())
			terminalExitCode := resp.GetExitCode()
			if terminalExitCode > 0 {
				exitCode = int(terminalExitCode)
			}
		}
	}()

	// Set stdin in raw mode.
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		panic(err)
	}
	defer func() { _ = term.Restore(int(os.Stdin.Fd()), oldState) }() // Best effort.

	if opts.Interactive {
		// Handle pty size.
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGWINCH)
		go func() {
			for range ch {
				size, err := pty.GetsizeFull(os.Stdin)
				if err != nil {
					log.WithError(err).Error("cannot determine stdin's terminal size")
					continue
				}

				req := &api.SetTerminalSizeRequest{
					Alias: alias,
					Size: &api.TerminalSize{
						Cols:     uint32(size.Cols),
						Rows:     uint32(size.Rows),
						WidthPx:  uint32(size.X),
						HeightPx: uint32(size.Y),
					},
				}

				var expectResize bool
				if opts.ForceResize {
					req.Priority = &api.SetTerminalSizeRequest_Force{Force: true}
					expectResize = true
				} else if opts.Token != "" {
					req.Priority = &api.SetTerminalSizeRequest_Token{Token: opts.Token}
					expectResize = true
				}

				_, err = client.SetSize(ctx, req)
				if err != nil && expectResize {
					log.WithError(err).Error("cannot set terminal size")
					continue
				}
			}
		}()
		ch <- syscall.SIGWINCH // Initial resize.

		// Copy stdin to the pty and the pty to stdout.
		go func() {
			buf := make([]byte, 32*1024)
			for {
				n, err := os.Stdin.Read(buf)
				if n > 0 {
					_, serr := client.Write(ctx, &api.WriteTerminalRequest{Alias: alias, Stdin: buf[:n]})
					if serr != nil {
						errchan <- err
						return
					}
				}
				if err != nil {
					errchan <- err
					return
				}
			}
		}()
	}

	// wait indefinitely
	stopch := make(chan os.Signal, 1)
	signal.Notify(stopch, syscall.SIGTERM|syscall.SIGINT)
	select {
	case err := <-errchan:
		if err != io.EOF {
			log.WithError(err).Error("error")
		} else {
			os.Exit(exitCode)
		}
	case <-stopch:
	}
}

func init() {
	terminalCmd.AddCommand(terminalAttachCmd)

	terminalAttachCmd.Flags().BoolVarP(&terminalAttachOpts.Interactive, "internactive", "i", false, "assume control over the terminal")
	terminalAttachCmd.Flags().BoolVarP(&terminalAttachOpts.ForceResize, "force-resize", "r", false, "force this terminal's size irregardless of other clients")
}
