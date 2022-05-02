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
	// +kubebuilder:validation:Required
	Ownership Ownership `json:"ownership"`

	// +kubebuilder:validation:Required
	// +kubebuilder:validation:Enum:=Regular;Prebuild;ImageBuild
	Type WorkspaceType `json:"type"`

	Class string `json:"class"`

	// +kubebuilder:validation:Required
	Image WorkspaceImages `json:"image"`

	Initializer []byte `json:"initializer"`

	Envvars []corev1.EnvVar `json:"envvars,omitempty"`

	// +kubebuilder:validation:Required
	WorkspaceLocation string `json:"workspaceLocation"`

	Git *GitSpec `json:"git,omitempty"`

	Timeout TimeoutSpec `json:"timeout"`

	Admission AdmissionSpec `json:"admission"`

	Ports []PortSpec `json:"ports,omitempty"`
}

type Ownership struct {
	// +kubebuilder:validation:Required
	Owner string `json:"owner"`
	// +kubebuilder:validation:Required
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
	Time *metav1.Duration `json:"time,omitempty"`
}

type AdmissionSpec struct {
	Level AdmissionLevel `json:"level"`
}

type AdmissionLevel string

const (
	AdmissionLevelOwner    AdmissionLevel = "owner"
	AdmissionLevelEveryone AdmissionLevel = "everyone"
)

type PortSpec struct {
	// +kubebuilder:validation:Required
	Port uint32 `json:"port"`

	// +kubebuilder:validation:Required
	Visibility AdmissionLevel `json:"visibility"`
}

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	// INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
	// Important: Run "make" to regenerate code after modifying this file

	PodStarts  int    `json:"podStarts"`
	Headless   bool   `json:"headless"`
	URL        string `json:"url,omitempty"`
	OwnerToken string `json:"ownerToken,omitempty"`

	// +kubebuilder:validation:Optional
	Phase WorkspacePhase `json:"phase,omitempty"`
	// +kubebuilder:validation:Optional
	Conditions WorkspaceConditions      `json:"conditions,omitempty"`
	Results    *WorkspaceResults        `json:"results,omitempty"`
	Disposal   *WorkspaceDisposalStatus `json:"disposal,omitempty"`

	Runtime *WorkspaceRuntimeStatus `json:"runtime,omitempty"`
}

type WorkspacePhase string

const (
	WorkspacePhaseUnknown      WorkspacePhase = "unknown"
	WorkspacePhasePending      WorkspacePhase = "pending"
	WorkspacePhaseImageBuild   WorkspacePhase = "imagebuild"
	WorkspacePhaseCreating     WorkspacePhase = "creating"
	WorkspacePhaseInitializing WorkspacePhase = "initializing"
	WorkspacePhaseRunning      WorkspacePhase = "running"
	WorkspacePhaseStopping     WorkspacePhase = "stopping"
	WorkspacePhaseStopped      WorkspacePhase = "stopped"
)

type WorkspaceConditions struct {
	// Deployed indicates if a workspace pod is currently deployed.
	// If this condition is false, there is no means for the user to alter the workspace content.
	Deployed bool `json:"deployed,omitempty"`

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

	// EverReady becomes true if the workspace was ever ready to be used
	EverReady bool `json:"everReady,omitempty"`
}

type WorkspaceResults struct {
	// Snapshot contains a snapshot URL if a snapshot was produced prior to shutting the workspace down. This condition is only used for headless workspaces.
	Snapshot string `json:"snapshot,omitempty"`

	// HeadlessTaskFailed indicates that a headless workspace task failed
	HeadlessTaskFailed string `json:"headlessTaskFailed,omitempty"`
}

// workspaceDisposalStatus indicates the status of the workspace diposal
type WorkspaceDisposalStatus struct {
	BackupComplete bool       `json:"backupComplete,omitempty"`
	BackupFailure  string     `json:"backupFailure,omitempty"`
	GitStatus      *GitStatus `json:"git,omitempty"`
}

type GitStatus struct {
	// branch is branch we're currently on
	Branch string `json:"branch,omitempty"`
	// latest_commit is the most recent commit on the current branch
	LatestCommit string `json:"latest_commit,omitempty"`
	// uncommited_files is the number of uncommitted files, possibly truncated
	UncommitedFiles []string `json:"uncommited_files,omitempty"`
	// the total number of uncommited files
	TotalUncommitedFiles int64 `json:"total_uncommited_files,omitempty"`
	// untracked_files is the number of untracked files in the workspace, possibly truncated
	UntrackedFiles []string `json:"untracked_files,omitempty"`
	// the total number of untracked files
	TotalUntrackedFiles int64 `json:"total_untracked_files,omitempty"`
	// unpushed_commits is the number of unpushed changes in the workspace, possibly truncated
	UnpushedCommits []string `json:"unpushed_commits,omitempty"`
	// the total number of unpushed changes
	TotalUnpushedCommits int64 `json:"total_unpushed_commits,omitempty"`
}

type WorkspaceRuntimeStatus struct {
	NodeName string `json:"nodeName,omitempty"`
	PodName  string `json:"podName,omitempty"`
	PodIP    string `json:"podIP,omitempty"`
	HostIP   string `json:"hostIP,omitempty"`
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
