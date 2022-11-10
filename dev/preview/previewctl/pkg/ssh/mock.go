// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ssh

import (
	"context"
	"io"

	"github.com/cockroachdb/errors"
)

var _ Client = &MockClient{}

type MockCmd struct {
	CMD    string
	STDOUT []byte
	STDERR []byte
	Err    error
}

type MockClient struct {
	Command MockCmd
}

func (m MockClient) Close() error {
	return nil
}

func (m MockClient) Run(ctx context.Context, cmd string, stdout io.Writer, stderr io.Writer) error {
	if m.Command.CMD != cmd {
		return errors.New("command not found")
	}

	_, _ = stdout.Write(m.Command.STDOUT)
	_, _ = stderr.Write(m.Command.STDERR)
	return m.Command.Err
}
