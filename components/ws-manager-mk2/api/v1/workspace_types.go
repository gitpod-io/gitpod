// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// WorkspaceSpec defines the desired state of Workspace
type WorkspaceSpec struct {
	Ownership Ownership `json:"ownership"`

	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Enum:=Regular;Prebuild;ImageBuild
	Type WorkspaceType `json:"type"`

	Image WorkspaceImages `json:"image"`

	Initializer []byte `json:"initializer"`

	Envvars []corev1.EnvVar `json:"envvars,omitempty"`

	WorkspaceLocation string `json:"workspaceLocation"`

	Git GitSpec `json:"git"`

	Timeout TimeoutSpec `json:"timeout"`

	Admission AdmissionSpec `json:"admission"`
}

type Ownership struct {
	Owner       string `json:"owner"`
	WorkspaceID string `json:"workspaceID"`
	Team        string `json:"team,omitempty"`
	Tenant      string `json:"tenant,omitempty"`
}

type WorkspaceType string

const (
	WorkspaceTypeRegular    WorkspaceType = "Regular"
	WorkspaceTypePrebuild   WorkspaceType = "Prebuild"
	WorkspaceTypeImageBuild WorkspaceType = "ImageBuild"
)

type WorkspaceImages struct {
	Workspace WorkspaceImage `json:"workspace"`
	IDE       IDEImages      `json:"ide"`
}

type WorkspaceImage struct {
	Ref *string `json:"ref,omitempty"`
}

type IDEImages struct {
	Web        string `json:"web"`
	Desktop    string `json:"desktop"`
	Supervisor string `json:"supervisor"`
}

type GitSpec struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

type TimeoutSpec struct {
	Time *string `json:"time,omitempty"`
}

type AdmissionSpec struct {
	Level AdmissionLevel `json:"level"`
}

type AdmissionLevel string

const (
	AdmissionLevelOwner    AdmissionLevel = "owner"
	AdmissionLevelEveryone AdmissionLevel = "everyone"
)

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	// INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
	// Important: Run "make" to regenerate code after modifying this file

	Available  bool                `json:"available"`
	Headless   bool                `json:"headless"`
	URL        string              `json:"url"`
	Phase      WorkspacePhase      `json:"phase"`
	Conditions WorkspaceConditions `json:"conditions"`
	Results    *WorkspaceResults   `json:"results,omitempty"`
}

type WorkspacePhase string

const (
	WorkspacePhasePending      WorkspacePhase = "pending"
	WorkspacePhaseImageBuild   WorkspacePhase = "imagebuild"
	WorkspacePhaseCreating     WorkspacePhase = "creating"
	WorkspacePhaseInitializing WorkspacePhase = "initializing"
	WorkspacePhaseRunning      WorkspacePhase = "running"
	WorkspacePhaseStopping     WorkspacePhase = "stopping"
	WorkspacePhaseStopped      WorkspacePhase = "stopped"
)

type WorkspaceConditions struct {
	// Failed contains the reason the workspace failed to operate. If this field is empty, the workspace has not failed.
	Failed string `json:"failed,omitempty"`

	// Timeout contains the reason the workspace has timed out. If this field is empty, the workspace has not timed out.
	Timeout string `json:"timeout,omitempty"`

	// FirstUserActivity is the time when MarkActive was first called on the workspace
	FirstUserActivity *metav1.Time `json:"firstUserActivity,omitempty"`

	// HeadlessTaskFailed indicates that a headless workspace task failed
	HeadlessTaskFailed string `json:"headlessTaskFailed,omitempty"`

	// StoppedByRequest is true if the workspace was stopped using a StopWorkspace call
	StoppedByRequest *bool `json:"stoppedByRequest,omitempty"`
}

type WorkspaceResults struct {
	// Snapshot contains a snapshot URL if a snapshot was produced prior to shutting the workspace down. This condition is only used for headless workspaces.
	Snapshot string `json:"snapshot,omitempty"`

	// HeadlessTaskFailed indicates that a headless workspace task failed
	HeadlessTaskFailed string `json:"headlessTaskFailed,omitempty"`
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
