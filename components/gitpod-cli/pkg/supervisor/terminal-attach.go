// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"io"
	"os"
	"os/signal"
	"syscall"

	"github.com/creack/pty"
	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
	"golang.org/x/term"
	"golang.org/x/xerrors"
)

type AttachToTerminalOpts struct {
	Interactive bool
	ForceResize bool
	Token       string
}

func (client *SupervisorClient) AttachToTerminal(ctx context.Context, alias string, opts AttachToTerminalOpts) (int, error) {
	// Copy to stdout/stderr
	listen, err := client.Terminal.Listen(ctx, &api.ListenTerminalRequest{
		Alias: alias,
	})
	if err != nil {
		return 0, xerrors.Errorf("cannot attach to terminal: %w", err)
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
		return 0, xerrors.Errorf("cannot attach to terminal: %w", err)
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

				_, err = client.Terminal.SetSize(ctx, req)
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
					_, serr := client.Terminal.Write(ctx, &api.WriteTerminalRequest{Alias: alias, Stdin: buf[:n]})
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
	select {
	case err := <-errchan:
		if err != io.EOF {
			return 0, err
		} else {
			return exitCode, nil
		}
	case <-ctx.Done():
		return 0, nil
	}
}
