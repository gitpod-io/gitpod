// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// WorkspaceSpec defines the desired state of Workspace
type WorkspaceSpec struct {
	// +kubebuilder:validation:Required
	Ownership Ownership `json:"ownership"`

	// +kubebuilder:validation:Required
	Type WorkspaceType `json:"type"`

	Class string `json:"class"`

	// +kubebuilder:validation:Required
	Image WorkspaceImages `json:"image"`

	Initializer []byte `json:"initializer"`

	Envvars []corev1.EnvVar `json:"envvars,omitempty"`

	// +kubebuilder:validation:Required
	WorkspaceLocation string `json:"workspaceLocation"`

	Git *GitSpec `json:"git,omitempty"`

	Timeout TimeoutSpec `json:"timeout,omitempty"`

	// +kubebuilder:validation:Required
	Admission AdmissionSpec `json:"admission"`

	// +kubebuilder:validation:MinItems=0
	Ports []PortSpec `json:"ports"`
}

type Ownership struct {
	// +kubebuilder:validation:Required
	Owner string `json:"owner"`
	// +kubebuilder:validation:Required
	WorkspaceID string `json:"workspaceID"`
	// +kubebuilder:validation:Optional
	Team string `json:"team,omitempty"`
	// +kubebuilder:validation:Optional
	Tenant string `json:"tenant,omitempty"`
}

// +kubebuilder:validation:Enum=Regular;Prebuild;ImageBuild
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
	Web        string   `json:"web"`
	Refs       []string `json:"refs,omitempty"`
	Supervisor string   `json:"supervisor"`
}

type GitSpec struct {
	Username string `json:"username"`
	Email    string `json:"email"`
}

type TimeoutSpec struct {
	Time *metav1.Duration `json:"time,omitempty"`
}

type AdmissionSpec struct {
	// +kubebuilder:default=Owner
	Level AdmissionLevel `json:"level"`
}

// +kubebuilder:validation:Enum=Owner;Everyone
type AdmissionLevel string

const (
	AdmissionLevelOwner    AdmissionLevel = "Owner"
	AdmissionLevelEveryone AdmissionLevel = "Everyone"
)

type PortSpec struct {
	// +kubebuilder:validation:Required
	Port uint32 `json:"port"`

	// +kubebuilder:validation:Required
	// +kubebuilder:default=Owner
	Visibility AdmissionLevel `json:"visibility"`
}

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	PodStarts  int    `json:"podStarts"`
	Headless   bool   `json:"headless"`
	URL        string `json:"url,omitempty"`
	OwnerToken string `json:"ownerToken,omitempty"`

	// +kubebuilder:default=Unknown
	Phase WorkspacePhase `json:"phase,omitempty"`

	// +kubebuilder:validation:Optional
	Conditions []metav1.Condition `json:"conditions"`

	// Snapshot contains a snapshot URL if a snapshot was produced prior to shutting the workspace down. This condition is only used for headless workspaces.
	// +kubebuilder:validation:Optional
	Snapshot string `json:"snapshot,omitempty"`

	// +kubebuilder:validation:Optional
	GitStatus *GitStatus `json:"git,omitempty"`

	// +kubebuilder:validation:Optional
	Runtime *WorkspaceRuntimeStatus `json:"runtime,omitempty"`
}

// +kubebuilder:validation:Enum=Deployed;Failed;Timeout;UserActivity;HeadlessTaskFailed;StoppedByRequest;EverReady;ContentReady;BackupComplete;BackupFailure
type WorkspaceCondition string

