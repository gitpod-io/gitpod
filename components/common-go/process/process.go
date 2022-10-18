// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package process

import (
	"context"
	"errors"
	"os"

	"golang.org/x/sys/unix"
)

// IsNotChildProcess checks if an error returned by a command
// execution is an error related to no child processes running
// This can be seen, for instance, in short lived commands.
func IsNotChildProcess(err error) bool {
	if err == nil {
		return false
	}

	return (err.Error() == "wait: no child processes" || err.Error() == "waitid: no child processes")
}

var ErrForceKilled = errors.New("Process didn't terminate, so we sent SIGKILL")

// TerminateSync sends a SIGTERM to the given process and returns when the process has terminated or when the context was cancelled.
// When the context is cancelled this function sends a SIGKILL to the process and return immediately with ErrForceKilled.
func TerminateSync(ctx context.Context, pid int) error {
	process, err := os.FindProcess(pid)
	if err != nil { // never happens on UNIX
		return err
	}
	err = process.Signal(unix.SIGTERM)
	if err != nil {
		if err == os.ErrProcessDone {
			return nil
		}
		return err
	}
	terminated := make(chan error, 1)
	go func() {
		_, err := process.Wait()
		terminated <- err
	}()
	select {
	case err := <-terminated:
		return err
	case <-ctx.Done():
		err = process.Kill()
		if err != nil {
			return err
		}
		return ErrForceKilled
	}
}
