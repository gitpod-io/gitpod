// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	// GitpodFinalizerName is the name of the finalizer we use on workspaces and their pods.
	GitpodFinalizerName = "gitpod.io/finalizer"

	// ReasonInitializationSuccess is a Reason for the WorkspaceConditionContentReady condition,
	// incidating content init succeeded.
	ReasonInitializationSuccess = "InitializationSuccess"
	// ReasonInitializationFailure is a Reason for the WorkspaceConditionContentReady condition,
	// indicating that content init failed. The condition's message will contain the failure details.
	ReasonInitializationFailure = "InitializationFailure"
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

	UserEnvVars []corev1.EnvVar `json:"userEnvVars,omitempty"`

	SysEnvVars []corev1.EnvVar `json:"sysEnvVars,omitempty"`

	// +kubebuilder:validation:Required
	WorkspaceLocation string `json:"workspaceLocation"`

	Git *GitSpec `json:"git,omitempty"`

	Timeout TimeoutSpec `json:"timeout,omitempty"`

	// +kubebuilder:validation:Required
	Admission AdmissionSpec `json:"admission"`

	// +kubebuilder:validation:MinItems=0
	Ports []PortSpec `json:"ports"`

	SshPublicKeys []string `json:"sshPublicKeys,omitempty"`

	// TODO: make StorageQuota Required in the future, avoid for now to avoid runtime failures for existing workspaces

	// the XFS quota to enforce on the workspace's /workspace folder
	StorageQuota int `json:"storageQuota,omitempty"`

	SSHGatewayCAPublicKey string `json:"sshGatewayCAPublicKey,omitempty"`
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
	// +kubebuilder:validation:Type=string
	// +kubebuilder:validation:Pattern="^([0-9]+(\\.[0-9]+)?(ms|s|m|h))+$"
	Time *metav1.Duration `json:"time,omitempty"`
	// +kubebuilder:validation:Type=string
	// +kubebuilder:validation:Pattern="^([0-9]+(\\.[0-9]+)?(ms|s|m|h)?)+$"
	ClosedTimeout *metav1.Duration `json:"closed,omitempty"`
	// +kubebuilder:validation:Type=string
	// +kubebuilder:validation:Pattern="^([0-9]+(\\.[0-9]+)?(ms|s|m|h)?)+$"
	MaximumLifetime *metav1.Duration `json:"maximumLifetime,omitempty"`
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

// +kubebuilder:validation:Enum=Http;Https
type PortProtocol string

const (
	PortProtocolHttp  PortProtocol = "Http"
	PortProtocolHttps PortProtocol = "Https"
)

type PortSpec struct {
	// +kubebuilder:validation:Required
	Port uint32 `json:"port"`

	// +kubebuilder:validation:Required
	// +kubebuilder:default=Owner
	Visibility AdmissionLevel `json:"visibility"`

	// +kubebuilder:validation:Required
	// +kubebuilder:default=Http
	Protocol PortProtocol `json:"protocol"`
}

func (ps PortSpec) Equal(other PortSpec) bool {
	if ps.Port != other.Port {
		return false
	}

	if ps.Visibility != other.Visibility {
		return false
	}

	if ps.Protocol != other.Protocol {
		return false
	}

	return true
}

type WorkspaceImageInfo struct {
	// +kubebuilder:validation:Required
	TotalSize int64 `json:"totalSize"`

	// +kubebuilder:validation:Optional
	WorkspaceImageSize int64 `json:"workspaceImageSize,omitempty"`

	// +kubebuilder:validation:Optional
	WorkspaceImageRef string `json:"workspaceImageRef,omitempty"`
}

// WorkspaceStatus defines the observed state of Workspace
type WorkspaceStatus struct {
	PodStarts int `json:"podStarts"`

	// +kubebuilder:validation:Optional
	PodRecreated int `json:"podRecreated"`
	// +kubebuilder:validation:Optional
	PodDeletionTime *metav1.Time `json:"podDeletionTime,omitempty"`
	// +kubebuilder:validation:Optional
	PodStoppingTime *metav1.Time `json:"podStoppingTime,omitempty"`

	URL        string `json:"url,omitempty" scrub:"redact"`
	OwnerToken string `json:"ownerToken,omitempty" scrub:"redact"`

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

	Storage StorageStatus `json:"storage,omitempty"`

	LastActivity *metav1.Time `json:"lastActivity,omitempty"`

	// +kubebuilder:validation:Optional
	ImageInfo *WorkspaceImageInfo `json:"imageInfo,omitempty"`
}

