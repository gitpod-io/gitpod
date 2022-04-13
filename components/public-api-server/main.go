// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
)

func main() {
	errors := make(chan error)
	defer close(errors)

	go func() {
		addr := ":9000"
		fmt.Println("Serving HTTP", addr)
		err := http.ListenAndServe(addr, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`hello world\n`))
		}))
		if err != nil {
			fmt.Println("Failed to serve HTTP on", addr, err)
			errors <- err
		}
	}()

	go func() {
		if err := serveGRPC(); err != nil {
			fmt.Println("Failed to serve gRPC", err)
			errors <- err
		}
	}()

	// detect OS signals
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errors:
		fmt.Println("Encountered errors when running servers", err)
		os.Exit(1)
	case <-sigs:
		fmt.Println("Received termination signal, shutting down.")
		// TODO(milanpavlik): Graceful server shutdown
		os.Exit(0)
	}
}

func serveGRPC() error {
	port := 9001
	srv := grpc.NewServer()

	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", port)
	}

	fmt.Println("Serving gRPC", listener.Addr().String())
	if serveErr := srv.Serve(listener); err != nil {
		return fmt.Errorf("failed to serve gRPC: %w", serveErr)
	}

	return nil
}
