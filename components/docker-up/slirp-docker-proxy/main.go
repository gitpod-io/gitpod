// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"syscall"

	"golang.org/x/xerrors"
)

const (
	realProxy = "docker-proxy"
)

var (
	containerIP   = flag.String("container-ip", "", "container ip")
	containerPort = flag.Int("container-port", -1, "container port")
	hostIP        = flag.String("host-ip", "", "host ip")
	hostPort      = flag.Int("host-port", -1, "host port")
	proto         = flag.String("proto", "tcp", "proxy protocol")
)

// drop-in replacement for docker-proxy.
// needs to be executed in the child namespace.
func main() {
	f := os.NewFile(3, "signal-parent")
	defer f.Close()
	if err := xmain(f); err != nil {
		// success: "0\n" (written by realProxy)
		// error: "1\n" (written by either rootlesskit-docker-proxy or realProxy)
		fmt.Fprintf(f, "1\n%s", err)
		log.Fatal(err)
	}
}

type request struct {
	Execute   string      `json:"execute"`
	Arguments interface{} `json:"arguments"`
}

type reply struct {
	Return map[string]interface{} `json:"return,omitempty"`
	Error  map[string]interface{} `json:"error,omitempty"`
}

func xmain(f *os.File) error {
	flag.Parse()

	socketPath := os.Getenv("DOCKERUP_SLIRP4NETNS_SOCKET")
	if socketPath == "" {
		return errors.New("$DOCKERUP_SLIRP4NETNS_SOCKET needs to be set")
	}

	// We don't have CAP_NET_BIND_SERVICE outside the network namespace, hence cannot bind
	// to ports < 1024. If we didn't fail here explicitly, slirp4netns would fail strangely.
	if *hostPort < 1024 {
		examplePort, _ := freePort()
		if examplePort == 0 {
			examplePort = 8080
		}
		return xerrors.Errorf("Workspace (host) port needs to be > 1024, e.g. %d:%d instead of %d:%d", examplePort, *containerPort, *hostPort, *containerPort)
	}

	id, err := exposePort(socketPath)
	if err != nil {
		return xerrors.Errorf("cannot expose slirp4net port: %w", err)
	}
	defer func() {
		err := closePort(socketPath, id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "unexpected error closing socket: %v", err)
		}
	}()

	cmd := exec.Command(realProxy,
		"-container-ip", *containerIP,
		"-container-port", strconv.Itoa(*containerPort),
		"-host-ip", "127.0.0.1",
		"-host-port", strconv.Itoa(*hostPort),
		"-proto", *proto)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = os.Environ()
	cmd.ExtraFiles = append(cmd.ExtraFiles, f)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Pdeathsig: syscall.SIGKILL,
	}
	if err := cmd.Start(); err != nil {
		return xerrors.Errorf("error while starting %s: %w", realProxy, err)
	}

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt)
	<-ch
	if err := cmd.Process.Kill(); err != nil {
		return xerrors.Errorf("error while killing %s: %w", realProxy, err)
	}
	return nil
}

func freePort() (int, error) {
	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func exposePort(socketPath string) (id int, err error) {
	type addHostFwdArguments struct {
		Proto     string `json:"proto"`
		HostAddr  string `json:"host_addr"`
		HostPort  int    `json:"host_port"`
		GuestAddr string `json:"guest_addr"`
		GuestPort int    `json:"guest_port"`
	}

	resp, err := sendRequest(socketPath, request{
		Execute: "add_hostfwd",
		Arguments: addHostFwdArguments{
			GuestAddr: "10.0.2.100",
			GuestPort: *hostPort,
			HostAddr:  *hostIP,
			HostPort:  *hostPort,
			Proto:     *proto,
		},
	})
	if err != nil {
		return 0, err
	}

	idIntf, ok := resp["id"]
	if !ok {
		return 0, xerrors.Errorf("unexpected reply: %+v", resp)
	}
	idFloat, ok := idIntf.(float64)
	if !ok {
		return 0, xerrors.Errorf("unexpected id: %+v", idIntf)
	}
	return int(idFloat), nil
}

func closePort(socketPath string, id int) error {
	type removeHostFwdArguments struct {
		ID int `json:"id"`
	}

	_, err := sendRequest(socketPath, request{
		Execute: "remove_hostfwd",
		Arguments: removeHostFwdArguments{
			ID: id,
		},
	})
	return err
}

func sendRequest(socketPath string, req request) (resp map[string]interface{}, err error) {
	conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: socketPath, Net: "unix"})
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if err := json.NewEncoder(conn).Encode(req); err != nil {
		return nil, err
	}
	if err := conn.CloseWrite(); err != nil {
		return nil, err
	}
	b, err := io.ReadAll(conn)
	if err != nil {
		return nil, err
	}
	var rep reply
	if err := json.Unmarshal(b, &rep); err != nil {
		return nil, err
	}

	if len(rep.Error) > 0 {
		return nil, xerrors.Errorf("error reply: %+v", rep.Error)
	}
	return rep.Return, nil
}
