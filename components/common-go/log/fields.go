// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package log

import log "github.com/sirupsen/logrus"

const (
	UserIDField = "userId"
	// OwnerIDField is the log field name of a workspace owner
	OwnerIDField = UserIDField
	// WorkspaceIDField is the log field name of a workspace ID (not instance ID)
	WorkspaceIDField = "workspaceId"
	// WorkspaceInstanceIDField is the log field name of a workspace instance ID
	WorkspaceInstanceIDField = "instanceId"
	// ProjectIDField is the log field name of the project
	ProjectIDField = "projectId"
	// TeamIDField is the log field name of the team
	TeamIDField = "teamId"

	OrganizationIDField = "orgId"

	ServiceContextField        = "serviceContext"
	PersonalAccessTokenIDField = "patId"
	OIDCClientConfigIDField    = "oidcClientConfigId"
)

// OWI builds a structure meant for logrus which contains the owner, workspace and instance.
// Beware that this refers to the terminology outside of wsman which maps like:
//
//	owner = owner, workspace = metaID, instance = workspaceID
func OWI(owner, workspace, instance string) log.Fields {
	return log.Fields{
		OwnerIDField:             owner,
		WorkspaceIDField:         workspace,
		WorkspaceInstanceIDField: instance,
	}
}

// LogContext builds a structure meant for logrus which contains the owner, workspace and instance.
// Beware that this refers to the terminology outside of wsman which maps like:
//
//	owner = owner, workspace = metaID, instance = workspaceID
func LogContext(ownerID, workspaceID, instanceID, projectID, orgID string) log.Fields {
	return Compose(
		WorkspaceOwner(ownerID),
		WorkspaceID(workspaceID),
		WorkspaceInstanceID(instanceID),
		ProjectID(projectID),
		OrganizationID(orgID),
	)
}

func WorkspaceOwner(owner string) log.Fields {
	return String(OwnerIDField, owner)
}

func WorkspaceID(workspaceID string) log.Fields {
	return String(WorkspaceIDField, workspaceID)
}

func WorkspaceInstanceID(instanceID string) log.Fields {
	return String(WorkspaceInstanceIDField, instanceID)
}

func ProjectID(projectID string) log.Fields {
	return String(ProjectIDField, projectID)
}

func OrganizationID(orgID string) log.Fields {
	return Compose(
		// We continue to log TeamID in place of Organization for compatibility.
		String(TeamIDField, orgID),
		String(OrganizationIDField, orgID),
	)
}

func PersonalAccessTokenID(patID string) log.Fields {
	return String(PersonalAccessTokenIDField, patID)
}

func OIDCClientConfigID(id string) log.Fields {
	return String(OIDCClientConfigIDField, id)
}

func UserID(userID string) log.Fields {
	return String(UserIDField, userID)
}

// Compose composes multiple sets of log.Fields into a single
func Compose(fields ...log.Fields) log.Fields {
	res := log.Fields{}
	for _, f := range fields {
		for key, val := range f {
			res[key] = val
		}
	}
	return res
}

// ServiceContext is the shape required for proper error logging in the GCP context.
// See https://cloud.google.com/error-reporting/reference/rest/v1beta1/ServiceContext
// Note that we musn't set resourceType for reporting errors.
type serviceContext struct {
	Service string `json:"service"`
	Version string `json:"version"`
}

func ServiceContext(service, version string) log.Fields {
	return log.Fields{
		ServiceContextField: serviceContext{service, version},
	}
}

func String(key, value string) log.Fields {
	return log.Fields{key: value}
}
