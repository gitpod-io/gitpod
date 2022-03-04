// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package integration

import (
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/rpc"
	"os"
	"os/signal"
	"strconv"
	"syscall"
)

// ServeAgent is the main entrypoint for agents. It establishes flags and starts an RPC server
// on a port passed as flag.
func ServeAgent(rcvr interface{}) {
	defaultPort, _ := strconv.Atoi(os.Getenv("AGENT_RPC_PORT"))
	port := flag.Int("rpc-port", defaultPort, "the port on wich to run the RPC server on")
	flag.Parse()

	ta := &testAgent{
		Done: make(chan struct{}),
	}

	err := rpc.RegisterName("TestAgent", ta)
	if err != nil {
		log.Fatalf("cannot register test agent service: %q", err)
	}
	err = rpc.Register(rcvr)
	if err != nil {
		log.Fatalf("cannot register agent service: %q", err)
	}
	rpc.HandleHTTP()
	addr := fmt.Sprintf(":%d", *port)
	l, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("cannot start RPC server on :%d", *port)
	}

	go func() {
		err := http.Serve(l, nil)
		if err != nil {
			log.Fatalf("cannot start RPC server on :%d", *port)
		}
	}()

	fmt.Printf("agent running on %s\n", addr)
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	select {
	case <-sigChan:
	case <-ta.Done:
	}
	fmt.Println("shutting down")
}

type testAgent struct {
	Done chan struct{}
}

const (
	// MethodTestAgentShutdown refers to the shutdown method of the TestAgent service
	MethodTestAgentShutdown = "TestAgent.Shutdown"
)

// TestAgentShutdownRequest are the arguments for MethodTestAgentShutdown
type TestAgentShutdownRequest struct{}

// TestAgentShutdownResponse is the response of MethodTestAgentShutdown
type TestAgentShutdownResponse struct{}

func (t *testAgent) Shutdown(args *TestAgentShutdownRequest, reply *TestAgentShutdownResponse) error {
	close(t.Done)
	*reply = TestAgentShutdownResponse{}
	return nil
}
