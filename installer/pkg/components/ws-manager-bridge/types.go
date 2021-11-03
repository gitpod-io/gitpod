// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagerbridge

// Configuration from components/ws-manager-bridge/src/config.ts
type Configuration struct {
	Installation                        string             `json:"installation"`
	StaticBridges                       []WorkspaceCluster `json:"staticBridges"`
	ClusterService                      ClusterService     `json:"clusterService"`
	WSClusterDBReconcileIntervalSeconds int32              `json:"wsClusterDBReconcileIntervalSeconds"`
	ControllerIntervalSeconds           int32              `json:"controllerIntervalSeconds"`
	ControllerMaxDisconnectSeconds      int32              `json:"controllerMaxDisconnectSeconds"`
	MaxTimeToRunningPhaseSeconds        int32              `json:"maxTimeToRunningPhaseSeconds"`
	Timeouts                            Timeouts           `json:"timeouts"`
}

type ClusterService struct {
	Port int32  `json:"port"`
	Host string `json:"host"`
}

type Timeouts struct {
	MetaInstanceCheckIntervalSeconds int32 `json:"metaInstanceCheckIntervalSeconds"`
	PreparingPhaseSeconds            int32 `json:"preparingPhaseSeconds"`
	StoppingPhaseSeconds             int32 `json:"stoppingPhaseSeconds"`
	UnknownPhaseSeconds              int32 `json:"unknownPhaseSeconds"`
}

// WorkspaceCluster from components/gitpod-protocol/src/workspace-cluster.ts
type WorkspaceCluster struct {
	Name                 string                `json:"name"`
	URL                  string                `json:"url"`
	TLS                  WorkspaceClusterTLS   `json:"tls"`
	State                WorkspaceClusterState `json:"state"`
	MaxScore             int32                 `json:"maxScore"`
	Score                int32                 `json:"score"`
	Govern               bool                  `json:"govern"`
	AdmissionConstraints []AdmissionConstraint `json:"admissionConstraints"`
}

// WorkspaceClusterTLS is the struct we use in ws-manager-bridge cluster registrations.
type WorkspaceClusterTLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	Key         string `json:"key"`
}

// WorkspaceClusterState from components/gitpod-protocol/src/workspace-cluster.ts
type WorkspaceClusterState string

const (
	WorkspaceClusterStateAvailable WorkspaceClusterState = "available"
	WorkspaceClusterStateCordoned  WorkspaceClusterState = "cordoned"
	WorkspaceClusterStateDraining  WorkspaceClusterState = "draining"
)

type AdmissionConstraint struct {
	Type       AdmissionConstraintType       `json:"type"`
	Permission AdmissionConstraintPermission `json:"permission"`
}

type AdmissionConstraintType string

const (
	AdmissionConstraintFeaturePreview AdmissionConstraintType = "has-feature-preview"
	AdmissionConstraintHasRole        AdmissionConstraintType = "has-permission"
)

type AdmissionConstraintPermission string

const (
	AdmissionConstraintPermissionMonitor             AdmissionConstraintPermission = "monitor"
	AdmissionConstraintPermissionEnforcement         AdmissionConstraintPermission = "enforcement"
	AdmissionConstraintPermissionPrivilegedWS        AdmissionConstraintPermission = "privileged-ws"
	AdmissionConstraintPermissionRegistryAccess      AdmissionConstraintPermission = "registry-access"
	AdmissionConstraintPermissionAdminUsers          AdmissionConstraintPermission = "admin-users"
	AdmissionConstraintPermissionAdminWorkspaces     AdmissionConstraintPermission = "admin-workspaces"
	AdmissionConstraintPermissionAdminApi            AdmissionConstraintPermission = "admin-api"
	AdmissionConstraintPermissionIDESettings         AdmissionConstraintPermission = "ide-settings"
	AdmissionConstraintPermissionNewWorkspaceCluster AdmissionConstraintPermission = "new-workspace-cluster"
	AdmissionConstraintPermissionTeamsAndProjects    AdmissionConstraintPermission = "teams-and-projects"
)
