// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package lift

// Lift can execute commands in a namespace context and return the stdin/out/err FDs
// to the caller. This allows us to lift commands into ring1, akin to `docker exec`.

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/sys/unix"
)

const (
	DefaultSocketPath = "/tmp/workspacekit-lift.socket"
)

type LiftRequest struct {
	Command []string `json:"command"`
}

func ServeLift(ctx context.Context, socket string) error {
	skt, err := net.Listen("unix", socket)
	if err != nil {
		return err
	}

	defer func() {
		err := skt.Close()
		if err != nil {
			log.WithError(err).Error("unexpected error closing listener")
		}
	}()

	for {
		select {
		case <-ctx.Done():
			break
		default:
			// pass through
		}

		conn, err := skt.Accept()
		if err != nil {
			log.WithError(err).Error("cannot accept lift connection")
			continue
		}

		go func() {
			err := serveLiftClient(conn)
			if err != nil {
				log.WithError(err).Error("cannot serve lift connection")
			}
		}()
	}
}

func serveLiftClient(conn net.Conn) error {
	unixConn := conn.(*net.UnixConn)

	f, err := unixConn.File()
	if err != nil {
		return err
	}

	defer func() {
		err := f.Close()
		if err != nil {
			log.WithError(err).Error("unexpected error closing connection")
		}

		err = conn.Close()
		if err != nil {
			log.WithError(err).Error("unexpected error closing connection")
		}
	}()

	buf := make([]byte, unix.CmsgSpace(3*4)) // we expect 3 FDs
	_, _, _, _, err = unix.Recvmsg(int(f.Fd()), nil, buf, 0)
	if err != nil {
		return err
	}

	msgs, err := unix.ParseSocketControlMessage(buf)
	if err != nil {
		return err
	}

	if len(msgs) != 1 {
		return fmt.Errorf("expected a single socket control message")
	}

	fds, err := unix.ParseUnixRights(&msgs[0])
	if err != nil {
		return err
	}

	if len(fds) != 3 {
		return fmt.Errorf("expected three file descriptors")
	}

	rd := bufio.NewReader(f)
	line, err := rd.ReadBytes('\n')
	if err != nil {
		return err
	}

	var msg LiftRequest
	err = json.Unmarshal(line, &msg)
	if err != nil {
		return err
	}

	if len(msg.Command) == 0 {
		return fmt.Errorf("expected non-empty command")
	}

	log.WithField("command", msg.Command).Info("running lifted command")

	cmd := exec.Command(msg.Command[0], msg.Command[1:]...)
	cmd.SysProcAttr = &unix.SysProcAttr{
		Setpgid: true,
	}
	cmd.Stdout = os.NewFile(uintptr(fds[0]), "stdout")
	cmd.Stderr = os.NewFile(uintptr(fds[1]), "stderr")
	cmd.Stdin = os.NewFile(uintptr(fds[2]), "stdin")

	err = cmd.Start()
	if err != nil {
		return err
	}

	defer func() {
		err := cmd.Process.Kill()
		if err != nil && err.Error() != "os: process already finished" {
			log.WithError(err).Error("unexpected error terminating process")
		}
	}()

	err = cmd.Wait()
	if err != nil {
		log.WithError(err).Error("unexpected error running process")
	}

	return nil
}

func RunCommand(socket string, command []string) error {
	rconn, err := net.Dial("unix", socket)
	if err != nil {
		return err
	}

	conn := rconn.(*net.UnixConn)
	f, err := conn.File()
	if err != nil {
		return err
	}

	defer func() {
		err := f.Close()
		if err != nil {
			log.WithError(err).Error("unexpected error closing lift connection")
		}
	}()

	err = unix.Sendmsg(int(f.Fd()), nil, unix.UnixRights(int(os.Stdout.Fd()), int(os.Stderr.Fd()), int(os.Stdin.Fd())), nil, 0)
	if err != nil {
		return err
	}

	msg, err := json.Marshal(LiftRequest{Command: command})
	if err != nil {
		return err
	}

	_, err = conn.Write(msg)
	if err != nil {
		return err
	}

	_, err = conn.Write([]byte{'\n'})
	if err != nil {
		return err
	}

	buf := make([]byte, 128)
	for n, err := conn.Read(buf); err == nil; n, err = conn.Read(buf) {
		if bytes.Equal([]byte("done"), buf[:n]) {
			break
		}

		time.Sleep(10 * time.Millisecond)
	}
	fmt.Println("done")

	return nil
}