const (
	// Deployed indicates if a workspace pod is currently deployed.
	// If this condition is false, there is no means for the user to alter the workspace content.
	WorkspaceConditionDeployed WorkspaceCondition = "Deployed"

	// Failed contains the reason the workspace failed to operate.
	WorkspaceConditionFailed WorkspaceCondition = "Failed"

	// Timeout contains the reason the workspace has timed out.
	WorkspaceConditionTimeout WorkspaceCondition = "Timeout"

	// UserActivity is the time when MarkActive was first called on the workspace
	WorkspaceConditionFirstUserActivity WorkspaceCondition = "FirstUserActivity"

	// Closed indicates that a workspace is marked as closed. This will shorten its timeout.
	WorkspaceConditionClosed WorkspaceCondition = "Closed"

	// HeadlessTaskFailed indicates that a headless workspace task failed
	WorkspaceConditionsHeadlessTaskFailed WorkspaceCondition = "HeadlessTaskFailed"

	// StoppedByRequest is true if the workspace was stopped using a StopWorkspace call
	WorkspaceConditionStoppedByRequest WorkspaceCondition = "StoppedByRequest"

	// EverReady becomes true if the workspace was ever ready to be used
	WorkspaceConditionEverReady WorkspaceCondition = "EverReady"

	// ContentReady is true once the content initialisation is complete
	WorkspaceConditionContentReady WorkspaceCondition = "ContentReady"

	// BackupComplete is true once the backup has happened
	WorkspaceConditionBackupComplete WorkspaceCondition = "BackupComplete"

	// BackupFailure contains information about the backup failure
	WorkspaceConditionBackupFailure WorkspaceCondition = "BackupFailure"
)

// +kubebuilder:validation:Enum:=Unknown;Pending;Imagebuild;Creating;Initializing;Running;Stopping;Stopped
type WorkspacePhase string

const (
	WorkspacePhaseUnknown      WorkspacePhase = "Unknown"
	WorkspacePhasePending      WorkspacePhase = "Pending"
	WorkspacePhaseImageBuild   WorkspacePhase = "Imagebuild"
	WorkspacePhaseCreating     WorkspacePhase = "Creating"
	WorkspacePhaseInitializing WorkspacePhase = "Initializing"
	WorkspacePhaseRunning      WorkspacePhase = "Running"
	WorkspacePhaseStopping     WorkspacePhase = "Stopping"
	WorkspacePhaseStopped      WorkspacePhase = "Stopped"
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

type GitStatus struct {
	// branch is branch we're currently on
	Branch string `json:"branch,omitempty"`
	// latest_commit is the most recent commit on the current branch
	LatestCommit string `json:"latestCommit,omitempty"`
	// uncommited_files is the number of uncommitted files, possibly truncated
	UncommitedFiles []string `json:"uncommitedFiles,omitempty"`
	// the total number of uncommited files
	TotalUncommitedFiles int64 `json:"totalUncommitedFiles,omitempty"`
	// untracked_files is the number of untracked files in the workspace, possibly truncated
	UntrackedFiles []string `json:"untrackedFiles,omitempty"`
	// the total number of untracked files
	TotalUntrackedFiles int64 `json:"totalUntrackedFiles,omitempty"`
	// unpushed_commits is the number of unpushed changes in the workspace, possibly truncated
	UnpushedCommits []string `json:"unpushedCommits,omitempty"`
	// the total number of unpushed changes
	TotalUnpushedCommits int64 `json:"totalUnpushedCommits,omitempty"`
}

type WorkspaceRuntimeStatus struct {
	NodeName string `json:"nodeName,omitempty"`
	PodName  string `json:"podName,omitempty"`
	PodIP    string `json:"podIP,omitempty"`
	HostIP   string `json:"hostIP,omitempty"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:resource:shortName=ws
// Custom print columns on the Custom Resource Definition. These are the columns
// showing up when doing e.g. `kubectl get workspaces`.
// Columns with priority > 0 will only show up with `-o wide`.
//+kubebuilder:printcolumn:name="Workspace",type="string",JSONPath=".spec.ownership.workspaceID",priority=10
//+kubebuilder:printcolumn:name="Class",type="string",JSONPath=".spec.class"
//+kubebuilder:printcolumn:name="Type",type="string",JSONPath=".spec.type",priority=10
//+kubebuilder:printcolumn:name="Node",type="string",JSONPath=".status.runtime.nodeName"
//+kubebuilder:printcolumn:name="Owner",type="string",JSONPath=".spec.ownership.owner"
//+kubebuilder:printcolumn:name="Team",type="string",JSONPath=".spec.ownership.team"
//+kubebuilder:printcolumn:name="Phase",type="string",JSONPath=".status.phase"
//+kubebuilder:printcolumn:name="Age",type="date",JSONPath=".metadata.creationTimestamp"

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
