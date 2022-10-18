// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/util"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

// TODO(ak) introduce proper abstraction, like SupervisorClient

func Dial(ctx context.Context) (*grpc.ClientConn, error) {
	supervisorConn, err := grpc.DialContext(ctx, util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		err = xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	return supervisorConn, err
}

func WaitForIDEReady(ctx context.Context) error {
	conn, err := Dial(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	client := supervisor.NewStatusServiceClient(conn)

	var ideReady bool
	for !ideReady {
		resp, _ := client.IDEStatus(ctx, &supervisor.IDEStatusRequest{Wait: true})
		if resp != nil {
			ideReady = resp.Ok
		}
		if !ideReady {
			time.Sleep(1 * time.Second)
		}
	}
	return nil
}
