// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"encoding/json"
	"io"
	"net"

	"golang.org/x/xerrors"
)

type SlirpClient interface {
	Expose(port uint32) error
}

type request struct {
	Execute   string      `json:"execute"`
	Arguments interface{} `json:"arguments"`
}

type reply struct {
	Return map[string]interface{} `json:"return,omitempty"`
	Error  map[string]interface{} `json:"error,omitempty"`
}

type Slirp4Netns string

func (s Slirp4Netns) Expose(port uint32) error {
	type addHostFwdArguments struct {
		Proto     string `json:"proto"`
		HostAddr  string `json:"host_addr"`
		HostPort  int    `json:"host_port"`
		GuestAddr string `json:"guest_addr"`
		GuestPort int    `json:"guest_port"`
	}

	_, err := s.sendRequest(request{
		Execute: "add_hostfwd",
		Arguments: addHostFwdArguments{
			GuestAddr: "10.0.2.100",
			GuestPort: int(port),
			HostAddr:  "0.0.0.0",
			HostPort:  int(port),
			Proto:     "tcp",
		},
	})
	if err != nil {
		return err
	}

	return nil
}

func (s Slirp4Netns) sendRequest(req request) (resp map[string]interface{}, err error) {
	conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: string(s), Net: "unix"})
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
