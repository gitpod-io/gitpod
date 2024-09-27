// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/ws-manager/api"
	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	// Used as key for storing the workspace port in the requests mux.Vars() map.
	WorkspacePortIdentifier = "workspacePort"

	// Used as key for storing the workspace ID in the requests mux.Vars() map.
	WorkspaceIDIdentifier = "workspaceID"

	DebugWorkspaceIdentifier = "debugWorkspace"

	WorkspacePathPrefixIdentifier = "workspacePathPrefix"

	WorkspaceInfoIdentifier = "workspaceInfo"

	ForeignContentIdentifier = "foreignContent"
)

// WorkspaceCoords represents the coordinates of a workspace (port).
type WorkspaceCoords struct {
	// The workspace ID
	ID string
	// The workspace port
	Port string
	// Debug workspace
	Debug bool
	// Foreign content
	Foreign bool
}

// WorkspaceInfoProvider is an entity that is able to provide workspaces related information.
type WorkspaceInfoProvider interface {
	// WorkspaceInfo returns the workspace information of a workspace using it's workspace ID
	WorkspaceInfo(workspaceID string) *WorkspaceInfo

	AcquireContext(ctx context.Context, workspaceID, port string) (context.Context, string, error)
	ReleaseContext(id string)
}

// WorkspaceInfo is all the infos ws-proxy needs to know about a workspace.
type WorkspaceInfo struct {
	WorkspaceID string
	InstanceID  string
	URL         string

	IDEImage        string
	SupervisorImage string

	// (parsed from URL)
	IDEPublicPort string

	IPAddress string

	Ports []*api.PortSpec

	Auth      *wsapi.WorkspaceAuthentication
	StartedAt time.Time

	OwnerUserId   string
	SSHPublicKeys []string
	IsRunning     bool

	IsEnabledSSHCA bool
	IsManagedByMk2 bool
}