func (s *WorkspaceStatus) SetCondition(cond metav1.Condition) {
	s.Conditions = wsk8s.AddUniqueCondition(s.Conditions, cond)
}

type StorageStatus struct {
	VolumeName     string `json:"volumeName"`
	AttachedDevice string `json:"attachedDevice"`
	MountPath      string `json:"mountPath"`
}

// +kubebuilder:validation:Enum=Deployed;Failed;Timeout;FirstUserActivity;Closed;HeadlessTaskFailed;StoppedByRequest;Aborted;ContentReady;EverReady;BackupComplete;BackupFailure;Refresh;NodeDisappeared;ThroughputAdjusted
type WorkspaceCondition string

const (
	// Deployed indicates if a workspace pod is currently deployed.
	// If this condition is false, there is no means for the user to alter the workspace content.
	WorkspaceConditionDeployed WorkspaceCondition = "Deployed"

	// Failed contains the reason the workspace failed to operate.
	WorkspaceConditionFailed WorkspaceCondition = "Failed"

	// Timeout contains the reason the workspace has timed out.
	WorkspaceConditionTimeout WorkspaceCondition = "Timeout"

	// FirstUserActivity is the time when MarkActive was first called on the workspace
	WorkspaceConditionFirstUserActivity WorkspaceCondition = "FirstUserActivity"

	// Closed indicates that a workspace is marked as closed. This will shorten its timeout.
	WorkspaceConditionClosed WorkspaceCondition = "Closed"

	// HeadlessTaskFailed indicates that a headless workspace task failed
	WorkspaceConditionsHeadlessTaskFailed WorkspaceCondition = "HeadlessTaskFailed"

	// StoppedByRequest is true if the workspace was stopped using a StopWorkspace call.
	// The condition message will contain the requested grace period.
	WorkspaceConditionStoppedByRequest WorkspaceCondition = "StoppedByRequest"

	// Aborted is true if StopWorkspace was called with StopWorkspacePolicy set to ABORT
	WorkspaceConditionAborted WorkspaceCondition = "Aborted"

	// ContentReady is true once the content initialisation is complete
	WorkspaceConditionContentReady WorkspaceCondition = "ContentReady"

	// EverReady is true if the workspace has ever been ready (content init
	// succeeded and container is ready)
	WorkspaceConditionEverReady WorkspaceCondition = "EverReady"

	// BackupComplete is true once the backup has happened
	WorkspaceConditionBackupComplete WorkspaceCondition = "BackupComplete"

	// BackupFailure contains information about the backup failure
	WorkspaceConditionBackupFailure WorkspaceCondition = "BackupFailure"

	// Refresh is used to ensure that we operate on the latest version of the workspace
	WorkspaceConditionRefresh WorkspaceCondition = "Refresh"

	// NodeDisappeared is true if the workspace's node disappeared before the workspace was stopped
	WorkspaceConditionNodeDisappeared WorkspaceCondition = "NodeDisappeared"

	VolumeAttachRequest WorkspaceCondition = "VolumeAttachRequest"
	// VolumeAttached is true if the workspace's volume has been attached to the node
	VolumeAttached WorkspaceCondition = "VolumeAttached"
	// VolumeMounted is true if the workspace's volume has been mounted on the node
	VolumeMounted WorkspaceCondition = "VolumeMounted"

	// WorkspaceContainerRunning is true if the workspace container is running.
	// Used to determine if a backup can be taken, only once the container is stopped.
	WorkspaceConditionContainerRunning WorkspaceCondition = "WorkspaceContainerRunning"

	// WorkspaceConditionPodRejected is true if we detected that the pod was rejected by the node
	WorkspaceConditionPodRejected WorkspaceCondition = "PodRejected"

	// WorkspaceConditionStateWiped is true once all state has successfully been wiped by ws-daemon. This is only set if PodRejected=true, and the rejected workspace has been deleted.
	WorkspaceConditionStateWiped WorkspaceCondition = "StateWiped"

	// WorkspaceConditionForceKilledTask is true if we send a SIGKILL to the task
	WorkspaceConditionForceKilledTask WorkspaceCondition = "ForceKilledTask"
)

func NewWorkspaceConditionDeployed() metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionDeployed),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
	}
}

func NewWorkspaceConditionHeadlessTaskFailed(message string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionsHeadlessTaskFailed),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Message:            message,
	}
}

