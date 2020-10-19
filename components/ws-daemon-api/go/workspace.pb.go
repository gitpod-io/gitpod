// Code generated by protoc-gen-go. DO NOT EDIT.
// source: workspace.proto

package api

import (
	context "context"
	fmt "fmt"
	api "github.com/gitpod-io/gitpod/content-service/api"
	proto "github.com/golang/protobuf/proto"
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

type BackupCanaryRequest struct {
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *BackupCanaryRequest) Reset()         { *m = BackupCanaryRequest{} }
func (m *BackupCanaryRequest) String() string { return proto.CompactTextString(m) }
func (*BackupCanaryRequest) ProtoMessage()    {}
func (*BackupCanaryRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{0}
}

func (m *BackupCanaryRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_BackupCanaryRequest.Unmarshal(m, b)
}
func (m *BackupCanaryRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_BackupCanaryRequest.Marshal(b, m, deterministic)
}
func (m *BackupCanaryRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_BackupCanaryRequest.Merge(m, src)
}
func (m *BackupCanaryRequest) XXX_Size() int {
	return xxx_messageInfo_BackupCanaryRequest.Size(m)
}
func (m *BackupCanaryRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_BackupCanaryRequest.DiscardUnknown(m)
}

var xxx_messageInfo_BackupCanaryRequest proto.InternalMessageInfo

type BackupCanaryResponse struct {
	Success              bool     `protobuf:"varint,2,opt,name=success,proto3" json:"success,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *BackupCanaryResponse) Reset()         { *m = BackupCanaryResponse{} }
func (m *BackupCanaryResponse) String() string { return proto.CompactTextString(m) }
func (*BackupCanaryResponse) ProtoMessage()    {}
func (*BackupCanaryResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{1}
}

func (m *BackupCanaryResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_BackupCanaryResponse.Unmarshal(m, b)
}
func (m *BackupCanaryResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_BackupCanaryResponse.Marshal(b, m, deterministic)
}
func (m *BackupCanaryResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_BackupCanaryResponse.Merge(m, src)
}
func (m *BackupCanaryResponse) XXX_Size() int {
	return xxx_messageInfo_BackupCanaryResponse.Size(m)
}
func (m *BackupCanaryResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_BackupCanaryResponse.DiscardUnknown(m)
}

var xxx_messageInfo_BackupCanaryResponse proto.InternalMessageInfo

func (m *BackupCanaryResponse) GetSuccess() bool {
	if m != nil {
		return m.Success
	}
	return false
}

type PauseTheiaRequest struct {
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *PauseTheiaRequest) Reset()         { *m = PauseTheiaRequest{} }
func (m *PauseTheiaRequest) String() string { return proto.CompactTextString(m) }
func (*PauseTheiaRequest) ProtoMessage()    {}
func (*PauseTheiaRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{2}
}

func (m *PauseTheiaRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_PauseTheiaRequest.Unmarshal(m, b)
}
func (m *PauseTheiaRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_PauseTheiaRequest.Marshal(b, m, deterministic)
}
func (m *PauseTheiaRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_PauseTheiaRequest.Merge(m, src)
}
func (m *PauseTheiaRequest) XXX_Size() int {
	return xxx_messageInfo_PauseTheiaRequest.Size(m)
}
func (m *PauseTheiaRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_PauseTheiaRequest.DiscardUnknown(m)
}

var xxx_messageInfo_PauseTheiaRequest proto.InternalMessageInfo

type PauseTheiaResponse struct {
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *PauseTheiaResponse) Reset()         { *m = PauseTheiaResponse{} }
func (m *PauseTheiaResponse) String() string { return proto.CompactTextString(m) }
func (*PauseTheiaResponse) ProtoMessage()    {}
func (*PauseTheiaResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{3}
}

func (m *PauseTheiaResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_PauseTheiaResponse.Unmarshal(m, b)
}
func (m *PauseTheiaResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_PauseTheiaResponse.Marshal(b, m, deterministic)
}
func (m *PauseTheiaResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_PauseTheiaResponse.Merge(m, src)
}
func (m *PauseTheiaResponse) XXX_Size() int {
	return xxx_messageInfo_PauseTheiaResponse.Size(m)
}
func (m *PauseTheiaResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_PauseTheiaResponse.DiscardUnknown(m)
}

var xxx_messageInfo_PauseTheiaResponse proto.InternalMessageInfo

type GitStatusRequest struct {
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *GitStatusRequest) Reset()         { *m = GitStatusRequest{} }
func (m *GitStatusRequest) String() string { return proto.CompactTextString(m) }
func (*GitStatusRequest) ProtoMessage()    {}
func (*GitStatusRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{4}
}

func (m *GitStatusRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_GitStatusRequest.Unmarshal(m, b)
}
func (m *GitStatusRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_GitStatusRequest.Marshal(b, m, deterministic)
}
func (m *GitStatusRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_GitStatusRequest.Merge(m, src)
}
func (m *GitStatusRequest) XXX_Size() int {
	return xxx_messageInfo_GitStatusRequest.Size(m)
}
func (m *GitStatusRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_GitStatusRequest.DiscardUnknown(m)
}

var xxx_messageInfo_GitStatusRequest proto.InternalMessageInfo

type GitStatusResponse struct {
	Repo                 *api.GitStatus `protobuf:"bytes,1,opt,name=repo,proto3" json:"repo,omitempty"`
	XXX_NoUnkeyedLiteral struct{}       `json:"-"`
	XXX_unrecognized     []byte         `json:"-"`
	XXX_sizecache        int32          `json:"-"`
}

func (m *GitStatusResponse) Reset()         { *m = GitStatusResponse{} }
func (m *GitStatusResponse) String() string { return proto.CompactTextString(m) }
func (*GitStatusResponse) ProtoMessage()    {}
func (*GitStatusResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{5}
}

func (m *GitStatusResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_GitStatusResponse.Unmarshal(m, b)
}
func (m *GitStatusResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_GitStatusResponse.Marshal(b, m, deterministic)
}
func (m *GitStatusResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_GitStatusResponse.Merge(m, src)
}
func (m *GitStatusResponse) XXX_Size() int {
	return xxx_messageInfo_GitStatusResponse.Size(m)
}
func (m *GitStatusResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_GitStatusResponse.DiscardUnknown(m)
}

var xxx_messageInfo_GitStatusResponse proto.InternalMessageInfo

func (m *GitStatusResponse) GetRepo() *api.GitStatus {
	if m != nil {
		return m.Repo
	}
	return nil
}

type UidmapCanaryResponse struct {
	Message              string   `protobuf:"bytes,1,opt,name=message,proto3" json:"message,omitempty"`
	ErrorCode            uint32   `protobuf:"varint,2,opt,name=error_code,json=errorCode,proto3" json:"error_code,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *UidmapCanaryResponse) Reset()         { *m = UidmapCanaryResponse{} }
func (m *UidmapCanaryResponse) String() string { return proto.CompactTextString(m) }
func (*UidmapCanaryResponse) ProtoMessage()    {}
func (*UidmapCanaryResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{6}
}

func (m *UidmapCanaryResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_UidmapCanaryResponse.Unmarshal(m, b)
}
func (m *UidmapCanaryResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_UidmapCanaryResponse.Marshal(b, m, deterministic)
}
func (m *UidmapCanaryResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_UidmapCanaryResponse.Merge(m, src)
}
func (m *UidmapCanaryResponse) XXX_Size() int {
	return xxx_messageInfo_UidmapCanaryResponse.Size(m)
}
func (m *UidmapCanaryResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_UidmapCanaryResponse.DiscardUnknown(m)
}

var xxx_messageInfo_UidmapCanaryResponse proto.InternalMessageInfo

func (m *UidmapCanaryResponse) GetMessage() string {
	if m != nil {
		return m.Message
	}
	return ""
}

func (m *UidmapCanaryResponse) GetErrorCode() uint32 {
	if m != nil {
		return m.ErrorCode
	}
	return 0
}

type UidmapCanaryRequest struct {
	Pid                  int64                          `protobuf:"varint,1,opt,name=pid,proto3" json:"pid,omitempty"`
	Gid                  bool                           `protobuf:"varint,2,opt,name=gid,proto3" json:"gid,omitempty"`
	Mapping              []*UidmapCanaryRequest_Mapping `protobuf:"bytes,3,rep,name=mapping,proto3" json:"mapping,omitempty"`
	XXX_NoUnkeyedLiteral struct{}                       `json:"-"`
	XXX_unrecognized     []byte                         `json:"-"`
	XXX_sizecache        int32                          `json:"-"`
}

func (m *UidmapCanaryRequest) Reset()         { *m = UidmapCanaryRequest{} }
func (m *UidmapCanaryRequest) String() string { return proto.CompactTextString(m) }
func (*UidmapCanaryRequest) ProtoMessage()    {}
func (*UidmapCanaryRequest) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{7}
}

func (m *UidmapCanaryRequest) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_UidmapCanaryRequest.Unmarshal(m, b)
}
func (m *UidmapCanaryRequest) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_UidmapCanaryRequest.Marshal(b, m, deterministic)
}
func (m *UidmapCanaryRequest) XXX_Merge(src proto.Message) {
	xxx_messageInfo_UidmapCanaryRequest.Merge(m, src)
}
func (m *UidmapCanaryRequest) XXX_Size() int {
	return xxx_messageInfo_UidmapCanaryRequest.Size(m)
}
func (m *UidmapCanaryRequest) XXX_DiscardUnknown() {
	xxx_messageInfo_UidmapCanaryRequest.DiscardUnknown(m)
}

