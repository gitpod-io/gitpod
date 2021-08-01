// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.27.1
// 	protoc        v3.15.5
// source: localapp.proto

package api

import (
	api "github.com/gitpod-io/gitpod/supervisor/api"
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

type TunnelStatusRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	InstanceId string `protobuf:"bytes,1,opt,name=instance_id,json=instanceId,proto3" json:"instance_id,omitempty"`
	// if observe is true, we'll return a stream of changes rather than just the
	// current state of affairs.
	Observe bool `protobuf:"varint,2,opt,name=observe,proto3" json:"observe,omitempty"`
}

func (x *TunnelStatusRequest) Reset() {
	*x = TunnelStatusRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_localapp_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *TunnelStatusRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*TunnelStatusRequest) ProtoMessage() {}

func (x *TunnelStatusRequest) ProtoReflect() protoreflect.Message {
	mi := &file_localapp_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use TunnelStatusRequest.ProtoReflect.Descriptor instead.
func (*TunnelStatusRequest) Descriptor() ([]byte, []int) {
	return file_localapp_proto_rawDescGZIP(), []int{0}
}

func (x *TunnelStatusRequest) GetInstanceId() string {
	if x != nil {
		return x.InstanceId
	}
	return ""
}

func (x *TunnelStatusRequest) GetObserve() bool {
	if x != nil {
		return x.Observe
	}
	return false
}

type TunnelStatusResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Tunnels []*TunnelStatus `protobuf:"bytes,1,rep,name=tunnels,proto3" json:"tunnels,omitempty"`
}

func (x *TunnelStatusResponse) Reset() {
	*x = TunnelStatusResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_localapp_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *TunnelStatusResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*TunnelStatusResponse) ProtoMessage() {}

func (x *TunnelStatusResponse) ProtoReflect() protoreflect.Message {
	mi := &file_localapp_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use TunnelStatusResponse.ProtoReflect.Descriptor instead.
func (*TunnelStatusResponse) Descriptor() ([]byte, []int) {
	return file_localapp_proto_rawDescGZIP(), []int{1}
}

func (x *TunnelStatusResponse) GetTunnels() []*TunnelStatus {
	if x != nil {
		return x.Tunnels
	}
	return nil
}

type TunnelStatus struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	RemotePort uint32              `protobuf:"varint,1,opt,name=remote_port,json=remotePort,proto3" json:"remote_port,omitempty"`
	LocalPort  uint32              `protobuf:"varint,2,opt,name=local_port,json=localPort,proto3" json:"local_port,omitempty"`
	Visibility api.TunnelVisiblity `protobuf:"varint,3,opt,name=visibility,proto3,enum=supervisor.TunnelVisiblity" json:"visibility,omitempty"`
}

func (x *TunnelStatus) Reset() {
	*x = TunnelStatus{}
	if protoimpl.UnsafeEnabled {
		mi := &file_localapp_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *TunnelStatus) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*TunnelStatus) ProtoMessage() {}

