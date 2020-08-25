// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terraform

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/gitpod-io/installer/pkg/ui"
)

// RunRetryFunc determines if a terraform execution should be retried if terraform exits
// with a non-zero exit code. This function will see every line of TF output, and if it
// returns true at any point the run will restart.
type RunRetryFunc func(line []byte) RetryMethod

// RetryMethod determines how to retry upon failure
type RetryMethod int

const (
	// DontRetry means we're not retrying upon failure
	DontRetry RetryMethod = iota
	// DontRetryAndFail means we're not retrying upon failure and
	// escalate the error to a fatal one
	DontRetryAndFail
	// Retry means we're retrying
	Retry
)

// RunOpt configures RUn
type RunOpt func(*runOpts)

type runOpts struct {
	Basedir     string
	FatalErrors bool

	Retry         RunRetryFunc
	RetryInterval time.Duration
}

// WithBasedir runs terraform in the basedir
func WithBasedir(basedir string) RunOpt {
	return func(o *runOpts) {
		o.Basedir = basedir
	}
}

// WithFatalErrors makes a failing terraform fatal for this program
func WithFatalErrors(o *runOpts) {
	o.FatalErrors = true
}

// WithRetry possibly retries a failed TF run
func WithRetry(f RunRetryFunc, pause time.Duration) RunOpt {
	return func(o *runOpts) {
		o.Retry = f
		o.RetryInterval = pause
	}
}

// Run runs terraform
func Run(args []string, opt ...RunOpt) error {
	var opts runOpts
	for _, o := range opt {
		o(&opts)
	}

	var (
		retry            = Retry
		rtchan           = make(chan RetryMethod, 10)
		stdout io.Writer = os.Stdout
		stderr io.Writer = os.Stderr
	)
	scanAndForward := func(wg *sync.WaitGroup, in io.Reader, out io.Writer) {
		defer wg.Done()

		rd := bufio.NewReader(in)
		for {
			line, err := rd.ReadBytes('\n')
			if err == io.EOF {
				break
			}
			if err != nil {
				ui.Warnf("scanAndForward failure:\n\t%q", err)
				break
			}

			rtchan <- opts.Retry(line)
			if bytes.Contains(line, []byte("Enter a value")) {
				continue
			}

			out.Write(line)

			if bytes.Contains(line, []byte("Only 'yes' will be accepted to approve.")) {
				fmt.Println("Enter a value: ")
			}
		}
	}

	for retry == Retry {
		retry = DontRetry
		cancel := make(chan struct{})

		var wg sync.WaitGroup
		if opts.Retry != nil {
			wg.Add(3)

			// empty rtchan from prior runs
		emptyRtLoop:
			for {
				select {
				case <-rtchan:
				default:
					break emptyRtLoop
				}
			}
			// fan in retries
			go func() {
				defer wg.Done()
				for {
					select {
					case <-cancel:
						return
					case rt := <-rtchan:
						if rt > retry {
							retry = rt
						}
					}
				}
			}()

			soutr, soutw := io.Pipe()
			stdout = soutw
			go scanAndForward(&wg, soutr, os.Stdout)

			serrr, serrw := io.Pipe()
			stderr = serrw
			go scanAndForward(&wg, serrr, os.Stderr)
		}

		ui.Command("terraform", args...)
		tfcmd := exec.Command("terraform", args...)
		tfcmd.Stdout = stdout
		tfcmd.Stderr = stderr
		tfcmd.Stdin = os.Stdin
		tfcmd.Dir = opts.Basedir

		err := tfcmd.Run()
		close(cancel)

		if err != nil {
			if opts.FatalErrors || retry == DontRetryAndFail {
				ui.Fatalf("terraform failed: %q", err)
			}

			// wait for the scanAndForward go routines to finish, i.e. wait until the final
			// retry decision is made.
			stdout.(io.WriteCloser).Close()
			stderr.(io.WriteCloser).Close()
			wg.Wait()
			if retry == 0 {
				return err
			}

			ui.Warnf("terraform failed - will retry in %s", opts.RetryInterval.String())
			time.Sleep(opts.RetryInterval)
		}
	}

	return nil
}
