// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go. DO NOT EDIT.
// source: status.proto

package api

import (
	context "context"
	fmt "fmt"
	proto "github.com/golang/protobuf/proto"
	_ "google.golang.org/genproto/googleapis/api/annotations"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
	math "math"
)

// Reference imports to suppress errors if they are not otherwise used.
var _ = proto.Marshal
var _ = fmt.Errorf
var _ = math.Inf

// This is a compile-time assertion to ensure that this generated file
// is compatible with the proto package it is being compiled against.
// A compilation error at this line likely means your copy of the
// proto package needs to be updated.
const _ = proto.ProtoPackageIsVersion3 // please upgrade the proto package

type ContentSource int32

const (
	ContentSource_from_other    ContentSource = 0
	ContentSource_from_backup   ContentSource = 1
	ContentSource_from_prebuild ContentSource = 2
)

var ContentSource_name = map[int32]string{
	0: "from_other",
	1: "from_backup",
	2: "from_prebuild",
}

var ContentSource_value = map[string]int32{
	"from_other":    0,
	"from_backup":   1,
	"from_prebuild": 2,
}

func (x ContentSource) String() string {
	return proto.EnumName(ContentSource_name, int32(x))
}

func (ContentSource) EnumDescriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{0}
}

type SupervisorStatusRequest struct {
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *SupervisorStatusRequest) Reset()         { *m = SupervisorStatusRequest{} }
func (m *SupervisorStatusRequest) String() string { return proto.CompactTextString(m) }
func (*SupervisorStatusRequest) ProtoMessage()    {}
func (*SupervisorStatusRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{0}
}

func (m *SupervisorStatusRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_SupervisorStatusRequest.Unmarshal(m, b)
}
func (m *SupervisorStatusRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_SupervisorStatusRequest.Marshal(b, m, deterministic)
}
func (m *SupervisorStatusRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_SupervisorStatusRequest.Merge(m, src)
}
func (m *SupervisorStatusRequest) XXX_Size() int {
	return xxx_messageInfo_SupervisorStatusRequest.Size(m)
}
func (m *SupervisorStatusRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_SupervisorStatusRequest.DiscardUnknown(m)
}

var xxx_messageInfo_SupervisorStatusRequest proto.InternalMessageInfo

