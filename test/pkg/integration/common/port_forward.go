// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"os/exec"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

// ForwardPortOfPod establishes a TCP port forwarding to a Kubernetes pod
func ForwardPortOfPod(ctx context.Context, kubeconfig string, namespace, name, port string) (readychan chan struct{}, errchan chan error) {
	return forwardPort(ctx, kubeconfig, namespace, "pod", name, port)
}

// ForwardPortOfSvc establishes a TCP port forwarding to a Kubernetes service
func ForwardPortOfSvc(ctx context.Context, kubeconfig string, namespace, name, port string) (readychan chan struct{}, errchan chan error) {
	return forwardPort(ctx, kubeconfig, namespace, "service", name, port)
}

// forwardPort establishes a TCP port forwarding to a Kubernetes resource - pod or service
// Uses kubectl instead of Go to use a local process that can reproduce the same behavior outside the tests
// Since we are using kubectl directly we need to pass kubeconfig explicitly
func forwardPort(ctx context.Context, kubeconfig string, namespace, resourceType, name, port string) (readychan chan struct{}, errchan chan error) {
	errchan = make(chan error, 1)
	readychan = make(chan struct{}, 1)

	go func() {
		args := []string{
			"port-forward",
			"--address=0.0.0.0",
			fmt.Sprintf("%s/%v", resourceType, name),
			fmt.Sprintf("--namespace=%v", namespace),
			fmt.Sprintf("--kubeconfig=%v", kubeconfig),
			port,
		}

		command := exec.CommandContext(ctx, "kubectl", args...)
		var serr, sout bytes.Buffer
		command.Stdout = &sout
		command.Stderr = &serr
		err := command.Start()
		if err != nil {
			errchan <- xerrors.Errorf("unexpected error starting port-forward: %w, args: %v, stdout: %s, stderr: %s", err, args, sout, serr)
		}

		err = command.Wait()
		if err != nil {
			errchan <- xerrors.Errorf("unexpected error running port-forward: %w, args: %v, stdout: %s, stderr: %s", err, args, sout, serr)
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
