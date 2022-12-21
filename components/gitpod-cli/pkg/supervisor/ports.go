// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"

	"github.com/gitpod-io/gitpod/supervisor/api"
)

func (client *SupervisorClient) GetPortsList(ctx context.Context) ([]*api.PortsStatus, error) {
	portsStatusClient, portsStatusClientError := client.Status.PortsStatus(ctx, &api.PortsStatusRequest{Observe: false})

	if portsStatusClientError != nil {
		return nil, portsStatusClientError
	}

	portsStatusResponse, portsStatusResponseError := portsStatusClient.Recv()

	if portsStatusResponseError != nil {
		return nil, portsStatusResponseError
	}

	return portsStatusResponse.GetPorts(), nil
}
