// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// SnapshotSpec defines the desired state of the snapshot
type SnapshotSpec struct {
	// +kubebuilder:validation:Required
	NodeName string `json:"nodeName"`

	// +kubebuilder:validation:Required
	WorkspaceID string `json:"workspaceID"`
}

// SnapshotStatus defines the observed state of the snapshot
type SnapshotStatus struct {
	// // +kubebuilder:validation:Optional
	// Conditions []metav1.Condition `json:"conditions"`

	// Erorr is the error observed during snapshot creation if any
	// +kubebuilder:validation:Optional
	Error string `json:"error,omitempty"`

	// URL contains the url of the snapshot
	// +kubebuilder:validation:Optional
	URL string `json:"url,omitempty"`

	// Completed indicates if the snapshot operation has completed either by taking the snapshot or due to failure
	// +kubebuilder:validation:Required
	Completed bool `json:"completed"`
}

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:resource:shortName=snapshot
// Custom print columns on the Custom Resource Definition. These are the columns
// showing up when doing e.g. `kubectl get snapshots`.
// Columns with priority > 0 will only show up with `-o wide`.
//+kubebuilder:printcolumn:name="Workspace",type="string",JSONPath=".spec.workspaceID"
//+kubebuilder:printcolumn:name="URL",type="string",JSONPath=".status.url",priority=10
//+kubebuilder:printcolumn:name="Completed",type="boolean",JSONPath=".status.completed"

// Snapshot is the Schema for the snapshot API
type Snapshot struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   SnapshotSpec   `json:"spec,omitempty"`
	Status SnapshotStatus `json:"status,omitempty"`
}

//+kubebuilder:object:root=true

// SnapshotList contains a list of Snapshots
type SnapshotList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Snapshot `json:"items"`
}

func init() {
	SchemeBuilder.Register(&Snapshot{}, &SnapshotList{})
}
