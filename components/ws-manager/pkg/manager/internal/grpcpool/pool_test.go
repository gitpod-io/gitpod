// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpcpool_test

import (
	"fmt"
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"

	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/grpcpool"
)

// go tests does execute tests concurrently (each test a goroutine)
// To avoid clashes, we
var lastPort = 22000

var falseConnectionValidationFunc = func(hostIP string) (valid bool) { return false }

func getTestAddr() string {
	// No need to lock() as we do not execute in _parallel_ but _concurrently_
	port := lastPort + 1
	lastPort = port
	return fmt.Sprintf("localhost:%d", port)
}

func getFactory(address string) func(host string) (*grpc.ClientConn, error) {
	return func(host string) (*grpc.ClientConn, error) {
		return grpc.Dial(address, grpc.WithInsecure())
	}
}

func startServer(address string, stop chan struct{}) error {
	server := grpc.NewServer()

	go func() {
		lis, err := net.Listen("tcp", address)
		if err != nil {
			panic(err)
		}
		err = server.Serve(lis)
		if err != nil && err != grpc.ErrServerStopped {
			panic(err)
		}
	}()
	go func() {
		<-stop
		server.Stop()
		stop <- struct{}{}
	}()
	return nil
}

func stopServer(stop chan struct{}) {
	stop <- struct{}{}
	select {
	case <-stop:
		return
	case <-time.After(4 * time.Second):
		panic("stopServer took too long!")
	}
}

func TestFirstGet(t *testing.T) {
	address := getTestAddr()
	stopTest := make(chan struct{}, 1)
	err := startServer(address, stopTest)
	if err != nil {
		t.Skipf("cannot start server: %v", err)
		return
	}
	defer stopServer(stopTest)

	pool := grpcpool.New(getFactory(address), falseConnectionValidationFunc)

	conn, err := pool.Get("foo")
	if err != nil {
		t.Errorf("Get returned error when it shouldn't have: %v", err)
		return
	}
	if conn == nil {
		t.Errorf("Get returned conn == nil")
	}

	connB, err := pool.Get("foo")
	if err != nil {
		t.Errorf("Get returned error when it shouldn't have: %v", err)
		return
	}
	if connB == nil {
		t.Errorf("Get returned conn == nil")
	}
	if connB != conn {
		t.Errorf("Get did not return the same connection")
	}
}

func TestGetShutDown(t *testing.T) {
	address := getTestAddr()
	stopTest := make(chan struct{}, 1)
	err := startServer(address, stopTest)
	if err != nil {
		t.Skipf("cannot start server: %v", err)
		return
	}
	defer stopServer(stopTest)

	pool := grpcpool.New(getFactory(address), falseConnectionValidationFunc)

	conn, err := pool.Get("foo")
	if err != nil {
		t.Errorf("Get returned error when it shouldn't have: %v", err)
		return
	}
	if conn == nil {
		t.Errorf("Get returned conn == nil")
	}

	conn.Close()
	connB, err := pool.Get("foo")
	if err != nil {
		t.Errorf("Get returned error when it shouldn't have: %v", err)
		return
	}
	if connB == nil {
		t.Errorf("Get returned conn == nil")
	}
	if connB == conn {
		t.Errorf("Get returned the same connection although it was closed")
	}
}

func TestClosed(t *testing.T) {
	address := getTestAddr()
	stopTest := make(chan struct{}, 1)
	err := startServer(address, stopTest)
	if err != nil {
		t.Skipf("cannot start server: %v", err)
		return
	}
	defer stopServer(stopTest)

	pool := grpcpool.New(getFactory(address), falseConnectionValidationFunc)

	conn, err := pool.Get("foo")
	if conn == nil || err != nil {
		t.Errorf("Get returned an error or no connection: %v", err)
		return
	}

	err = pool.Close()
	if err != nil {
		t.Errorf("Close returned an error: %v", err)
	}

	if conn.GetState() != connectivity.Shutdown {
		t.Errorf("Close did not close connections in the pool")
	}

	conn, err = pool.Get("foo")
	if err != grpcpool.ErrPoolClosed {
		t.Errorf("Get did not return ErrPoolClosed even though pool was closed")
	}
	if conn != nil {
		t.Errorf("Get returned a connection even though pool was closed")
	}
}

func TestValidateConnections(t *testing.T) {
	address := getTestAddr()
	stopTest := make(chan struct{}, 1)
	err := startServer(address, stopTest)
	if err != nil {
		t.Skipf("cannot start server: %v", err)
		return
	}
	defer stopServer(stopTest)

	checkFn := func(checkAddress string) bool {
		if address != checkAddress {
			t.Errorf("check address is invalid, expected %v, but returned %v", address, checkAddress)
			return false
		}

		return true
	}

	pool := grpcpool.New(getFactory(address), checkFn)

	conn, err := pool.Get(address)
	if err != nil {
		t.Errorf("Get returned error when it shouldn't have: %v", err)
		return
	}
	if conn == nil {
		t.Errorf("Get returned conn == nil")
	}

	pool.ValidateConnections()
}