func (x *TunnelStatus) ProtoReflect() protoreflect.Message {
	mi := &file_localapp_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use TunnelStatus.ProtoReflect.Descriptor instead.
func (*TunnelStatus) Descriptor() ([]byte, []int) {
	return file_localapp_proto_rawDescGZIP(), []int{2}
}

func (x *TunnelStatus) GetRemotePort() uint32 {
	if x != nil {
		return x.RemotePort
	}
	return 0
}

func (x *TunnelStatus) GetLocalPort() uint32 {
	if x != nil {
		return x.LocalPort
	}
	return 0
}

func (x *TunnelStatus) GetVisibility() api.TunnelVisiblity {
	if x != nil {
		return x.Visibility
	}
	return api.TunnelVisiblity(0)
}

var File_localapp_proto protoreflect.FileDescriptor

var file_localapp_proto_rawDesc = []byte{
	0x0a, 0x0e, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x61, 0x70, 0x70, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f,
	0x12, 0x08, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x61, 0x70, 0x70, 0x1a, 0x19, 0x73, 0x75, 0x70, 0x65,
	0x72, 0x76, 0x69, 0x73, 0x6f, 0x72, 0x2d, 0x61, 0x70, 0x69, 0x2f, 0x70, 0x6f, 0x72, 0x74, 0x2e,
	0x70, 0x72, 0x6f, 0x74, 0x6f, 0x22, 0x50, 0x0a, 0x13, 0x54, 0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x53,
	0x74, 0x61, 0x74, 0x75, 0x73, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x1f, 0x0a, 0x0b,
	0x69, 0x6e, 0x73, 0x74, 0x61, 0x6e, 0x63, 0x65, 0x5f, 0x69, 0x64, 0x18, 0x01, 0x20, 0x01, 0x28,
	0x09, 0x52, 0x0a, 0x69, 0x6e, 0x73, 0x74, 0x61, 0x6e, 0x63, 0x65, 0x49, 0x64, 0x12, 0x18, 0x0a,
	0x07, 0x6f, 0x62, 0x73, 0x65, 0x72, 0x76, 0x65, 0x18, 0x02, 0x20, 0x01, 0x28, 0x08, 0x52, 0x07,
	0x6f, 0x62, 0x73, 0x65, 0x72, 0x76, 0x65, 0x22, 0x48, 0x0a, 0x14, 0x54, 0x75, 0x6e, 0x6e, 0x65,
	0x6c, 0x53, 0x74, 0x61, 0x74, 0x75, 0x73, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12,
	0x30, 0x0a, 0x07, 0x74, 0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x73, 0x18, 0x01, 0x20, 0x03, 0x28, 0x0b,
	0x32, 0x16, 0x2e, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x61, 0x70, 0x70, 0x2e, 0x54, 0x75, 0x6e, 0x6e,
	0x65, 0x6c, 0x53, 0x74, 0x61, 0x74, 0x75, 0x73, 0x52, 0x07, 0x74, 0x75, 0x6e, 0x6e, 0x65, 0x6c,
	0x73, 0x22, 0x8b, 0x01, 0x0a, 0x0c, 0x54, 0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x53, 0x74, 0x61, 0x74,
	0x75, 0x73, 0x12, 0x1f, 0x0a, 0x0b, 0x72, 0x65, 0x6d, 0x6f, 0x74, 0x65, 0x5f, 0x70, 0x6f, 0x72,
	0x74, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0d, 0x52, 0x0a, 0x72, 0x65, 0x6d, 0x6f, 0x74, 0x65, 0x50,
	0x6f, 0x72, 0x74, 0x12, 0x1d, 0x0a, 0x0a, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x5f, 0x70, 0x6f, 0x72,
	0x74, 0x18, 0x02, 0x20, 0x01, 0x28, 0x0d, 0x52, 0x09, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x50, 0x6f,
	0x72, 0x74, 0x12, 0x3b, 0x0a, 0x0a, 0x76, 0x69, 0x73, 0x69, 0x62, 0x69, 0x6c, 0x69, 0x74, 0x79,
	0x18, 0x03, 0x20, 0x01, 0x28, 0x0e, 0x32, 0x1b, 0x2e, 0x73, 0x75, 0x70, 0x65, 0x72, 0x76, 0x69,
	0x73, 0x6f, 0x72, 0x2e, 0x54, 0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x56, 0x69, 0x73, 0x69, 0x62, 0x6c,
	0x69, 0x74, 0x79, 0x52, 0x0a, 0x76, 0x69, 0x73, 0x69, 0x62, 0x69, 0x6c, 0x69, 0x74, 0x79, 0x32,
	0x5d, 0x0a, 0x08, 0x4c, 0x6f, 0x63, 0x61, 0x6c, 0x41, 0x70, 0x70, 0x12, 0x51, 0x0a, 0x0c, 0x54,
	0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x53, 0x74, 0x61, 0x74, 0x75, 0x73, 0x12, 0x1d, 0x2e, 0x6c, 0x6f,
	0x63, 0x61, 0x6c, 0x61, 0x70, 0x70, 0x2e, 0x54, 0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x53, 0x74, 0x61,
	0x74, 0x75, 0x73, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x1e, 0x2e, 0x6c, 0x6f, 0x63,
	0x61, 0x6c, 0x61, 0x70, 0x70, 0x2e, 0x54, 0x75, 0x6e, 0x6e, 0x65, 0x6c, 0x53, 0x74, 0x61, 0x74,
	0x75, 0x73, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x22, 0x00, 0x30, 0x01, 0x42, 0x2b,
	0x5a, 0x29, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x67, 0x69, 0x74,
	0x70, 0x6f, 0x64, 0x2d, 0x69, 0x6f, 0x2f, 0x67, 0x69, 0x74, 0x70, 0x6f, 0x64, 0x2f, 0x6c, 0x6f,
	0x63, 0x61, 0x6c, 0x2d, 0x61, 0x70, 0x70, 0x2f, 0x61, 0x70, 0x69, 0x62, 0x06, 0x70, 0x72, 0x6f,
	0x74, 0x6f, 0x33,
}

var (
	file_localapp_proto_rawDescOnce sync.Once
	file_localapp_proto_rawDescData = file_localapp_proto_rawDesc
)

func file_localapp_proto_rawDescGZIP() []byte {
	file_localapp_proto_rawDescOnce.Do(func() {
		file_localapp_proto_rawDescData = protoimpl.X.CompressGZIP(file_localapp_proto_rawDescData)
	})
	return file_localapp_proto_rawDescData
}

var file_localapp_proto_msgTypes = make([]protoimpl.MessageInfo, 3)
var file_localapp_proto_goTypes = []interface{}{
	(*TunnelStatusRequest)(nil),  // 0: localapp.TunnelStatusRequest
	(*TunnelStatusResponse)(nil), // 1: localapp.TunnelStatusResponse
	(*TunnelStatus)(nil),         // 2: localapp.TunnelStatus
	(api.TunnelVisiblity)(0),     // 3: supervisor.TunnelVisiblity
}
var file_localapp_proto_depIdxs = []int32{
	2, // 0: localapp.TunnelStatusResponse.tunnels:type_name -> localapp.TunnelStatus
	3, // 1: localapp.TunnelStatus.visibility:type_name -> supervisor.TunnelVisiblity
	0, // 2: localapp.LocalApp.TunnelStatus:input_type -> localapp.TunnelStatusRequest
	1, // 3: localapp.LocalApp.TunnelStatus:output_type -> localapp.TunnelStatusResponse
	3, // [3:4] is the sub-list for method output_type
	2, // [2:3] is the sub-list for method input_type
	2, // [2:2] is the sub-list for extension type_name
	2, // [2:2] is the sub-list for extension extendee
	0, // [0:2] is the sub-list for field type_name
}

func init() { file_localapp_proto_init() }
func file_localapp_proto_init() {
	if File_localapp_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_localapp_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*TunnelStatusRequest); i {
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
		file_localapp_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*TunnelStatusResponse); i {
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
		file_localapp_proto_msgTypes[2].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*TunnelStatus); i {
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
			RawDescriptor: file_localapp_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   3,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_localapp_proto_goTypes,
		DependencyIndexes: file_localapp_proto_depIdxs,
		MessageInfos:      file_localapp_proto_msgTypes,
	}.Build()
	File_localapp_proto = out.File
	file_localapp_proto_rawDesc = nil
	file_localapp_proto_goTypes = nil
	file_localapp_proto_depIdxs = nil
}
