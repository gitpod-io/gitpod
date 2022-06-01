// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"
	"io"
	"os"
	"os/signal"
	"syscall"

	"github.com/creack/pty"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
	"golang.org/x/term"
)

type AttachToTerminalOpts struct {
	Interactive bool
	ForceResize bool
	Token       string
}

func AttachToTerminal(ctx context.Context, client supervisor.TerminalServiceClient, alias string, opts AttachToTerminalOpts) {
	// Copy to stdout/stderr
	listen, err := client.Listen(ctx, &supervisor.ListenTerminalRequest{
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
		log.WithError(err).Fatal("cannot attach to terminal")
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

				req := &supervisor.SetTerminalSizeRequest{
					Alias: alias,
					Size: &supervisor.TerminalSize{
						Cols:     uint32(size.Cols),
						Rows:     uint32(size.Rows),
						WidthPx:  uint32(size.X),
						HeightPx: uint32(size.Y),
					},
				}

				var expectResize bool
				if opts.ForceResize {
					req.Priority = &supervisor.SetTerminalSizeRequest_Force{Force: true}
					expectResize = true
				} else if opts.Token != "" {
					req.Priority = &supervisor.SetTerminalSizeRequest_Token{Token: opts.Token}
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
					_, serr := client.Write(ctx, &supervisor.WriteTerminalRequest{Alias: alias, Stdin: buf[:n]})
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

func GetTerminalServiceClient(ctx context.Context) (supervisor.TerminalServiceClient, error) {
	conn, err := Dial(ctx)
	if err != nil {
		return nil, err
	}
	terminalClient := supervisor.NewTerminalServiceClient(conn)
	return terminalClient, nil
}