func NewWorkspaceConditionFailed(message string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionFailed),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Message:            message,
	}
}

func NewWorkspaceConditionPodRejected(message string, status metav1.ConditionStatus) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionPodRejected),
		LastTransitionTime: metav1.Now(),
		Status:             status,
		Message:            message,
	}
}

func NewWorkspaceConditionStateWiped(message string, status metav1.ConditionStatus) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionStateWiped),
		LastTransitionTime: metav1.Now(),
		Status:             status,
		Message:            message,
	}
}

func NewWorkspaceConditionTimeout(message string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionTimeout),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Reason:             "TimedOut",
		Message:            message,
	}
}

func NewWorkspaceConditionFirstUserActivity(reason string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionFirstUserActivity),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Reason:             reason,
	}
}

func NewWorkspaceConditionClosed(status metav1.ConditionStatus, reason string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionClosed),
		LastTransitionTime: metav1.Now(),
		Status:             status,
		Reason:             reason,
	}
}

func NewWorkspaceConditionStoppedByRequest(message string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionStoppedByRequest),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Reason:             "StopWorkspaceRequest",
		Message:            message,
	}
}

func NewWorkspaceConditionAborted(reason string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionAborted),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Reason:             reason,
	}
}

func NewWorkspaceConditionContentReady(status metav1.ConditionStatus, reason, message string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionContentReady),
		LastTransitionTime: metav1.Now(),
		Status:             status,
		Reason:             reason,
		Message:            message,
	}
}

func NewWorkspaceConditionEverReady() metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionEverReady),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
	}
}

func NewWorkspaceConditionBackupComplete() metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionBackupComplete),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Reason:             "BackupComplete",
	}
}

func NewWorkspaceConditionBackupFailure(message string) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionBackupFailure),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
		Reason:             "BackupFailed",
		Message:            message,
	}
}

func NewWorkspaceConditionRefresh() metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionRefresh),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
	}
}

func NewWorkspaceConditionNodeDisappeared() metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionNodeDisappeared),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
	}
}

func NewWorkspaceConditionContainerRunning(status metav1.ConditionStatus) metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionContainerRunning),
		LastTransitionTime: metav1.Now(),
		Status:             status,
	}
}

func NewWorkspaceConditionForceKilledTask() metav1.Condition {
	return metav1.Condition{
		Type:               string(WorkspaceConditionForceKilledTask),
		LastTransitionTime: metav1.Now(),
		Status:             metav1.ConditionTrue,
	}
}

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
//+kubebuilder:printcolumn:name="Type",type="string",JSONPath=".spec.type"
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

// IsHeadless returns whether the workspace is a headless type.
// This is added as a function on the workspace, instead of a field
// in the status, to make it easier to consume and not e.g. have to
// wait for the first reconcile of a workspace to set the status
// resource.
func (w *Workspace) IsHeadless() bool {
	return w.Spec.Type != WorkspaceTypeRegular
}

func (w *Workspace) IsConditionTrue(condition WorkspaceCondition) bool {
	return wsk8s.ConditionPresentAndTrue(w.Status.Conditions, string(condition))
}

func (w *Workspace) IsConditionPresent(condition WorkspaceCondition) bool {
	c := wsk8s.GetCondition(w.Status.Conditions, string(condition))
	return c != nil
}

func (w *Workspace) GetConditionState(condition WorkspaceCondition) (state metav1.ConditionStatus, ok bool) {
	cond := wsk8s.GetCondition(w.Status.Conditions, string(condition))
	if cond == nil {
		return "", false
	}
	return cond.Status, true
}

// UpsertConditionOnStatusChange calls SetCondition if the condition does not exist or it's status or message has changed.
func (w *Workspace) UpsertConditionOnStatusChange(newCondition metav1.Condition) {
	oldCondition := wsk8s.GetCondition(w.Status.Conditions, newCondition.Type)
	if oldCondition != nil && oldCondition.Status == newCondition.Status && oldCondition.Message == newCondition.Message {
		return
	}
	w.Status.SetCondition(newCondition)
}

// OWI produces the owner, workspace, instance log metadata from the information
// of this workspace.
func (w *Workspace) OWI() logrus.Fields {
	return log.OWI(w.Spec.Ownership.Owner, w.Spec.Ownership.WorkspaceID, w.Name)
}

func init() {
	SchemeBuilder.Register(&Workspace{}, &WorkspaceList{})
}
