// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"context"
	"fmt"
	"net"
	"os/exec"
	"strings"
	"time"

	"golang.org/x/xerrors"
	"k8s.io/client-go/rest"
)

// ForwardPort establishes a TCP port forwarding to a Kubernetes pod
// Uses kubectl instead of Go to use a local process that can reproduce the same behavior outside the tests
func ForwardPort(ctx context.Context, config *rest.Config, namespace, pod, port string) (readychan chan struct{}, errchan chan error) {
	errchan = make(chan error, 1)
	readychan = make(chan struct{}, 1)

	go func() {
		args := []string{
			"port-forward",
			"--address=0.0.0.0",
			fmt.Sprintf("pod/%v", pod),
			fmt.Sprintf("--namespace=%v", namespace),
			port,
		}

		command := exec.CommandContext(ctx, "kubectl", args...)
		err := command.Start()
		if err != nil {
			errchan <- xerrors.Errorf("unexpected error starting port-forward: %w", err)
		}

		err = command.Wait()
		if err != nil {
			errchan <- xerrors.Errorf("unexpected error running port-forward: %w", err)
		}
	}()

	// wait until we can reach the local port before signaling we are ready
	go func() {
		localPort := strings.Split(port, ":")[0]
		for {
			conn, _ := net.DialTimeout("tcp", net.JoinHostPort("", localPort), time.Second)
			if conn != nil {
				conn.Close()
				break
			}
			time.Sleep(500 * time.Millisecond)
		}

		readychan <- struct{}{}
	}()

	return readychan, errchan
}
