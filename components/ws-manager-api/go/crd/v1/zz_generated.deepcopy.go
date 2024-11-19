//go:build !ignore_autogenerated

// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by controller-gen. DO NOT EDIT.

package v1

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *AdmissionSpec) DeepCopyInto(out *AdmissionSpec) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new AdmissionSpec.
func (in *AdmissionSpec) DeepCopy() *AdmissionSpec {
	if in == nil {
		return nil
	}
	out := new(AdmissionSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *GitSpec) DeepCopyInto(out *GitSpec) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GitSpec.
func (in *GitSpec) DeepCopy() *GitSpec {
	if in == nil {
		return nil
	}
	out := new(GitSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *GitStatus) DeepCopyInto(out *GitStatus) {
	*out = *in
	if in.UncommitedFiles != nil {
		in, out := &in.UncommitedFiles, &out.UncommitedFiles
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
	if in.UntrackedFiles != nil {
		in, out := &in.UntrackedFiles, &out.UntrackedFiles
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
	if in.UnpushedCommits != nil {
		in, out := &in.UnpushedCommits, &out.UnpushedCommits
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new GitStatus.
func (in *GitStatus) DeepCopy() *GitStatus {
	if in == nil {
		return nil
	}
	out := new(GitStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *IDEImages) DeepCopyInto(out *IDEImages) {
	*out = *in
	if in.Refs != nil {
		in, out := &in.Refs, &out.Refs
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new IDEImages.
func (in *IDEImages) DeepCopy() *IDEImages {
	if in == nil {
		return nil
	}
	out := new(IDEImages)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Ownership) DeepCopyInto(out *Ownership) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new Ownership.
func (in *Ownership) DeepCopy() *Ownership {
	if in == nil {
		return nil
	}
	out := new(Ownership)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *PortSpec) DeepCopyInto(out *PortSpec) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new PortSpec.
func (in *PortSpec) DeepCopy() *PortSpec {
	if in == nil {
		return nil
	}
	out := new(PortSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Snapshot) DeepCopyInto(out *Snapshot) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.Spec = in.Spec
	out.Status = in.Status
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new Snapshot.
func (in *Snapshot) DeepCopy() *Snapshot {
	if in == nil {
		return nil
	}
	out := new(Snapshot)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *Snapshot) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SnapshotList) DeepCopyInto(out *SnapshotList) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	if in.Items != nil {
		in, out := &in.Items, &out.Items
		*out = make([]Snapshot, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SnapshotList.
func (in *SnapshotList) DeepCopy() *SnapshotList {
	if in == nil {
		return nil
	}
	out := new(SnapshotList)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *SnapshotList) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SnapshotSpec) DeepCopyInto(out *SnapshotSpec) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SnapshotSpec.
func (in *SnapshotSpec) DeepCopy() *SnapshotSpec {
	if in == nil {
		return nil
	}
	out := new(SnapshotSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SnapshotStatus) DeepCopyInto(out *SnapshotStatus) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SnapshotStatus.
func (in *SnapshotStatus) DeepCopy() *SnapshotStatus {
	if in == nil {
		return nil
	}
	out := new(SnapshotStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *StorageStatus) DeepCopyInto(out *StorageStatus) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new StorageStatus.
func (in *StorageStatus) DeepCopy() *StorageStatus {
	if in == nil {
		return nil
	}
	out := new(StorageStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *TimeoutSpec) DeepCopyInto(out *TimeoutSpec) {
	*out = *in
	if in.Time != nil {
		in, out := &in.Time, &out.Time
		*out = new(metav1.Duration)
		**out = **in
	}
	if in.ClosedTimeout != nil {
		in, out := &in.ClosedTimeout, &out.ClosedTimeout
		*out = new(metav1.Duration)
		**out = **in
	}
	if in.MaximumLifetime != nil {
		in, out := &in.MaximumLifetime, &out.MaximumLifetime
		*out = new(metav1.Duration)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new TimeoutSpec.
func (in *TimeoutSpec) DeepCopy() *TimeoutSpec {
	if in == nil {
		return nil
	}
	out := new(TimeoutSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *Workspace) DeepCopyInto(out *Workspace) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	in.Spec.DeepCopyInto(&out.Spec)
	in.Status.DeepCopyInto(&out.Status)
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new Workspace.
func (in *Workspace) DeepCopy() *Workspace {
	if in == nil {
		return nil
	}
	out := new(Workspace)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *Workspace) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceImage) DeepCopyInto(out *WorkspaceImage) {
	*out = *in
	if in.Ref != nil {
		in, out := &in.Ref, &out.Ref
		*out = new(string)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceImage.
func (in *WorkspaceImage) DeepCopy() *WorkspaceImage {
	if in == nil {
		return nil
	}
	out := new(WorkspaceImage)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceImageInfo) DeepCopyInto(out *WorkspaceImageInfo) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceImageInfo.
func (in *WorkspaceImageInfo) DeepCopy() *WorkspaceImageInfo {
	if in == nil {
		return nil
	}
	out := new(WorkspaceImageInfo)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceImages) DeepCopyInto(out *WorkspaceImages) {
	*out = *in
	in.Workspace.DeepCopyInto(&out.Workspace)
	in.IDE.DeepCopyInto(&out.IDE)
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceImages.
func (in *WorkspaceImages) DeepCopy() *WorkspaceImages {
	if in == nil {
		return nil
	}
	out := new(WorkspaceImages)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceList) DeepCopyInto(out *WorkspaceList) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	if in.Items != nil {
		in, out := &in.Items, &out.Items
		*out = make([]Workspace, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceList.
func (in *WorkspaceList) DeepCopy() *WorkspaceList {
	if in == nil {
		return nil
	}
	out := new(WorkspaceList)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *WorkspaceList) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceRuntimeStatus) DeepCopyInto(out *WorkspaceRuntimeStatus) {
	*out = *in
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceRuntimeStatus.
func (in *WorkspaceRuntimeStatus) DeepCopy() *WorkspaceRuntimeStatus {
	if in == nil {
		return nil
	}
	out := new(WorkspaceRuntimeStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceSpec) DeepCopyInto(out *WorkspaceSpec) {
	*out = *in
	out.Ownership = in.Ownership
	in.Image.DeepCopyInto(&out.Image)
	if in.Initializer != nil {
		in, out := &in.Initializer, &out.Initializer
		*out = make([]byte, len(*in))
		copy(*out, *in)
	}
	if in.UserEnvVars != nil {
		in, out := &in.UserEnvVars, &out.UserEnvVars
		*out = make([]corev1.EnvVar, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
	if in.SysEnvVars != nil {
		in, out := &in.SysEnvVars, &out.SysEnvVars
		*out = make([]corev1.EnvVar, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
	if in.Git != nil {
		in, out := &in.Git, &out.Git
		*out = new(GitSpec)
		**out = **in
	}
	in.Timeout.DeepCopyInto(&out.Timeout)
	out.Admission = in.Admission
	if in.Ports != nil {
		in, out := &in.Ports, &out.Ports
		*out = make([]PortSpec, len(*in))
		copy(*out, *in)
	}
	if in.SshPublicKeys != nil {
		in, out := &in.SshPublicKeys, &out.SshPublicKeys
		*out = make([]string, len(*in))
		copy(*out, *in)
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceSpec.
func (in *WorkspaceSpec) DeepCopy() *WorkspaceSpec {
	if in == nil {
		return nil
	}
	out := new(WorkspaceSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *WorkspaceStatus) DeepCopyInto(out *WorkspaceStatus) {
	*out = *in
	if in.Conditions != nil {
		in, out := &in.Conditions, &out.Conditions
		*out = make([]metav1.Condition, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
	if in.GitStatus != nil {
		in, out := &in.GitStatus, &out.GitStatus
		*out = new(GitStatus)
		(*in).DeepCopyInto(*out)
	}
	if in.Runtime != nil {
		in, out := &in.Runtime, &out.Runtime
		*out = new(WorkspaceRuntimeStatus)
		**out = **in
	}
	out.Storage = in.Storage
	if in.LastActivity != nil {
		in, out := &in.LastActivity, &out.LastActivity
		*out = (*in).DeepCopy()
	}
	if in.ImageInfo != nil {
		in, out := &in.ImageInfo, &out.ImageInfo
		*out = new(WorkspaceImageInfo)
		**out = **in
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WorkspaceStatus.
func (in *WorkspaceStatus) DeepCopy() *WorkspaceStatus {
	if in == nil {
		return nil
	}
	out := new(WorkspaceStatus)
	in.DeepCopyInto(out)
	return out
}
