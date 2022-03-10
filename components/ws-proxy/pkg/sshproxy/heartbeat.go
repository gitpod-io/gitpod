// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sshproxy

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

type Heartbeat interface {
	// SendHeartbeat sends a heartbeat for a workspace
	SendHeartbeat(instanceID string, isClosed bool)
}

type noHeartbeat struct{}

func (noHeartbeat) SendHeartbeat(instanceID string, isClosed bool) {}

type WorkspaceManagerHeartbeat struct {
	Client wsmanapi.WorkspaceManagerClient
}

func (m *WorkspaceManagerHeartbeat) SendHeartbeat(instanceID string, isClosed bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := m.Client.MarkActive(ctx, &wsmanapi.MarkActiveRequest{
		Id:     instanceID,
		Closed: isClosed,
	})
	if err != nil {
		log.WithError(err).Warn("cannot send heartbeat for workspace instance")
	} else {
		log.WithField("instanceId", instanceID).Debug("sent heartbeat to ws-manager")
	}
}
