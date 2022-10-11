// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.28.1
// 	protoc        v3.20.1
// source: idemetrics.proto

package api

import (
	_ "google.golang.org/genproto/googleapis/api/annotations"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type AddCounterRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Name   string            `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
	Labels map[string]string `protobuf:"bytes,2,rep,name=labels,proto3" json:"labels,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	Value  int32             `protobuf:"varint,3,opt,name=value,proto3" json:"value,omitempty"`
}

func (x *AddCounterRequest) Reset() {
	*x = AddCounterRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *AddCounterRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*AddCounterRequest) ProtoMessage() {}

func (x *AddCounterRequest) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use AddCounterRequest.ProtoReflect.Descriptor instead.
func (*AddCounterRequest) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{0}
}

func (x *AddCounterRequest) GetName() string {
	if x != nil {
		return x.Name
	}
	return ""
}

func (x *AddCounterRequest) GetLabels() map[string]string {
	if x != nil {
		return x.Labels
	}
	return nil
}

func (x *AddCounterRequest) GetValue() int32 {
	if x != nil {
		return x.Value
	}
	return 0
}

type AddCounterResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *AddCounterResponse) Reset() {
	*x = AddCounterResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *AddCounterResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*AddCounterResponse) ProtoMessage() {}

func (x *AddCounterResponse) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use AddCounterResponse.ProtoReflect.Descriptor instead.
func (*AddCounterResponse) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{1}
}

type ObserveHistogramRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Name   string            `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
	Labels map[string]string `protobuf:"bytes,2,rep,name=labels,proto3" json:"labels,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	Value  float64           `protobuf:"fixed64,3,opt,name=value,proto3" json:"value,omitempty"`
}

func (x *ObserveHistogramRequest) Reset() {
	*x = ObserveHistogramRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *ObserveHistogramRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ObserveHistogramRequest) ProtoMessage() {}

func (x *ObserveHistogramRequest) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ObserveHistogramRequest.ProtoReflect.Descriptor instead.
func (*ObserveHistogramRequest) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{2}
}

func (x *ObserveHistogramRequest) GetName() string {
	if x != nil {
		return x.Name
	}
	return ""
}

func (x *ObserveHistogramRequest) GetLabels() map[string]string {
	if x != nil {
		return x.Labels
	}
	return nil
}

func (x *ObserveHistogramRequest) GetValue() float64 {
	if x != nil {
		return x.Value
	}
	return 0
}

type ObserveHistogramResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *ObserveHistogramResponse) Reset() {
	*x = ObserveHistogramResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[3]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *ObserveHistogramResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ObserveHistogramResponse) ProtoMessage() {}

func (x *ObserveHistogramResponse) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[3]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ObserveHistogramResponse.ProtoReflect.Descriptor instead.
func (*ObserveHistogramResponse) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{3}
}

type AddHistogramRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Name    string            `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
	Labels  map[string]string `protobuf:"bytes,2,rep,name=labels,proto3" json:"labels,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	Count   uint64            `protobuf:"varint,3,opt,name=count,proto3" json:"count,omitempty"`
	Sum     float64           `protobuf:"fixed64,4,opt,name=sum,proto3" json:"sum,omitempty"`
	Buckets []uint64          `protobuf:"varint,5,rep,packed,name=buckets,proto3" json:"buckets,omitempty"`
}

func (x *AddHistogramRequest) Reset() {
	*x = AddHistogramRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[4]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *AddHistogramRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*AddHistogramRequest) ProtoMessage() {}

func (x *AddHistogramRequest) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[4]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use AddHistogramRequest.ProtoReflect.Descriptor instead.
func (*AddHistogramRequest) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{4}
}

func (x *AddHistogramRequest) GetName() string {
	if x != nil {
		return x.Name
	}
	return ""
}

func (x *AddHistogramRequest) GetLabels() map[string]string {
	if x != nil {
		return x.Labels
	}
	return nil
}

func (x *AddHistogramRequest) GetCount() uint64 {
	if x != nil {
		return x.Count
	}
	return 0
}