type SupervisorStatusResponse struct {
	Ok                   bool     `protobuf:"varint,1,opt,name=ok,proto3" json:"ok,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *SupervisorStatusResponse) Reset()         { *m = SupervisorStatusResponse{} }
func (m *SupervisorStatusResponse) String() string { return proto.CompactTextString(m) }
func (*SupervisorStatusResponse) ProtoMessage()    {}
func (*SupervisorStatusResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{1}
}

func (m *SupervisorStatusResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_SupervisorStatusResponse.Unmarshal(m, b)
}
func (m *SupervisorStatusResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_SupervisorStatusResponse.Marshal(b, m, deterministic)
}
func (m *SupervisorStatusResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_SupervisorStatusResponse.Merge(m, src)
}
func (m *SupervisorStatusResponse) XXX_Size() int {
	return xxx_messageInfo_SupervisorStatusResponse.Size(m)
}
func (m *SupervisorStatusResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_SupervisorStatusResponse.DiscardUnknown(m)
}

var xxx_messageInfo_SupervisorStatusResponse proto.InternalMessageInfo

func (m *SupervisorStatusResponse) GetOk() bool {
	if m != nil {
		return m.Ok
	}
	return false
}

type IDEStatusRequest struct {
	// if true this request will return either when it times out or when the workspace IDE
	// has become available.
	Wait                 bool     `protobuf:"varint,1,opt,name=wait,proto3" json:"wait,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *IDEStatusRequest) Reset()         { *m = IDEStatusRequest{} }
func (m *IDEStatusRequest) String() string { return proto.CompactTextString(m) }
func (*IDEStatusRequest) ProtoMessage()    {}
func (*IDEStatusRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{2}
}

func (m *IDEStatusRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_IDEStatusRequest.Unmarshal(m, b)
}
func (m *IDEStatusRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_IDEStatusRequest.Marshal(b, m, deterministic)
}
func (m *IDEStatusRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_IDEStatusRequest.Merge(m, src)
}
func (m *IDEStatusRequest) XXX_Size() int {
	return xxx_messageInfo_IDEStatusRequest.Size(m)
}
func (m *IDEStatusRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_IDEStatusRequest.DiscardUnknown(m)
}

var xxx_messageInfo_IDEStatusRequest proto.InternalMessageInfo

func (m *IDEStatusRequest) GetWait() bool {
	if m != nil {
		return m.Wait
	}
	return false
}

type IDEStatusResponse struct {
	Ok                   bool     `protobuf:"varint,1,opt,name=ok,proto3" json:"ok,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *IDEStatusResponse) Reset()         { *m = IDEStatusResponse{} }
func (m *IDEStatusResponse) String() string { return proto.CompactTextString(m) }
func (*IDEStatusResponse) ProtoMessage()    {}
func (*IDEStatusResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{3}
}

func (m *IDEStatusResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_IDEStatusResponse.Unmarshal(m, b)
}
func (m *IDEStatusResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_IDEStatusResponse.Marshal(b, m, deterministic)
}
func (m *IDEStatusResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_IDEStatusResponse.Merge(m, src)
}
func (m *IDEStatusResponse) XXX_Size() int {
	return xxx_messageInfo_IDEStatusResponse.Size(m)
}
func (m *IDEStatusResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_IDEStatusResponse.DiscardUnknown(m)
}

var xxx_messageInfo_IDEStatusResponse proto.InternalMessageInfo

func (m *IDEStatusResponse) GetOk() bool {
	if m != nil {
		return m.Ok
	}
	return false
}

type ContentStatusRequest struct {
	// if true this request will return either when it times out or when the workspace content
	// has become available.
	Wait                 bool     `protobuf:"varint,1,opt,name=wait,proto3" json:"wait,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *ContentStatusRequest) Reset()         { *m = ContentStatusRequest{} }
func (m *ContentStatusRequest) String() string { return proto.CompactTextString(m) }
func (*ContentStatusRequest) ProtoMessage()    {}
func (*ContentStatusRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{4}
}

func (m *ContentStatusRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_ContentStatusRequest.Unmarshal(m, b)
}
func (m *ContentStatusRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_ContentStatusRequest.Marshal(b, m, deterministic)
}
func (m *ContentStatusRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_ContentStatusRequest.Merge(m, src)
}
func (m *ContentStatusRequest) XXX_Size() int {
	return xxx_messageInfo_ContentStatusRequest.Size(m)
}
func (m *ContentStatusRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_ContentStatusRequest.DiscardUnknown(m)
}

var xxx_messageInfo_ContentStatusRequest proto.InternalMessageInfo

func (m *ContentStatusRequest) GetWait() bool {
	if m != nil {
		return m.Wait
	}
	return false
}

type ContentStatusResponse struct {
	// true if the workspace content is available
	Available bool `protobuf:"varint,1,opt,name=available,proto3" json:"available,omitempty"`
	// source indicates where the workspace content came from
	Source               ContentSource `protobuf:"varint,2,opt,name=source,proto3,enum=supervisor.ContentSource" json:"source,omitempty"`
	XXX_NoUnkeyedLiteral struct{}      `json:"-"`
	XXX_unrecognized     []byte        `json:"-"`
	XXX_sizecache        int32         `json:"-"`
}

func (m *ContentStatusResponse) Reset()         { *m = ContentStatusResponse{} }
func (m *ContentStatusResponse) String() string { return proto.CompactTextString(m) }
func (*ContentStatusResponse) ProtoMessage()    {}
func (*ContentStatusResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{5}
}

func (m *ContentStatusResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_ContentStatusResponse.Unmarshal(m, b)
}
func (m *ContentStatusResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_ContentStatusResponse.Marshal(b, m, deterministic)
}
func (m *ContentStatusResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_ContentStatusResponse.Merge(m, src)
}
func (m *ContentStatusResponse) XXX_Size() int {
	return xxx_messageInfo_ContentStatusResponse.Size(m)
}
func (m *ContentStatusResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_ContentStatusResponse.DiscardUnknown(m)
}

var xxx_messageInfo_ContentStatusResponse proto.InternalMessageInfo

func (m *ContentStatusResponse) GetAvailable() bool {
	if m != nil {
		return m.Available
	}
	return false
}

func (m *ContentStatusResponse) GetSource() ContentSource {
	if m != nil {
		return m.Source
	}
	return ContentSource_from_other
}

type BackupStatusRequest struct {
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *BackupStatusRequest) Reset()         { *m = BackupStatusRequest{} }
func (m *BackupStatusRequest) String() string { return proto.CompactTextString(m) }
func (*BackupStatusRequest) ProtoMessage()    {}
func (*BackupStatusRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{6}
}

func (m *BackupStatusRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_BackupStatusRequest.Unmarshal(m, b)
}
func (m *BackupStatusRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_BackupStatusRequest.Marshal(b, m, deterministic)
}
func (m *BackupStatusRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_BackupStatusRequest.Merge(m, src)
}
func (m *BackupStatusRequest) XXX_Size() int {
	return xxx_messageInfo_BackupStatusRequest.Size(m)
}
func (m *BackupStatusRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_BackupStatusRequest.DiscardUnknown(m)
}

var xxx_messageInfo_BackupStatusRequest proto.InternalMessageInfo

type BackupStatusResponse struct {
	CanaryAvailable      bool     `protobuf:"varint,1,opt,name=canary_available,json=canaryAvailable,proto3" json:"canary_available,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *BackupStatusResponse) Reset()         { *m = BackupStatusResponse{} }
func (m *BackupStatusResponse) String() string { return proto.CompactTextString(m) }
func (*BackupStatusResponse) ProtoMessage()    {}
func (*BackupStatusResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{7}
}

func (m *BackupStatusResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_BackupStatusResponse.Unmarshal(m, b)
}
func (m *BackupStatusResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_BackupStatusResponse.Marshal(b, m, deterministic)
}
func (m *BackupStatusResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_BackupStatusResponse.Merge(m, src)
}
func (m *BackupStatusResponse) XXX_Size() int {
	return xxx_messageInfo_BackupStatusResponse.Size(m)
}
func (m *BackupStatusResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_BackupStatusResponse.DiscardUnknown(m)
}

var xxx_messageInfo_BackupStatusResponse proto.InternalMessageInfo

func (m *BackupStatusResponse) GetCanaryAvailable() bool {
	if m != nil {
		return m.CanaryAvailable
	}
	return false
}

type PortsStatusRequest struct {
	// if observe is true, we'll return a stream of changes rather than just the
	// current state of affairs.
	Observe              bool     `protobuf:"varint,1,opt,name=observe,proto3" json:"observe,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *PortsStatusRequest) Reset()         { *m = PortsStatusRequest{} }
func (m *PortsStatusRequest) String() string { return proto.CompactTextString(m) }
func (*PortsStatusRequest) ProtoMessage()    {}
func (*PortsStatusRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{8}
}

func (m *PortsStatusRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_PortsStatusRequest.Unmarshal(m, b)
}
func (m *PortsStatusRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_PortsStatusRequest.Marshal(b, m, deterministic)
}
func (m *PortsStatusRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_PortsStatusRequest.Merge(m, src)
}
func (m *PortsStatusRequest) XXX_Size() int {
	return xxx_messageInfo_PortsStatusRequest.Size(m)
}
func (m *PortsStatusRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_PortsStatusRequest.DiscardUnknown(m)
}

var xxx_messageInfo_PortsStatusRequest proto.InternalMessageInfo

func (m *PortsStatusRequest) GetObserve() bool {
	if m != nil {
		return m.Observe
	}
	return false
}

type PortsStatusResponse struct {
	Ports                []*PortsStatus `protobuf:"bytes,1,rep,name=ports,proto3" json:"ports,omitempty"`
	XXX_NoUnkeyedLiteral struct{}       `json:"-"`
	XXX_unrecognized     []byte         `json:"-"`
	XXX_sizecache        int32          `json:"-"`
}

func (m *PortsStatusResponse) Reset()         { *m = PortsStatusResponse{} }
func (m *PortsStatusResponse) String() string { return proto.CompactTextString(m) }
func (*PortsStatusResponse) ProtoMessage()    {}
func (*PortsStatusResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{9}
}

func (m *PortsStatusResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_PortsStatusResponse.Unmarshal(m, b)
}
func (m *PortsStatusResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_PortsStatusResponse.Marshal(b, m, deterministic)
}
func (m *PortsStatusResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_PortsStatusResponse.Merge(m, src)
}
func (m *PortsStatusResponse) XXX_Size() int {
	return xxx_messageInfo_PortsStatusResponse.Size(m)
}
func (m *PortsStatusResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_PortsStatusResponse.DiscardUnknown(m)
}

var xxx_messageInfo_PortsStatusResponse proto.InternalMessageInfo

func (m *PortsStatusResponse) GetPorts() []*PortsStatus {
	if m != nil {
		return m.Ports
	}
	return nil
}

type PortsStatus struct {
	// local_port is the port a service actually bound to. Some services bind
	// to localhost:<port>, in which case they cannot be made accessible from
	// outside the container. To help with this, supervisor then starts a proxy
	// that forwards traffic to this local port. In those cases, global_port
	// contains the port where the proxy is listening on.
	LocalPort            uint32   `protobuf:"varint,1,opt,name=local_port,json=localPort,proto3" json:"local_port,omitempty"`
	GlobalPort           uint32   `protobuf:"varint,2,opt,name=global_port,json=globalPort,proto3" json:"global_port,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *PortsStatus) Reset()         { *m = PortsStatus{} }
func (m *PortsStatus) String() string { return proto.CompactTextString(m) }
func (*PortsStatus) ProtoMessage()    {}
func (*PortsStatus) Descriptor() ([]byte, []int) {
	return fileDescriptor_dfe4fce6682daf5b, []int{10}
}

func (m *PortsStatus) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_PortsStatus.Unmarshal(m, b)
}
func (m *PortsStatus) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_PortsStatus.Marshal(b, m, deterministic)
}
func (m *PortsStatus) XXX_Merge(src proto.Message) {
	xxx_messageInfo_PortsStatus.Merge(m, src)
}
func (m *PortsStatus) XXX_Size() int {
	return xxx_messageInfo_PortsStatus.Size(m)
}
func (m *PortsStatus) XXX_DiscardUnknown() {
	xxx_messageInfo_PortsStatus.DiscardUnknown(m)
}

var xxx_messageInfo_PortsStatus proto.InternalMessageInfo

func (m *PortsStatus) GetLocalPort() uint32 {
	if m != nil {
		return m.LocalPort
	}
	return 0
}

func (m *PortsStatus) GetGlobalPort() uint32 {
	if m != nil {
		return m.GlobalPort
	}
	return 0
}

func init() {
	proto.RegisterEnum("supervisor.ContentSource", ContentSource_name, ContentSource_value)
	proto.RegisterType((*SupervisorStatusRequest)(nil), "supervisor.SupervisorStatusRequest")
	proto.RegisterType((*SupervisorStatusResponse)(nil), "supervisor.SupervisorStatusResponse")
	proto.RegisterType((*IDEStatusRequest)(nil), "supervisor.IDEStatusRequest")
	proto.RegisterType((*IDEStatusResponse)(nil), "supervisor.IDEStatusResponse")
	proto.RegisterType((*ContentStatusRequest)(nil), "supervisor.ContentStatusRequest")
	proto.RegisterType((*ContentStatusResponse)(nil), "supervisor.ContentStatusResponse")
	proto.RegisterType((*BackupStatusRequest)(nil), "supervisor.BackupStatusRequest")
	proto.RegisterType((*BackupStatusResponse)(nil), "supervisor.BackupStatusResponse")
	proto.RegisterType((*PortsStatusRequest)(nil), "supervisor.PortsStatusRequest")
	proto.RegisterType((*PortsStatusResponse)(nil), "supervisor.PortsStatusResponse")
	proto.RegisterType((*PortsStatus)(nil), "supervisor.PortsStatus")
}

func init() {
	proto.RegisterFile("status.proto", fileDescriptor_dfe4fce6682daf5b)
}

var fileDescriptor_dfe4fce6682daf5b = []byte{
	// 590 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0x84, 0x54, 0xcd, 0x6e, 0xd3, 0x40,
	0x10, 0xc6, 0x2e, 0x2d, 0x74, 0xd2, 0xa4, 0xee, 0xb4, 0x55, 0xd3, 0x28, 0x21, 0xa9, 0xc3, 0x4f,
	0x1a, 0x89, 0x98, 0xa6, 0x27, 0x84, 0x7a, 0x48, 0x53, 0x0e, 0x1c, 0x90, 0x50, 0x72, 0xcb, 0x25,
	0x5a, 0xbb, 0x4b, 0x6a, 0xc5, 0x78, 0x8d, 0xbd, 0x0e, 0x42, 0x85, 0x0b, 0x3c, 0x02, 0x42, 0x3c,
	0x08, 0x8f, 0xc2, 0x2b, 0xf0, 0x20, 0xc8, 0xeb, 0x4d, 0xb3, 0x4e, 0xea, 0x72, 0x89, 0xbc, 0xdf,
	0x7c, 0x3b, 0xdf, 0xb7, 0xa3, 0x6f, 0x02, 0x5b, 0x11, 0x27, 0x3c, 0x8e, 0x3a, 0x41, 0xc8, 0x38,
	0x43, 0x88, 0xe2, 0x80, 0x86, 0x33, 0x37, 0x62, 0x61, 0xa5, 0x3a, 0x61, 0x6c, 0xe2, 0x51, 0x8b,
	0x04, 0xae, 0x45, 0x7c, 0x9f, 0x71, 0xc2, 0x5d, 0xe6, 0x4b, 0xa6, 0x79, 0x08, 0x07, 0xc3, 0x1b,
	0xee, 0x50, 0xf4, 0x18, 0xd0, 0x8f, 0x31, 0x8d, 0xb8, 0xd9, 0x86, 0xf2, 0x6a, 0x29, 0x0a, 0x98,
	0x1f, 0x51, 0x2c, 0x81, 0xce, 0xa6, 0x65, 0xad, 0xa1, 0xb5, 0x1e, 0x0e, 0x74, 0x36, 0x35, 0x9f,
	0x82, 0xf1, 0xe6, 0xe2, 0x75, 0xe6, 0x3e, 0x22, 0xdc, 0xff, 0x44, 0x5c, 0x2e, 0x59, 0xe2, 0xdb,
	0x6c, 0xc2, 0x8e, 0xc2, 0xcb, 0x69, 0xd6, 0x86, 0xbd, 0x3e, 0xf3, 0x39, 0xf5, 0xf9, 0xff, 0x1b,
	0x5e, 0xc1, 0xfe, 0x12, 0x57, 0x36, 0xad, 0xc2, 0x26, 0x99, 0x11, 0xd7, 0x23, 0xb6, 0x47, 0xe5,
	0x8d, 0x05, 0x80, 0x27, 0xb0, 0x11, 0xb1, 0x38, 0x74, 0x68, 0x59, 0x6f, 0x68, 0xad, 0x52, 0xf7,
	0xb0, 0xb3, 0x98, 0x58, 0x67, 0xde, 0x50, 0x10, 0x06, 0x92, 0x68, 0xee, 0xc3, 0xee, 0x39, 0x71,
	0xa6, 0x71, 0x90, 0x9d, 0x52, 0x0f, 0xf6, 0xb2, 0xb0, 0xd4, 0x3f, 0x06, 0xc3, 0x21, 0x3e, 0x09,
	0x3f, 0x8f, 0x97, 0x6d, 0x6c, 0xa7, 0x78, 0x6f, 0x0e, 0x9b, 0x1d, 0xc0, 0x77, 0x2c, 0xe4, 0x51,
	0xf6, 0xb5, 0x65, 0x78, 0xc0, 0xec, 0x88, 0x86, 0xb3, 0xf9, 0xbd, 0xf9, 0xd1, 0xbc, 0x80, 0xdd,
	0x0c, 0x5f, 0x2a, 0x3e, 0x87, 0xf5, 0x20, 0x81, 0xcb, 0x5a, 0x63, 0xad, 0x55, 0xe8, 0x1e, 0xa8,
	0x4f, 0x52, 0xf9, 0x29, 0xcb, 0x7c, 0x0b, 0x05, 0x05, 0xc5, 0x1a, 0x80, 0xc7, 0x1c, 0xe2, 0x8d,
	0x93, 0xaa, 0x50, 0x2c, 0x0e, 0x36, 0x05, 0x92, 0xb0, 0xb0, 0x0e, 0x85, 0x89, 0xc7, 0xec, 0x79,
	0x5d, 0x17, 0x75, 0x48, 0xa1, 0x84, 0xd0, 0xee, 0x43, 0x31, 0x33, 0x37, 0x2c, 0x01, 0xbc, 0x0f,
	0xd9, 0x87, 0x31, 0xe3, 0x57, 0x34, 0x34, 0xee, 0xe1, 0x36, 0x14, 0xc4, 0xd9, 0x16, 0xd3, 0x32,
	0x34, 0xdc, 0x81, 0xa2, 0x00, 0x82, 0x90, 0xda, 0xb1, 0xeb, 0x5d, 0x1a, 0x7a, 0xf7, 0xf7, 0x3a,
	0x14, 0x53, 0x3f, 0xc3, 0xc4, 0xb9, 0x43, 0xf1, 0x0b, 0x18, 0xcb, 0x21, 0xc4, 0xa6, 0xfa, 0xb2,
	0x9c, 0xf4, 0x56, 0x1e, 0xdf, 0x4d, 0x4a, 0x67, 0x66, 0xd6, 0xbe, 0xfd, 0xf9, 0xfb, 0x43, 0x3f,
	0xc0, 0x7d, 0x6b, 0x76, 0x62, 0xa5, 0x2b, 0x64, 0x2d, 0xee, 0xe1, 0x77, 0x0d, 0x36, 0x6f, 0xf2,
	0x8a, 0x55, 0xb5, 0xe5, 0x72, 0xdc, 0x2b, 0xb5, 0x9c, 0xaa, 0x54, 0x7a, 0x29, 0x94, 0x4e, 0xb1,
	0xa4, 0x28, 0xb9, 0x97, 0x74, 0x74, 0x84, 0xf5, 0x2c, 0x62, 0x25, 0xb9, 0xb6, 0xae, 0x93, 0xdf,
	0x33, 0x1e, 0xc6, 0xf4, 0x2b, 0xfe, 0xd2, 0x16, 0xb3, 0x4d, 0x9d, 0x34, 0x6e, 0x8b, 0x6b, 0xc6,
	0xcd, 0xd1, 0x1d, 0x0c, 0xe9, 0xa8, 0x27, 0x1c, 0xbd, 0x42, 0x54, 0xf4, 0x9d, 0x94, 0x39, 0x7a,
	0x82, 0xcd, 0x55, 0x74, 0xd5, 0x99, 0x07, 0x5b, 0x6a, 0xf8, 0xb1, 0xae, 0xaa, 0xde, 0xb2, 0x2d,
	0x95, 0x46, 0x3e, 0x41, 0xba, 0x3a, 0x14, 0xae, 0x76, 0x71, 0x47, 0xd1, 0x4f, 0x23, 0x83, 0x3f,
	0xb5, 0x6c, 0x64, 0x1f, 0xe5, 0x25, 0x5c, 0x8a, 0xd5, 0x73, 0xeb, 0x52, 0xab, 0x2f, 0xb4, 0xce,
	0xd0, 0x50, 0xb4, 0xc4, 0x72, 0x8c, 0x8e, 0xf1, 0xd9, 0x32, 0x66, 0xc9, 0xf5, 0xb3, 0xae, 0xe5,
	0x47, 0x3a, 0x83, 0x17, 0xda, 0xf9, 0xfa, 0x68, 0x8d, 0x04, 0xae, 0xbd, 0x21, 0xfe, 0x51, 0x4f,
	0xff, 0x05, 0x00, 0x00, 0xff, 0xff, 0x1b, 0x56, 0xfe, 0xff, 0x8b, 0x05, 0x00, 0x00,
}

// Reference imports to suppress errors if they are not otherwise used.
var _ context.Context
var _ grpc.ClientConnInterface

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
const _ = grpc.SupportPackageIsVersion6

// StatusServiceClient is the client API for StatusService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type StatusServiceClient interface {
	// SupervisorStatus returns once supervisor is running.
	SupervisorStatus(ctx context.Context, in *SupervisorStatusRequest, opts ...grpc.CallOption) (*SupervisorStatusResponse, error)
	// IDEStatus returns OK if the IDE can serve requests.
	IDEStatus(ctx context.Context, in *IDEStatusRequest, opts ...grpc.CallOption) (*IDEStatusResponse, error)
	// ContentStatus returns the status of the workspace content. When used with `wait`, the call
	// returns when the content has become available.
	ContentStatus(ctx context.Context, in *ContentStatusRequest, opts ...grpc.CallOption) (*ContentStatusResponse, error)
	// BackupStatus offers feedback on the workspace backup status. This status information can
	// be relayed to the user to provide transparency as to how "safe" their files/content
	// data are w.r.t. to being lost.
	BackupStatus(ctx context.Context, in *BackupStatusRequest, opts ...grpc.CallOption) (*BackupStatusResponse, error)
	// PortsStatus provides feedback about the network ports currently in use.
	PortsStatus(ctx context.Context, in *PortsStatusRequest, opts ...grpc.CallOption) (StatusService_PortsStatusClient, error)
}

type statusServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewStatusServiceClient(cc grpc.ClientConnInterface) StatusServiceClient {
	return &statusServiceClient{cc}
}

func (c *statusServiceClient) SupervisorStatus(ctx context.Context, in *SupervisorStatusRequest, opts ...grpc.CallOption) (*SupervisorStatusResponse, error) {
	out := new(SupervisorStatusResponse)
	err := c.cc.Invoke(ctx, "/supervisor.StatusService/SupervisorStatus", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *statusServiceClient) IDEStatus(ctx context.Context, in *IDEStatusRequest, opts ...grpc.CallOption) (*IDEStatusResponse, error) {
	out := new(IDEStatusResponse)
	err := c.cc.Invoke(ctx, "/supervisor.StatusService/IDEStatus", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *statusServiceClient) ContentStatus(ctx context.Context, in *ContentStatusRequest, opts ...grpc.CallOption) (*ContentStatusResponse, error) {
	out := new(ContentStatusResponse)
	err := c.cc.Invoke(ctx, "/supervisor.StatusService/ContentStatus", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *statusServiceClient) BackupStatus(ctx context.Context, in *BackupStatusRequest, opts ...grpc.CallOption) (*BackupStatusResponse, error) {
	out := new(BackupStatusResponse)
	err := c.cc.Invoke(ctx, "/supervisor.StatusService/BackupStatus", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *statusServiceClient) PortsStatus(ctx context.Context, in *PortsStatusRequest, opts ...grpc.CallOption) (StatusService_PortsStatusClient, error) {
	stream, err := c.cc.NewStream(ctx, &_StatusService_serviceDesc.Streams[0], "/supervisor.StatusService/PortsStatus", opts...)
	if err != nil {
		return nil, err
	}
	x := &statusServicePortsStatusClient{stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	return x, nil
}

type StatusService_PortsStatusClient interface {
	Recv() (*PortsStatusResponse, error)
	grpc.ClientStream
}

type statusServicePortsStatusClient struct {
	grpc.ClientStream
}

func (x *statusServicePortsStatusClient) Recv() (*PortsStatusResponse, error) {
	m := new(PortsStatusResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

// StatusServiceServer is the server API for StatusService service.
type StatusServiceServer interface {
	// SupervisorStatus returns once supervisor is running.
	SupervisorStatus(context.Context, *SupervisorStatusRequest) (*SupervisorStatusResponse, error)
	// IDEStatus returns OK if the IDE can serve requests.
	IDEStatus(context.Context, *IDEStatusRequest) (*IDEStatusResponse, error)
	// ContentStatus returns the status of the workspace content. When used with `wait`, the call
	// returns when the content has become available.
	ContentStatus(context.Context, *ContentStatusRequest) (*ContentStatusResponse, error)
	// BackupStatus offers feedback on the workspace backup status. This status information can
	// be relayed to the user to provide transparency as to how "safe" their files/content
	// data are w.r.t. to being lost.
	BackupStatus(context.Context, *BackupStatusRequest) (*BackupStatusResponse, error)
	// PortsStatus provides feedback about the network ports currently in use.
	PortsStatus(*PortsStatusRequest, StatusService_PortsStatusServer) error
}

// UnimplementedStatusServiceServer can be embedded to have forward compatible implementations.
type UnimplementedStatusServiceServer struct {
}

func (*UnimplementedStatusServiceServer) SupervisorStatus(ctx context.Context, req *SupervisorStatusRequest) (*SupervisorStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SupervisorStatus not implemented")
}
func (*UnimplementedStatusServiceServer) IDEStatus(ctx context.Context, req *IDEStatusRequest) (*IDEStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method IDEStatus not implemented")
}
func (*UnimplementedStatusServiceServer) ContentStatus(ctx context.Context, req *ContentStatusRequest) (*ContentStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ContentStatus not implemented")
}
func (*UnimplementedStatusServiceServer) BackupStatus(ctx context.Context, req *BackupStatusRequest) (*BackupStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method BackupStatus not implemented")
}
func (*UnimplementedStatusServiceServer) PortsStatus(req *PortsStatusRequest, srv StatusService_PortsStatusServer) error {
	return status.Errorf(codes.Unimplemented, "method PortsStatus not implemented")
}

func RegisterStatusServiceServer(s *grpc.Server, srv StatusServiceServer) {
	s.RegisterService(&_StatusService_serviceDesc, srv)
}

func _StatusService_SupervisorStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SupervisorStatusRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(StatusServiceServer).SupervisorStatus(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.StatusService/SupervisorStatus",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(StatusServiceServer).SupervisorStatus(ctx, req.(*SupervisorStatusRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _StatusService_IDEStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(IDEStatusRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(StatusServiceServer).IDEStatus(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.StatusService/IDEStatus",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(StatusServiceServer).IDEStatus(ctx, req.(*IDEStatusRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _StatusService_ContentStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ContentStatusRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(StatusServiceServer).ContentStatus(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.StatusService/ContentStatus",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(StatusServiceServer).ContentStatus(ctx, req.(*ContentStatusRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _StatusService_BackupStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(BackupStatusRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(StatusServiceServer).BackupStatus(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.StatusService/BackupStatus",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(StatusServiceServer).BackupStatus(ctx, req.(*BackupStatusRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _StatusService_PortsStatus_Handler(srv interface{}, stream grpc.ServerStream) error {
	m := new(PortsStatusRequest)
	if err := stream.RecvMsg(m); err != nil {
		return err
	}
	return srv.(StatusServiceServer).PortsStatus(m, &statusServicePortsStatusServer{stream})
}

type StatusService_PortsStatusServer interface {
	Send(*PortsStatusResponse) error
	grpc.ServerStream
}

type statusServicePortsStatusServer struct {
	grpc.ServerStream
}

func (x *statusServicePortsStatusServer) Send(m *PortsStatusResponse) error {
	return x.ServerStream.SendMsg(m)
}

var _StatusService_serviceDesc = grpc.ServiceDesc{
	ServiceName: "supervisor.StatusService",
	HandlerType: (*StatusServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "SupervisorStatus",
			Handler:    _StatusService_SupervisorStatus_Handler,
		},
		{
			MethodName: "IDEStatus",
			Handler:    _StatusService_IDEStatus_Handler,
		},
		{
			MethodName: "ContentStatus",
			Handler:    _StatusService_ContentStatus_Handler,
		},
		{
			MethodName: "BackupStatus",
			Handler:    _StatusService_BackupStatus_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "PortsStatus",
			Handler:       _StatusService_PortsStatus_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "status.proto",
}