var xxx_messageInfo_UidmapCanaryRequest proto.InternalMessageInfo

func (m *UidmapCanaryRequest) GetPid() int64 {
	if m != nil {
		return m.Pid
	}
	return 0
}

func (m *UidmapCanaryRequest) GetGid() bool {
	if m != nil {
		return m.Gid
	}
	return false
}

func (m *UidmapCanaryRequest) GetMapping() []*UidmapCanaryRequest_Mapping {
	if m != nil {
		return m.Mapping
	}
	return nil
}

type UidmapCanaryRequest_Mapping struct {
	ContainerId          uint32   `protobuf:"varint,1,opt,name=container_id,json=containerId,proto3" json:"container_id,omitempty"`
	HostId               uint32   `protobuf:"varint,2,opt,name=host_id,json=hostId,proto3" json:"host_id,omitempty"`
	Size                 uint32   `protobuf:"varint,3,opt,name=size,proto3" json:"size,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *UidmapCanaryRequest_Mapping) Reset()         { *m = UidmapCanaryRequest_Mapping{} }
func (m *UidmapCanaryRequest_Mapping) String() string { return proto.CompactTextString(m) }
func (*UidmapCanaryRequest_Mapping) ProtoMessage()    {}
func (*UidmapCanaryRequest_Mapping) Descriptor() ([]byte, []int) {
	return fileDescriptor_dac718ecaafc2333, []int{7, 0}
}

func (m *UidmapCanaryRequest_Mapping) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_UidmapCanaryRequest_Mapping.Unmarshal(m, b)
}
func (m *UidmapCanaryRequest_Mapping) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_UidmapCanaryRequest_Mapping.Marshal(b, m, deterministic)
}
func (m *UidmapCanaryRequest_Mapping) XXX_Merge(src proto.Message) {
	xxx_messageInfo_UidmapCanaryRequest_Mapping.Merge(m, src)
}
func (m *UidmapCanaryRequest_Mapping) XXX_Size() int {
	return xxx_messageInfo_UidmapCanaryRequest_Mapping.Size(m)
}
func (m *UidmapCanaryRequest_Mapping) XXX_DiscardUnknown() {
	xxx_messageInfo_UidmapCanaryRequest_Mapping.DiscardUnknown(m)
}

var xxx_messageInfo_UidmapCanaryRequest_Mapping proto.InternalMessageInfo

func (m *UidmapCanaryRequest_Mapping) GetContainerId() uint32 {
	if m != nil {
		return m.ContainerId
	}
	return 0
}

func (m *UidmapCanaryRequest_Mapping) GetHostId() uint32 {
	if m != nil {
		return m.HostId
	}
	return 0
}

func (m *UidmapCanaryRequest_Mapping) GetSize() uint32 {
	if m != nil {
		return m.Size
	}
	return 0
}

func init() {
	proto.RegisterType((*BackupCanaryRequest)(nil), "wsbs.BackupCanaryRequest")
	proto.RegisterType((*BackupCanaryResponse)(nil), "wsbs.BackupCanaryResponse")
	proto.RegisterType((*PauseTheiaRequest)(nil), "wsbs.PauseTheiaRequest")
	proto.RegisterType((*PauseTheiaResponse)(nil), "wsbs.PauseTheiaResponse")
	proto.RegisterType((*GitStatusRequest)(nil), "wsbs.GitStatusRequest")
	proto.RegisterType((*GitStatusResponse)(nil), "wsbs.GitStatusResponse")
	proto.RegisterType((*UidmapCanaryResponse)(nil), "wsbs.UidmapCanaryResponse")
	proto.RegisterType((*UidmapCanaryRequest)(nil), "wsbs.UidmapCanaryRequest")
	proto.RegisterType((*UidmapCanaryRequest_Mapping)(nil), "wsbs.UidmapCanaryRequest.Mapping")
}

func init() {
	proto.RegisterFile("workspace.proto", fileDescriptor_dac718ecaafc2333)
}

var fileDescriptor_dac718ecaafc2333 = []byte{
	// 481 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0x6c, 0x53, 0x5d, 0x8b, 0xd3, 0x40,
	0x14, 0xdd, 0x6c, 0xca, 0xd6, 0xde, 0x6e, 0x71, 0x3b, 0xad, 0x36, 0x1b, 0x10, 0xba, 0x01, 0x21,
	0x22, 0x49, 0x97, 0xfa, 0x28, 0xf8, 0xd0, 0x3e, 0x68, 0x11, 0x51, 0xa2, 0x22, 0xfa, 0x52, 0xa6,
	0xc9, 0x25, 0x1d, 0x76, 0x93, 0x19, 0x67, 0x26, 0x16, 0xf7, 0x67, 0xf9, 0x4f, 0xfc, 0x47, 0x92,
	0x8f, 0xd9, 0x6d, 0x6d, 0xde, 0xee, 0x3d, 0xb9, 0x73, 0xe6, 0x9e, 0x39, 0x27, 0xf0, 0x78, 0xc7,
	0xe5, 0x8d, 0x12, 0x34, 0xc6, 0x50, 0x48, 0xae, 0x39, 0xe9, 0xec, 0xd4, 0x46, 0xb9, 0xcf, 0x63,
	0x9e, 0x6b, 0xcc, 0x75, 0xa0, 0x50, 0xfe, 0x62, 0x31, 0x06, 0x54, 0xb0, 0x19, 0xcb, 0x99, 0x66,
	0xf4, 0x96, 0xdd, 0xa1, 0xac, 0x87, 0xbd, 0x27, 0x30, 0x5a, 0xd0, 0xf8, 0xa6, 0x10, 0x4b, 0x9a,
	0x53, 0xf9, 0x3b, 0xc2, 0x9f, 0x05, 0x2a, 0xed, 0x5d, 0xc3, 0xf8, 0x10, 0x56, 0x82, 0xe7, 0x0a,
	0x89, 0x03, 0x5d, 0x55, 0xc4, 0x31, 0x2a, 0xe5, 0x9c, 0x4e, 0x2d, 0xff, 0x51, 0x64, 0x5a, 0x6f,
	0x04, 0xc3, 0x4f, 0xb4, 0x50, 0xf8, 0x65, 0x8b, 0x8c, 0x1a, 0x9a, 0x31, 0x90, 0x7d, 0xb0, 0x26,
	0xf1, 0x08, 0x5c, 0xbc, 0x65, 0xfa, 0xb3, 0xa6, 0xba, 0x50, 0x66, 0x72, 0x01, 0xc3, 0x3d, 0xac,
	0xb9, 0x2d, 0x80, 0x8e, 0x44, 0xc1, 0x1d, 0x6b, 0x6a, 0xf9, 0xfd, 0xf9, 0x65, 0xd8, 0x48, 0x6a,
	0x14, 0x85, 0x0f, 0x07, 0xaa, 0x31, 0xef, 0x23, 0x8c, 0xbf, 0xb2, 0x24, 0xa3, 0x2d, 0x4b, 0x67,
	0xa8, 0x14, 0x4d, 0xb1, 0x62, 0xea, 0x45, 0xa6, 0x25, 0xcf, 0x00, 0x50, 0x4a, 0x2e, 0xd7, 0x31,
	0x4f, 0xb0, 0x52, 0x34, 0x88, 0x7a, 0x15, 0xb2, 0xe4, 0x09, 0x7a, 0x7f, 0x2d, 0x18, 0x1d, 0x32,
	0x56, 0xcb, 0x92, 0x0b, 0xb0, 0x05, 0x4b, 0x2a, 0x32, 0x3b, 0x2a, 0xcb, 0x12, 0x49, 0x59, 0xd2,
	0xbc, 0x49, 0x59, 0x92, 0xd7, 0xd0, 0xcd, 0xa8, 0x10, 0x2c, 0x4f, 0x1d, 0x7b, 0x6a, 0xfb, 0xfd,
	0xf9, 0x55, 0x58, 0xfa, 0x12, 0xb6, 0xf0, 0x85, 0x1f, 0xea, 0xc1, 0xc8, 0x9c, 0x70, 0xbf, 0x43,
	0xb7, 0xc1, 0xc8, 0x15, 0x9c, 0x97, 0xb2, 0x29, 0xcb, 0x51, 0xae, 0x9b, 0x4b, 0x07, 0x51, 0xff,
	0x1e, 0x5b, 0x25, 0x64, 0x02, 0xdd, 0x2d, 0x57, 0x7a, 0xdd, 0x2c, 0x30, 0x88, 0xce, 0xca, 0x76,
	0x95, 0x10, 0x02, 0x1d, 0xc5, 0xee, 0xd0, 0xb1, 0x2b, 0xb4, 0xaa, 0xe7, 0x7f, 0x4e, 0x61, 0xb8,
	0xca, 0xbf, 0x99, 0xcc, 0xbc, 0xc3, 0x5b, 0x81, 0x92, 0xbc, 0x87, 0xf3, 0x7d, 0xbf, 0x89, 0x5b,
	0x2f, 0xdb, 0x96, 0x01, 0xf7, 0xb2, 0xed, 0x5b, 0xed, 0xe2, 0x89, 0x6f, 0x5d, 0x5b, 0x64, 0x09,
	0xf0, 0xe0, 0x3a, 0x99, 0xd4, 0xe3, 0x47, 0xe1, 0x70, 0x9d, 0xe3, 0x0f, 0x4d, 0x40, 0x4e, 0x7c,
	0x8b, 0xbc, 0x81, 0xde, 0xbd, 0xbf, 0xe4, 0x69, 0x3d, 0xfa, 0x7f, 0x6a, 0xdc, 0xc9, 0x11, 0x6e,
	0x18, 0x4a, 0x45, 0xfb, 0x4f, 0x6d, 0x14, 0xb5, 0x05, 0xc4, 0x28, 0x6a, 0xb1, 0xa6, 0x56, 0xb4,
	0x78, 0xf9, 0xe3, 0x45, 0xca, 0xf4, 0xb6, 0xd8, 0x84, 0x31, 0xcf, 0x66, 0x29, 0xd3, 0x82, 0x27,
	0x01, 0xe3, 0x4d, 0x35, 0xdb, 0xa9, 0x20, 0xa1, 0x98, 0xf1, 0x7c, 0x46, 0x05, 0xdb, 0x9c, 0x55,
	0x7f, 0xd6, 0xab, 0x7f, 0x01, 0x00, 0x00, 0xff, 0xff, 0x5c, 0x92, 0x50, 0x81, 0x99, 0x03, 0x00,
	0x00,
}

// Reference imports to suppress errors if they are not otherwise used.
var _ context.Context
var _ grpc.ClientConnInterface

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
const _ = grpc.SupportPackageIsVersion6

// InWorkspaceHelperClient is the client API for InWorkspaceHelper service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type InWorkspaceHelperClient interface {
	// BackupCanary can prepare workspace content backups. The canary is supposed to be triggered
	// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
	//
	// Note that the request/response flow is inverted here, as it's the server (supervisor) which requests a backup
	// from the client (ws-daemon).
	BackupCanary(ctx context.Context, opts ...grpc.CallOption) (InWorkspaceHelper_BackupCanaryClient, error)
	// PauseTheia can pause the Theia process and all its children. As long as the request stream
	// is held Theia will be paused.
	// This is a stop-the-world mechanism for preventing concurrent modification during backup.
	PauseTheia(ctx context.Context, opts ...grpc.CallOption) (InWorkspaceHelper_PauseTheiaClient, error)
	GitStatus(ctx context.Context, in *GitStatusRequest, opts ...grpc.CallOption) (*GitStatusResponse, error)
	// UidmapCanary can establish a uid mapping of a new user namespace spawned within the workspace.
	UidmapCanary(ctx context.Context, opts ...grpc.CallOption) (InWorkspaceHelper_UidmapCanaryClient, error)
}

type inWorkspaceHelperClient struct {
	cc grpc.ClientConnInterface
}

func NewInWorkspaceHelperClient(cc grpc.ClientConnInterface) InWorkspaceHelperClient {
	return &inWorkspaceHelperClient{cc}
}

func (c *inWorkspaceHelperClient) BackupCanary(ctx context.Context, opts ...grpc.CallOption) (InWorkspaceHelper_BackupCanaryClient, error) {
	stream, err := c.cc.NewStream(ctx, &_InWorkspaceHelper_serviceDesc.Streams[0], "/wsbs.InWorkspaceHelper/BackupCanary", opts...)
	if err != nil {
		return nil, err
	}
	x := &inWorkspaceHelperBackupCanaryClient{stream}
	return x, nil
}

type InWorkspaceHelper_BackupCanaryClient interface {
	Send(*BackupCanaryResponse) error
	Recv() (*BackupCanaryRequest, error)
	grpc.ClientStream
}

type inWorkspaceHelperBackupCanaryClient struct {
	grpc.ClientStream
}

func (x *inWorkspaceHelperBackupCanaryClient) Send(m *BackupCanaryResponse) error {
	return x.ClientStream.SendMsg(m)
}

func (x *inWorkspaceHelperBackupCanaryClient) Recv() (*BackupCanaryRequest, error) {
	m := new(BackupCanaryRequest)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *inWorkspaceHelperClient) PauseTheia(ctx context.Context, opts ...grpc.CallOption) (InWorkspaceHelper_PauseTheiaClient, error) {
	stream, err := c.cc.NewStream(ctx, &_InWorkspaceHelper_serviceDesc.Streams[1], "/wsbs.InWorkspaceHelper/PauseTheia", opts...)
	if err != nil {
		return nil, err
	}
	x := &inWorkspaceHelperPauseTheiaClient{stream}
	return x, nil
}

type InWorkspaceHelper_PauseTheiaClient interface {
	Send(*PauseTheiaRequest) error
	CloseAndRecv() (*PauseTheiaResponse, error)
	grpc.ClientStream
}

type inWorkspaceHelperPauseTheiaClient struct {
	grpc.ClientStream
}

func (x *inWorkspaceHelperPauseTheiaClient) Send(m *PauseTheiaRequest) error {
	return x.ClientStream.SendMsg(m)
}

func (x *inWorkspaceHelperPauseTheiaClient) CloseAndRecv() (*PauseTheiaResponse, error) {
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	m := new(PauseTheiaResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *inWorkspaceHelperClient) GitStatus(ctx context.Context, in *GitStatusRequest, opts ...grpc.CallOption) (*GitStatusResponse, error) {
	out := new(GitStatusResponse)
	err := c.cc.Invoke(ctx, "/wsbs.InWorkspaceHelper/GitStatus", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inWorkspaceHelperClient) UidmapCanary(ctx context.Context, opts ...grpc.CallOption) (InWorkspaceHelper_UidmapCanaryClient, error) {
	stream, err := c.cc.NewStream(ctx, &_InWorkspaceHelper_serviceDesc.Streams[2], "/wsbs.InWorkspaceHelper/UidmapCanary", opts...)
	if err != nil {
		return nil, err
	}
	x := &inWorkspaceHelperUidmapCanaryClient{stream}
	return x, nil
}

type InWorkspaceHelper_UidmapCanaryClient interface {
	Send(*UidmapCanaryResponse) error
	Recv() (*UidmapCanaryRequest, error)
	grpc.ClientStream
}

type inWorkspaceHelperUidmapCanaryClient struct {
	grpc.ClientStream
}

func (x *inWorkspaceHelperUidmapCanaryClient) Send(m *UidmapCanaryResponse) error {
	return x.ClientStream.SendMsg(m)
}

func (x *inWorkspaceHelperUidmapCanaryClient) Recv() (*UidmapCanaryRequest, error) {
	m := new(UidmapCanaryRequest)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

// InWorkspaceHelperServer is the server API for InWorkspaceHelper service.
type InWorkspaceHelperServer interface {
	// BackupCanary can prepare workspace content backups. The canary is supposed to be triggered
	// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
	//
	// Note that the request/response flow is inverted here, as it's the server (supervisor) which requests a backup
	// from the client (ws-daemon).
	BackupCanary(InWorkspaceHelper_BackupCanaryServer) error
	// PauseTheia can pause the Theia process and all its children. As long as the request stream
	// is held Theia will be paused.
	// This is a stop-the-world mechanism for preventing concurrent modification during backup.
	PauseTheia(InWorkspaceHelper_PauseTheiaServer) error
	GitStatus(context.Context, *GitStatusRequest) (*GitStatusResponse, error)
	// UidmapCanary can establish a uid mapping of a new user namespace spawned within the workspace.
	UidmapCanary(InWorkspaceHelper_UidmapCanaryServer) error
}

// UnimplementedInWorkspaceHelperServer can be embedded to have forward compatible implementations.
type UnimplementedInWorkspaceHelperServer struct {
}

func (*UnimplementedInWorkspaceHelperServer) BackupCanary(srv InWorkspaceHelper_BackupCanaryServer) error {
	return status.Errorf(codes.Unimplemented, "method BackupCanary not implemented")
}
func (*UnimplementedInWorkspaceHelperServer) PauseTheia(srv InWorkspaceHelper_PauseTheiaServer) error {
	return status.Errorf(codes.Unimplemented, "method PauseTheia not implemented")
}
func (*UnimplementedInWorkspaceHelperServer) GitStatus(ctx context.Context, req *GitStatusRequest) (*GitStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GitStatus not implemented")
}
func (*UnimplementedInWorkspaceHelperServer) UidmapCanary(srv InWorkspaceHelper_UidmapCanaryServer) error {
	return status.Errorf(codes.Unimplemented, "method UidmapCanary not implemented")
}

func RegisterInWorkspaceHelperServer(s *grpc.Server, srv InWorkspaceHelperServer) {
	s.RegisterService(&_InWorkspaceHelper_serviceDesc, srv)
}

func _InWorkspaceHelper_BackupCanary_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(InWorkspaceHelperServer).BackupCanary(&inWorkspaceHelperBackupCanaryServer{stream})
}

type InWorkspaceHelper_BackupCanaryServer interface {
	Send(*BackupCanaryRequest) error
	Recv() (*BackupCanaryResponse, error)
	grpc.ServerStream
}

type inWorkspaceHelperBackupCanaryServer struct {
	grpc.ServerStream
}

func (x *inWorkspaceHelperBackupCanaryServer) Send(m *BackupCanaryRequest) error {
	return x.ServerStream.SendMsg(m)
}

func (x *inWorkspaceHelperBackupCanaryServer) Recv() (*BackupCanaryResponse, error) {
	m := new(BackupCanaryResponse)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func _InWorkspaceHelper_PauseTheia_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(InWorkspaceHelperServer).PauseTheia(&inWorkspaceHelperPauseTheiaServer{stream})
}

type InWorkspaceHelper_PauseTheiaServer interface {
	SendAndClose(*PauseTheiaResponse) error
	Recv() (*PauseTheiaRequest, error)
	grpc.ServerStream
}

type inWorkspaceHelperPauseTheiaServer struct {
	grpc.ServerStream
}

func (x *inWorkspaceHelperPauseTheiaServer) SendAndClose(m *PauseTheiaResponse) error {
	return x.ServerStream.SendMsg(m)
}

func (x *inWorkspaceHelperPauseTheiaServer) Recv() (*PauseTheiaRequest, error) {
	m := new(PauseTheiaRequest)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func _InWorkspaceHelper_GitStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GitStatusRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceHelperServer).GitStatus(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsbs.InWorkspaceHelper/GitStatus",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceHelperServer).GitStatus(ctx, req.(*GitStatusRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _InWorkspaceHelper_UidmapCanary_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(InWorkspaceHelperServer).UidmapCanary(&inWorkspaceHelperUidmapCanaryServer{stream})
}

type InWorkspaceHelper_UidmapCanaryServer interface {
	Send(*UidmapCanaryRequest) error
	Recv() (*UidmapCanaryResponse, error)
	grpc.ServerStream
}

type inWorkspaceHelperUidmapCanaryServer struct {
	grpc.ServerStream
}

func (x *inWorkspaceHelperUidmapCanaryServer) Send(m *UidmapCanaryRequest) error {
	return x.ServerStream.SendMsg(m)
}

func (x *inWorkspaceHelperUidmapCanaryServer) Recv() (*UidmapCanaryResponse, error) {
	m := new(UidmapCanaryResponse)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

var _InWorkspaceHelper_serviceDesc = grpc.ServiceDesc{
	ServiceName: "wsbs.InWorkspaceHelper",
	HandlerType: (*InWorkspaceHelperServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GitStatus",
			Handler:    _InWorkspaceHelper_GitStatus_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "BackupCanary",
			Handler:       _InWorkspaceHelper_BackupCanary_Handler,
			ServerStreams: true,
			ClientStreams: true,
		},
		{
			StreamName:    "PauseTheia",
			Handler:       _InWorkspaceHelper_PauseTheia_Handler,
			ClientStreams: true,
		},
		{
			StreamName:    "UidmapCanary",
			Handler:       _InWorkspaceHelper_UidmapCanary_Handler,
			ServerStreams: true,
			ClientStreams: true,
		},
	},
	Metadata: "workspace.proto",
}
