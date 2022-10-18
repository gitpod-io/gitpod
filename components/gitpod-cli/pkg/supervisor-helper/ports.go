// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"

	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

func GetPortsList(ctx context.Context) ([]*supervisor.PortsStatus, error) {
	conn, err := Dial(ctx)
	if err != nil {
		return nil, err
	}
	client := supervisor.NewStatusServiceClient(conn)
	portsStatusClient, portsStatusClientError := client.PortsStatus(ctx, &supervisor.PortsStatusRequest{Observe: false})

	if portsStatusClientError != nil {
		return nil, portsStatusClientError
	}

	portsStatusResponse, portsStatusResponseError := portsStatusClient.Recv()

	if portsStatusResponseError != nil {
		return nil, portsStatusResponseError
	}

	return portsStatusResponse.GetPorts(), nil
}