func (x *AddHistogramRequest) GetSum() float64 {
	if x != nil {
		return x.Sum
	}
	return 0
}

func (x *AddHistogramRequest) GetBuckets() []uint64 {
	if x != nil {
		return x.Buckets
	}
	return nil
}

type AddHistogramResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *AddHistogramResponse) Reset() {
	*x = AddHistogramResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[5]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *AddHistogramResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*AddHistogramResponse) ProtoMessage() {}

func (x *AddHistogramResponse) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[5]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use AddHistogramResponse.ProtoReflect.Descriptor instead.
func (*AddHistogramResponse) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{5}
}

type ReportErrorRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	ErrorStack  string            `protobuf:"bytes,1,opt,name=error_stack,json=errorStack,proto3" json:"error_stack,omitempty"`
	Component   string            `protobuf:"bytes,2,opt,name=component,proto3" json:"component,omitempty"`
	Version     string            `protobuf:"bytes,3,opt,name=version,proto3" json:"version,omitempty"`
	UserId      string            `protobuf:"bytes,4,opt,name=user_id,json=userId,proto3" json:"user_id,omitempty"`
	WorkspaceId string            `protobuf:"bytes,5,opt,name=workspace_id,json=workspaceId,proto3" json:"workspace_id,omitempty"`
	InstanceId  string            `protobuf:"bytes,6,opt,name=instance_id,json=instanceId,proto3" json:"instance_id,omitempty"`
	Properties  map[string]string `protobuf:"bytes,7,rep,name=properties,proto3" json:"properties,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
}

func (x *ReportErrorRequest) Reset() {
	*x = ReportErrorRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[6]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *ReportErrorRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ReportErrorRequest) ProtoMessage() {}

func (x *ReportErrorRequest) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[6]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ReportErrorRequest.ProtoReflect.Descriptor instead.
func (*ReportErrorRequest) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{6}
}

func (x *ReportErrorRequest) GetErrorStack() string {
	if x != nil {
		return x.ErrorStack
	}
	return ""
}

func (x *ReportErrorRequest) GetComponent() string {
	if x != nil {
		return x.Component
	}
	return ""
}

func (x *ReportErrorRequest) GetVersion() string {
	if x != nil {
		return x.Version
	}
	return ""
}

func (x *ReportErrorRequest) GetUserId() string {
	if x != nil {
		return x.UserId
	}
	return ""
}

func (x *ReportErrorRequest) GetWorkspaceId() string {
	if x != nil {
		return x.WorkspaceId
	}
	return ""
}

func (x *ReportErrorRequest) GetInstanceId() string {
	if x != nil {
		return x.InstanceId
	}
	return ""
}

func (x *ReportErrorRequest) GetProperties() map[string]string {
	if x != nil {
		return x.Properties
	}
	return nil
}

type ReportErrorResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *ReportErrorResponse) Reset() {
	*x = ReportErrorResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_idemetrics_proto_msgTypes[7]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *ReportErrorResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ReportErrorResponse) ProtoMessage() {}

func (x *ReportErrorResponse) ProtoReflect() protoreflect.Message {
	mi := &file_idemetrics_proto_msgTypes[7]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ReportErrorResponse.ProtoReflect.Descriptor instead.
func (*ReportErrorResponse) Descriptor() ([]byte, []int) {
	return file_idemetrics_proto_rawDescGZIP(), []int{7}
}

var File_idemetrics_proto protoreflect.FileDescriptor

var file_idemetrics_proto_rawDesc = []byte{
	0x0a, 0x10, 0x69, 0x64, 0x65, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x2e, 0x70, 0x72, 0x6f,
	0x74, 0x6f, 0x12, 0x0f, 0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f,
	0x61, 0x70, 0x69, 0x1a, 0x1c, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2f, 0x61, 0x70, 0x69, 0x2f,
	0x61, 0x6e, 0x6e, 0x6f, 0x74, 0x61, 0x74, 0x69, 0x6f, 0x6e, 0x73, 0x2e, 0x70, 0x72, 0x6f, 0x74,
	0x6f, 0x22, 0xc0, 0x01, 0x0a, 0x11, 0x41, 0x64, 0x64, 0x43, 0x6f, 0x75, 0x6e, 0x74, 0x65, 0x72,
	0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x12, 0x0a, 0x04, 0x6e, 0x61, 0x6d, 0x65, 0x18,
	0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x04, 0x6e, 0x61, 0x6d, 0x65, 0x12, 0x46, 0x0a, 0x06, 0x6c,
	0x61, 0x62, 0x65, 0x6c, 0x73, 0x18, 0x02, 0x20, 0x03, 0x28, 0x0b, 0x32, 0x2e, 0x2e, 0x69, 0x64,
	0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x41, 0x64,
	0x64, 0x43, 0x6f, 0x75, 0x6e, 0x74, 0x65, 0x72, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x2e,
	0x4c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x45, 0x6e, 0x74, 0x72, 0x79, 0x52, 0x06, 0x6c, 0x61, 0x62,
	0x65, 0x6c, 0x73, 0x12, 0x14, 0x0a, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x18, 0x03, 0x20, 0x01,
	0x28, 0x05, 0x52, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x1a, 0x39, 0x0a, 0x0b, 0x4c, 0x61, 0x62,
	0x65, 0x6c, 0x73, 0x45, 0x6e, 0x74, 0x72, 0x79, 0x12, 0x10, 0x0a, 0x03, 0x6b, 0x65, 0x79, 0x18,
	0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x03, 0x6b, 0x65, 0x79, 0x12, 0x14, 0x0a, 0x05, 0x76, 0x61,
	0x6c, 0x75, 0x65, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65,
	0x3a, 0x02, 0x38, 0x01, 0x22, 0x14, 0x0a, 0x12, 0x41, 0x64, 0x64, 0x43, 0x6f, 0x75, 0x6e, 0x74,
	0x65, 0x72, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x22, 0xcc, 0x01, 0x0a, 0x17, 0x4f,
	0x62, 0x73, 0x65, 0x72, 0x76, 0x65, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52,
	0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x12, 0x0a, 0x04, 0x6e, 0x61, 0x6d, 0x65, 0x18, 0x01,
	0x20, 0x01, 0x28, 0x09, 0x52, 0x04, 0x6e, 0x61, 0x6d, 0x65, 0x12, 0x4c, 0x0a, 0x06, 0x6c, 0x61,
	0x62, 0x65, 0x6c, 0x73, 0x18, 0x02, 0x20, 0x03, 0x28, 0x0b, 0x32, 0x34, 0x2e, 0x69, 0x64, 0x65,
	0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x4f, 0x62, 0x73,
	0x65, 0x72, 0x76, 0x65, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52, 0x65, 0x71,
	0x75, 0x65, 0x73, 0x74, 0x2e, 0x4c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x45, 0x6e, 0x74, 0x72, 0x79,
	0x52, 0x06, 0x6c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x12, 0x14, 0x0a, 0x05, 0x76, 0x61, 0x6c, 0x75,
	0x65, 0x18, 0x03, 0x20, 0x01, 0x28, 0x01, 0x52, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x1a, 0x39,
	0x0a, 0x0b, 0x4c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x45, 0x6e, 0x74, 0x72, 0x79, 0x12, 0x10, 0x0a,
	0x03, 0x6b, 0x65, 0x79, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x03, 0x6b, 0x65, 0x79, 0x12,
	0x14, 0x0a, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05,
	0x76, 0x61, 0x6c, 0x75, 0x65, 0x3a, 0x02, 0x38, 0x01, 0x22, 0x1a, 0x0a, 0x18, 0x4f, 0x62, 0x73,
	0x65, 0x72, 0x76, 0x65, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52, 0x65, 0x73,
	0x70, 0x6f, 0x6e, 0x73, 0x65, 0x22, 0xf0, 0x01, 0x0a, 0x13, 0x41, 0x64, 0x64, 0x48, 0x69, 0x73,
	0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x12, 0x0a,
	0x04, 0x6e, 0x61, 0x6d, 0x65, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x04, 0x6e, 0x61, 0x6d,
	0x65, 0x12, 0x48, 0x0a, 0x06, 0x6c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x18, 0x02, 0x20, 0x03, 0x28,
	0x0b, 0x32, 0x30, 0x2e, 0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f,
	0x61, 0x70, 0x69, 0x2e, 0x41, 0x64, 0x64, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d,
	0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x2e, 0x4c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x45, 0x6e,
	0x74, 0x72, 0x79, 0x52, 0x06, 0x6c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x12, 0x14, 0x0a, 0x05, 0x63,
	0x6f, 0x75, 0x6e, 0x74, 0x18, 0x03, 0x20, 0x01, 0x28, 0x04, 0x52, 0x05, 0x63, 0x6f, 0x75, 0x6e,
	0x74, 0x12, 0x10, 0x0a, 0x03, 0x73, 0x75, 0x6d, 0x18, 0x04, 0x20, 0x01, 0x28, 0x01, 0x52, 0x03,
	0x73, 0x75, 0x6d, 0x12, 0x18, 0x0a, 0x07, 0x62, 0x75, 0x63, 0x6b, 0x65, 0x74, 0x73, 0x18, 0x05,
	0x20, 0x03, 0x28, 0x04, 0x52, 0x07, 0x62, 0x75, 0x63, 0x6b, 0x65, 0x74, 0x73, 0x1a, 0x39, 0x0a,
	0x0b, 0x4c, 0x61, 0x62, 0x65, 0x6c, 0x73, 0x45, 0x6e, 0x74, 0x72, 0x79, 0x12, 0x10, 0x0a, 0x03,
	0x6b, 0x65, 0x79, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x03, 0x6b, 0x65, 0x79, 0x12, 0x14,
	0x0a, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05, 0x76,
	0x61, 0x6c, 0x75, 0x65, 0x3a, 0x02, 0x38, 0x01, 0x22, 0x16, 0x0a, 0x14, 0x41, 0x64, 0x64, 0x48,
	0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65,
	0x22, 0xde, 0x02, 0x0a, 0x12, 0x52, 0x65, 0x70, 0x6f, 0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72,
	0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x1f, 0x0a, 0x0b, 0x65, 0x72, 0x72, 0x6f, 0x72,
	0x5f, 0x73, 0x74, 0x61, 0x63, 0x6b, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x0a, 0x65, 0x72,
	0x72, 0x6f, 0x72, 0x53, 0x74, 0x61, 0x63, 0x6b, 0x12, 0x1c, 0x0a, 0x09, 0x63, 0x6f, 0x6d, 0x70,
	0x6f, 0x6e, 0x65, 0x6e, 0x74, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x09, 0x63, 0x6f, 0x6d,
	0x70, 0x6f, 0x6e, 0x65, 0x6e, 0x74, 0x12, 0x18, 0x0a, 0x07, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f,
	0x6e, 0x18, 0x03, 0x20, 0x01, 0x28, 0x09, 0x52, 0x07, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e,
	0x12, 0x17, 0x0a, 0x07, 0x75, 0x73, 0x65, 0x72, 0x5f, 0x69, 0x64, 0x18, 0x04, 0x20, 0x01, 0x28,
	0x09, 0x52, 0x06, 0x75, 0x73, 0x65, 0x72, 0x49, 0x64, 0x12, 0x21, 0x0a, 0x0c, 0x77, 0x6f, 0x72,
	0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x5f, 0x69, 0x64, 0x18, 0x05, 0x20, 0x01, 0x28, 0x09, 0x52,
	0x0b, 0x77, 0x6f, 0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x49, 0x64, 0x12, 0x1f, 0x0a, 0x0b,
	0x69, 0x6e, 0x73, 0x74, 0x61, 0x6e, 0x63, 0x65, 0x5f, 0x69, 0x64, 0x18, 0x06, 0x20, 0x01, 0x28,
	0x09, 0x52, 0x0a, 0x69, 0x6e, 0x73, 0x74, 0x61, 0x6e, 0x63, 0x65, 0x49, 0x64, 0x12, 0x53, 0x0a,
	0x0a, 0x70, 0x72, 0x6f, 0x70, 0x65, 0x72, 0x74, 0x69, 0x65, 0x73, 0x18, 0x07, 0x20, 0x03, 0x28,
	0x0b, 0x32, 0x33, 0x2e, 0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f,
	0x61, 0x70, 0x69, 0x2e, 0x52, 0x65, 0x70, 0x6f, 0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x52,
	0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x2e, 0x50, 0x72, 0x6f, 0x70, 0x65, 0x72, 0x74, 0x69, 0x65,
	0x73, 0x45, 0x6e, 0x74, 0x72, 0x79, 0x52, 0x0a, 0x70, 0x72, 0x6f, 0x70, 0x65, 0x72, 0x74, 0x69,
	0x65, 0x73, 0x1a, 0x3d, 0x0a, 0x0f, 0x50, 0x72, 0x6f, 0x70, 0x65, 0x72, 0x74, 0x69, 0x65, 0x73,
	0x45, 0x6e, 0x74, 0x72, 0x79, 0x12, 0x10, 0x0a, 0x03, 0x6b, 0x65, 0x79, 0x18, 0x01, 0x20, 0x01,
	0x28, 0x09, 0x52, 0x03, 0x6b, 0x65, 0x79, 0x12, 0x14, 0x0a, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65,
	0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05, 0x76, 0x61, 0x6c, 0x75, 0x65, 0x3a, 0x02, 0x38,
	0x01, 0x22, 0x15, 0x0a, 0x13, 0x52, 0x65, 0x70, 0x6f, 0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72,
	0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x32, 0xa2, 0x04, 0x0a, 0x0e, 0x4d, 0x65, 0x74,
	0x72, 0x69, 0x63, 0x73, 0x53, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x12, 0x7d, 0x0a, 0x0a, 0x41,
	0x64, 0x64, 0x43, 0x6f, 0x75, 0x6e, 0x74, 0x65, 0x72, 0x12, 0x22, 0x2e, 0x69, 0x64, 0x65, 0x5f,
	0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x41, 0x64, 0x64, 0x43,
	0x6f, 0x75, 0x6e, 0x74, 0x65, 0x72, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x23, 0x2e,
	0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e,
	0x41, 0x64, 0x64, 0x43, 0x6f, 0x75, 0x6e, 0x74, 0x65, 0x72, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e,
	0x73, 0x65, 0x22, 0x26, 0x82, 0xd3, 0xe4, 0x93, 0x02, 0x20, 0x22, 0x1b, 0x2f, 0x6d, 0x65, 0x74,
	0x72, 0x69, 0x63, 0x73, 0x2f, 0x63, 0x6f, 0x75, 0x6e, 0x74, 0x65, 0x72, 0x2f, 0x61, 0x64, 0x64,
	0x2f, 0x7b, 0x6e, 0x61, 0x6d, 0x65, 0x7d, 0x3a, 0x01, 0x2a, 0x12, 0x95, 0x01, 0x0a, 0x10, 0x4f,
	0x62, 0x73, 0x65, 0x72, 0x76, 0x65, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x12,
	0x28, 0x2e, 0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70,
	0x69, 0x2e, 0x4f, 0x62, 0x73, 0x65, 0x72, 0x76, 0x65, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72,
	0x61, 0x6d, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x29, 0x2e, 0x69, 0x64, 0x65, 0x5f,
	0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x4f, 0x62, 0x73, 0x65,
	0x72, 0x76, 0x65, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52, 0x65, 0x73, 0x70,
	0x6f, 0x6e, 0x73, 0x65, 0x22, 0x2c, 0x82, 0xd3, 0xe4, 0x93, 0x02, 0x26, 0x22, 0x21, 0x2f, 0x6d,
	0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x2f, 0x68, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d,
	0x2f, 0x6f, 0x62, 0x73, 0x65, 0x72, 0x76, 0x65, 0x2f, 0x7b, 0x6e, 0x61, 0x6d, 0x65, 0x7d, 0x3a,
	0x01, 0x2a, 0x12, 0x85, 0x01, 0x0a, 0x0c, 0x41, 0x64, 0x64, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67,
	0x72, 0x61, 0x6d, 0x12, 0x24, 0x2e, 0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63,
	0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x41, 0x64, 0x64, 0x48, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72,
	0x61, 0x6d, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x25, 0x2e, 0x69, 0x64, 0x65, 0x5f,
	0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x41, 0x64, 0x64, 0x48,
	0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65,
	0x22, 0x28, 0x82, 0xd3, 0xe4, 0x93, 0x02, 0x22, 0x22, 0x1d, 0x2f, 0x6d, 0x65, 0x74, 0x72, 0x69,
	0x63, 0x73, 0x2f, 0x68, 0x69, 0x73, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x6d, 0x2f, 0x61, 0x64, 0x64,
	0x2f, 0x7b, 0x6e, 0x61, 0x6d, 0x65, 0x7d, 0x3a, 0x01, 0x2a, 0x12, 0x71, 0x0a, 0x0b, 0x72, 0x65,
	0x70, 0x6f, 0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x12, 0x23, 0x2e, 0x69, 0x64, 0x65, 0x5f,
	0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69, 0x2e, 0x52, 0x65, 0x70, 0x6f,
	0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x24,
	0x2e, 0x69, 0x64, 0x65, 0x5f, 0x6d, 0x65, 0x74, 0x72, 0x69, 0x63, 0x73, 0x5f, 0x61, 0x70, 0x69,
	0x2e, 0x52, 0x65, 0x70, 0x6f, 0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x52, 0x65, 0x73, 0x70,
	0x6f, 0x6e, 0x73, 0x65, 0x22, 0x17, 0x82, 0xd3, 0xe4, 0x93, 0x02, 0x11, 0x22, 0x0c, 0x2f, 0x72,
	0x65, 0x70, 0x6f, 0x72, 0x74, 0x45, 0x72, 0x72, 0x6f, 0x72, 0x3a, 0x01, 0x2a, 0x42, 0x47, 0x0a,
	0x18, 0x69, 0x6f, 0x2e, 0x67, 0x69, 0x74, 0x70, 0x6f, 0x64, 0x2e, 0x69, 0x64, 0x65, 0x6d, 0x65,
	0x74, 0x72, 0x69, 0x63, 0x73, 0x2e, 0x61, 0x70, 0x69, 0x5a, 0x2b, 0x67, 0x69, 0x74, 0x68, 0x75,
	0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x67, 0x69, 0x74, 0x70, 0x6f, 0x64, 0x2d, 0x69, 0x6f, 0x2f,
	0x67, 0x69, 0x74, 0x70, 0x6f, 0x64, 0x2f, 0x69, 0x64, 0x65, 0x2d, 0x6d, 0x65, 0x74, 0x72, 0x69,
	0x63, 0x73, 0x2f, 0x61, 0x70, 0x69, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x33,
}

var (
	file_idemetrics_proto_rawDescOnce sync.Once
	file_idemetrics_proto_rawDescData = file_idemetrics_proto_rawDesc
)

func file_idemetrics_proto_rawDescGZIP() []byte {
	file_idemetrics_proto_rawDescOnce.Do(func() {
		file_idemetrics_proto_rawDescData = protoimpl.X.CompressGZIP(file_idemetrics_proto_rawDescData)
	})
	return file_idemetrics_proto_rawDescData
}

var file_idemetrics_proto_msgTypes = make([]protoimpl.MessageInfo, 12)
var file_idemetrics_proto_goTypes = []interface{}{
	(*AddCounterRequest)(nil),        // 0: ide_metrics_api.AddCounterRequest
	(*AddCounterResponse)(nil),       // 1: ide_metrics_api.AddCounterResponse
	(*ObserveHistogramRequest)(nil),  // 2: ide_metrics_api.ObserveHistogramRequest
	(*ObserveHistogramResponse)(nil), // 3: ide_metrics_api.ObserveHistogramResponse
	(*AddHistogramRequest)(nil),      // 4: ide_metrics_api.AddHistogramRequest
	(*AddHistogramResponse)(nil),     // 5: ide_metrics_api.AddHistogramResponse
	(*ReportErrorRequest)(nil),       // 6: ide_metrics_api.ReportErrorRequest
	(*ReportErrorResponse)(nil),      // 7: ide_metrics_api.ReportErrorResponse
	nil,                              // 8: ide_metrics_api.AddCounterRequest.LabelsEntry
	nil,                              // 9: ide_metrics_api.ObserveHistogramRequest.LabelsEntry
	nil,                              // 10: ide_metrics_api.AddHistogramRequest.LabelsEntry
	nil,                              // 11: ide_metrics_api.ReportErrorRequest.PropertiesEntry
}
var file_idemetrics_proto_depIdxs = []int32{
	8,  // 0: ide_metrics_api.AddCounterRequest.labels:type_name -> ide_metrics_api.AddCounterRequest.LabelsEntry
	9,  // 1: ide_metrics_api.ObserveHistogramRequest.labels:type_name -> ide_metrics_api.ObserveHistogramRequest.LabelsEntry
	10, // 2: ide_metrics_api.AddHistogramRequest.labels:type_name -> ide_metrics_api.AddHistogramRequest.LabelsEntry
	11, // 3: ide_metrics_api.ReportErrorRequest.properties:type_name -> ide_metrics_api.ReportErrorRequest.PropertiesEntry
	0,  // 4: ide_metrics_api.MetricsService.AddCounter:input_type -> ide_metrics_api.AddCounterRequest
	2,  // 5: ide_metrics_api.MetricsService.ObserveHistogram:input_type -> ide_metrics_api.ObserveHistogramRequest
	4,  // 6: ide_metrics_api.MetricsService.AddHistogram:input_type -> ide_metrics_api.AddHistogramRequest
	6,  // 7: ide_metrics_api.MetricsService.reportError:input_type -> ide_metrics_api.ReportErrorRequest
	1,  // 8: ide_metrics_api.MetricsService.AddCounter:output_type -> ide_metrics_api.AddCounterResponse
	3,  // 9: ide_metrics_api.MetricsService.ObserveHistogram:output_type -> ide_metrics_api.ObserveHistogramResponse
	5,  // 10: ide_metrics_api.MetricsService.AddHistogram:output_type -> ide_metrics_api.AddHistogramResponse
	7,  // 11: ide_metrics_api.MetricsService.reportError:output_type -> ide_metrics_api.ReportErrorResponse
	8,  // [8:12] is the sub-list for method output_type
	4,  // [4:8] is the sub-list for method input_type
	4,  // [4:4] is the sub-list for extension type_name
	4,  // [4:4] is the sub-list for extension extendee
	0,  // [0:4] is the sub-list for field type_name
}

func init() { file_idemetrics_proto_init() }
func file_idemetrics_proto_init() {
	if File_idemetrics_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_idemetrics_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*AddCounterRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*AddCounterResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[2].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*ObserveHistogramRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[3].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*ObserveHistogramResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[4].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*AddHistogramRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[5].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*AddHistogramResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[6].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*ReportErrorRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_idemetrics_proto_msgTypes[7].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*ReportErrorResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_idemetrics_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   12,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_idemetrics_proto_goTypes,
		DependencyIndexes: file_idemetrics_proto_depIdxs,
		MessageInfos:      file_idemetrics_proto_msgTypes,
	}.Build()
	File_idemetrics_proto = out.File
	file_idemetrics_proto_rawDesc = nil
	file_idemetrics_proto_goTypes = nil
	file_idemetrics_proto_depIdxs = nil
}
