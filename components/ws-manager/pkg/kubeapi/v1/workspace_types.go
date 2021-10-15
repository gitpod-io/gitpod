// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

/*

 */

package v1

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// WorkspaceSpec defines the desired state of Workspace
type WorkspaceSpec struct {
	// INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
	// Important: Run "generate.sh" to regenerate code after modifying this file

	Metadata WorkspaceSpecMetadata `json:"metadata"`

	Workspace     WorkspaceSpecProper        `json:"workspace"`
	Orchestration WorkspaceSpecOrchestration `json:"orchestration"`
}

type WorkspaceSpecMetadata struct {
	// servicePrefix is the prefix used to create the workspace services
	ServicePrefix string `json:"servicePrefix,omitempty"`

	// Owner is the user who owns this workspace
	Owner string `json:"owner,omitempty"`

	// WorkspaceID is the ID of the workspace whose instance we're running
	WorkspaceID string `json:"workspaceID"`
}

type WorkspaceSpecOrchestration struct {
	URL string `json:"url"`
}

type WorkspaceSpecProper struct {
	Type              WorkspaceType   `json:"type"`
	WorkspaceImage    string          `json:"workspaceImage"`
	IDEImage          string          `json:"ideImage"`
	Initializer       []byte          `json:"initializer"`
	Env               []corev1.EnvVar `json:"env"`
	CheckoutLocation  string          `json:"checkoutLocation,omitempty"`
	WorkspaceLocation string          `json:"workspaceLocation,omitempty"`
	Git               *GitSpec        `json:"git,omitempty"`
	Timeout           string          `json:"timeout,omitempty"`
	Auth              AuthSpec        `json:"auth"`
}

type AuthSpec struct {
	OwnerToken string         `json:"ownerToken,omitempty"`
	Admission  AdmissionLevel `json:"admission,omitempty"`
}

type WorkspaceType string

const (
	WorkspaceTypeRegular    WorkspaceType = "regular"
	WorkspaceTypePrebuild   WorkspaceType = "prebuild"
	WorkspaceTypeGhost      WorkspaceType = "ghost"
	WorkspaceTypeImageBuild WorkspaceType = "imagebuild"
	WorkspaceTypeProbe      WorkspaceType = "probe"
)

type GitSpec struct {
	Username string `json:"username,omitempty"`
	Email    string `json:"email,omitempty"`
}

type AdmissionLevel string

const (
	AdmissionOwnerOnly AdmissionLevel = ""
	AdmissionEveryone  AdmissionLevel = "everyone"
)

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	// INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
	// Important: Run "./generate.sh" to regenerate code after modifying this file
	Pod string `json:"pod,omitempty"`

	Headless   bool         `json:"headless"`
	Phase      Phase        `json:"phase"`
	Conditions Conditions   `json:"conditions"`
	Message    string       `json:"message,omitempty"`
	Runtime    RuntimeInfo  `json:"runtime,omitempty"`
	Ports      []PortStatus `json:"ports,omitempty"`

	Control WorkspaceControl `json:"control"`
}

type PortStatus struct {
	// port is the outward-facing port
	Port uint32 `json:"port,omitempty"`
	// target is the inward-facing target port
	Target uint32 `json:"target,omitempty"`
	// visibility defines the visibility of the port
	Visibility AdmissionLevel `json:"visibility,omitempty"`
	// url is the public-facing URL this port is available at
	Url string `json:"url,omitempty"`
}

type WorkspaceControl struct {
	WasEverReady         bool `json:"wasEverReady,omitempty"`
	FailedBeforeStopping bool `json:"failedBeforeStopping,omitempty"`
}

type Phase string

const (
	PhaseUnknown      Phase = ""
	PhasePending      Phase = "pending"
	PhaseCreating     Phase = "creating"
	PhaseInitializing Phase = "initializing"
	PhaseRunning      Phase = "running"
	PhaseInterrupted  Phase = "interrupted"
	PhaseStopping     Phase = "stopping"
	PhaseStopped      Phase = "stopped"
)

type Conditions struct {
	Failed              string `json:"failed,omitempty"`
	Timeout             string `json:"timeout,omitempty"`
	PullingImages       *bool  `json:"pullingImages,omitempty"`
	ServiceExists       *bool  `json:"serviceExists,omitempty"`
	Snapshot            string `json:"snapshot,omitempty"`
	FinalBackupComplete *bool  `json:"finalBackupComplete,omitempty"`
	Deployed            *bool  `json:"deployed,omitempty"`
	NetworkNotReady     *bool  `json:"networkNotReady,omitempty"`
	FirstUserActivity   string `json:"firstUserActivity,omitempty"`
	HeadlessTaskFailed  string `json:"headlessTaskFailed,omitempty"`
}

type RuntimeInfo struct {
	Node string `json:"node,omitempty"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status

// Workspace is the Schema for the workspaces API
type Workspace struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   WorkspaceSpec   `json:"spec,omitempty"`
	Status WorkspaceStatus `json:"status,omitempty"`
}

func (ws Workspace) OWI() map[string]interface{} {
	return log.OWI(ws.Spec.Metadata.Owner, ws.Spec.Metadata.WorkspaceID, ws.Name)
}

//+kubebuilder:object:root=true

// WorkspaceList contains a list of Workspace
type WorkspaceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Workspace `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Workspace{}, &WorkspaceList{})
}
