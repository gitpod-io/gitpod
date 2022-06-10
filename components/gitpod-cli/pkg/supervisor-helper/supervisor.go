// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"
	"os"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func Dial(ctx context.Context) (*grpc.ClientConn, error) {
	supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
	if supervisorAddr == "" {
		supervisorAddr = "localhost:22999"
	}
	supervisorConn, err := grpc.DialContext(ctx, supervisorAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		err = xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	return supervisorConn, err
}
