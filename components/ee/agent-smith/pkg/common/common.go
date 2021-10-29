// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package common

// Severity describes the severity of the infringement
type Severity string

const (
	// SeverityBarely is a severity level where usually no action is needed.
	SeverityBarely Severity = "barely"
	// SeverityAudit is the severity level used when auditting is needed.
	SeverityAudit Severity = ""
	// SeverityVery is the stronger severity level
	SeverityVery Severity = "very"
)

// Workspace represents a Gitpod workspace
type Workspace struct {
	OwnerID, WorkspaceID, InstanceID string

	// PID is a PID in the tree of the workspace which is a parent of all user workloads
	PID int

	// GitURL is the remote origin of the Git working copy of a workspace
	GitURL string
}
