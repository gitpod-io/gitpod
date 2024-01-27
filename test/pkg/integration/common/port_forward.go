// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os/exec"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"
)

const (
	errorDialingBackend = "error: error upgrading connection: error dialing backend: EOF"
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
		defer func() {
			if command.Process != nil {
				_ = command.Process.Kill()
			}
		}()
		if err != nil {
			if strings.TrimSuffix(serr.String(), "\n") == errorDialingBackend {
				errchan <- io.EOF
			} else {
				errchan <- fmt.Errorf("unexpected error string port-forward: %w", errors.New(serr.String()))
			}
		}

		err = command.Wait()
		if err != nil {
			if strings.TrimSuffix(serr.String(), "\n") == errorDialingBackend {
				errchan <- io.EOF
			} else {
				errchan <- fmt.Errorf("unexpected error running port-forward: %w", errors.New(serr.String()))
			}
		}
	}()

	// wait until we can reach the local port before signaling we are ready
	go func() {
		localPort := strings.Split(port, ":")[0]
		waitErr := wait.PollImmediate(500*time.Millisecond, 1*time.Minute, func() (bool, error) {
			conn, err := net.DialTimeout("tcp", net.JoinHostPort("localhost", localPort), 1*time.Second)
			if err != nil {
				return false, nil
			}
			if conn == nil {
				return false, nil
			}

			conn.Close()
			return true, nil
		})

		if waitErr == wait.ErrWaitTimeout {
			errchan <- fmt.Errorf("timeout waiting for port-foward: %w", waitErr)
			return
		} else if waitErr != nil {
			errchan <- waitErr
			return
		} else {
			readychan <- struct{}{}

		}
	}()

	return readychan, errchan
}
