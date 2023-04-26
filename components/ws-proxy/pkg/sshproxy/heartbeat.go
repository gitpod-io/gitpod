// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package sshproxy

import (
	"context"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	tracker "github.com/gitpod-io/gitpod/ws-proxy/pkg/analytics"
)

type Heartbeat interface {
	// SendHeartbeat sends a heartbeat for a workspace
	SendHeartbeat(instanceID string, isClosed, ignoreIfActive bool)
	// ScheduleIDEHeartbeatTelemetry starts a schedules the IDE heartbeat telemetry per 15 minutes
	ScheduleIDEHeartbeatTelemetry(ctx context.Context, session *Session)
}

type noHeartbeat struct{}

var _ Heartbeat = &noHeartbeat{}

func (noHeartbeat) SendHeartbeat(instanceID string, isClosed, ignoreIfActive bool) {}

func (*noHeartbeat) ScheduleIDEHeartbeatTelemetry(ctx context.Context, session *Session) {}

type WorkspaceManagerHeartbeat struct {
	Client wsmanapi.WorkspaceManagerClient

	gitpodHost      string
	totalCount      int
	successfulCount int
	counterMutex    sync.Mutex
}

var _ Heartbeat = &WorkspaceManagerHeartbeat{}

func NewWorkspaceManagerHeartbeat(gitpodHost string, client wsmanapi.WorkspaceManagerClient) *WorkspaceManagerHeartbeat {
	m := &WorkspaceManagerHeartbeat{
		Client:          client,
		gitpodHost:      gitpodHost,
		totalCount:      0,
		successfulCount: 0,
	}
	return m
}

func (m *WorkspaceManagerHeartbeat) SendHeartbeat(instanceID string, isClosed, ignoreIfActive bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := m.Client.MarkActive(ctx, &wsmanapi.MarkActiveRequest{
		Id:             instanceID,
		Closed:         isClosed,
		IgnoreIfActive: ignoreIfActive,
	})
	m.counterMutex.Lock()
	defer m.counterMutex.Unlock()
	m.totalCount += 1
	if err != nil {
		log.WithError(err).Warn("cannot send heartbeat for workspace instance")
	} else {
		m.successfulCount += 1
		log.WithField("instanceId", instanceID).Debug("sent heartbeat to ws-manager")
	}
}

func (m *WorkspaceManagerHeartbeat) ScheduleIDEHeartbeatTelemetry(ctx context.Context, session *Session) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			m.sendIDEHeartbeatTelemetry(session)
		case <-ctx.Done():
			m.sendIDEHeartbeatTelemetry(session)
			return
		}
	}
}

func (m *WorkspaceManagerHeartbeat) sendIDEHeartbeatTelemetry(session *Session) {
	m.counterMutex.Lock()
	defer m.counterMutex.Unlock()
	properties := make(map[string]interface{})
	properties["clientKind"] = "ssh"
	properties["totalCount"] = m.totalCount
	properties["successfulCount"] = m.successfulCount
	properties["workspaceId"] = session.WorkspaceID
	properties["instanceId"] = session.InstanceID
	properties["gitpodHost"] = m.gitpodHost
	// TODO: Identify if it's debug workspace or not
	// propertics["debugWorkspace"] = "false"

	tracker.Track(analytics.TrackMessage{
		Identity:   analytics.Identity{UserID: session.OwnerUserId},
		Event:      "ide_heartbeat",
		Properties: properties,
	})
	m.totalCount = 0
	m.successfulCount = 0
}
