// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.20.1
// source: status.proto

package api

import (
	context "context"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
// Requires gRPC-Go v1.32.0 or later.
const _ = grpc.SupportPackageIsVersion7

// StatusServiceClient is the client API for StatusService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
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
	// TasksStatus provides tasks status information.
	TasksStatus(ctx context.Context, in *TasksStatusRequest, opts ...grpc.CallOption) (StatusService_TasksStatusClient, error)
	// ResourcesStatus provides workspace resources status information.
	ResourcesStatus(ctx context.Context, in *ResourcesStatusRequest, opts ...grpc.CallOption) (*ResourcesStatusResponse, error)
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
	stream, err := c.cc.NewStream(ctx, &StatusService_ServiceDesc.Streams[0], "/supervisor.StatusService/PortsStatus", opts...)
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

func (c *statusServiceClient) TasksStatus(ctx context.Context, in *TasksStatusRequest, opts ...grpc.CallOption) (StatusService_TasksStatusClient, error) {
	stream, err := c.cc.NewStream(ctx, &StatusService_ServiceDesc.Streams[1], "/supervisor.StatusService/TasksStatus", opts...)
	if err != nil {
		return nil, err
	}
	x := &statusServiceTasksStatusClient{stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	return x, nil
}

type StatusService_TasksStatusClient interface {
	Recv() (*TasksStatusResponse, error)
	grpc.ClientStream
}

type statusServiceTasksStatusClient struct {
	grpc.ClientStream
}

func (x *statusServiceTasksStatusClient) Recv() (*TasksStatusResponse, error) {
	m := new(TasksStatusResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *statusServiceClient) ResourcesStatus(ctx context.Context, in *ResourcesStatusRequest, opts ...grpc.CallOption) (*ResourcesStatusResponse, error) {
	out := new(ResourcesStatusResponse)
	err := c.cc.Invoke(ctx, "/supervisor.StatusService/ResourcesStatus", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// StatusServiceServer is the server API for StatusService service.
// All implementations must embed UnimplementedStatusServiceServer
// for forward compatibility
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
	// TasksStatus provides tasks status information.
	TasksStatus(*TasksStatusRequest, StatusService_TasksStatusServer) error
	// ResourcesStatus provides workspace resources status information.
	ResourcesStatus(context.Context, *ResourcesStatusRequest) (*ResourcesStatusResponse, error)
	mustEmbedUnimplementedStatusServiceServer()
}

// UnimplementedStatusServiceServer must be embedded to have forward compatible implementations.
type UnimplementedStatusServiceServer struct {
}

func (UnimplementedStatusServiceServer) SupervisorStatus(context.Context, *SupervisorStatusRequest) (*SupervisorStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SupervisorStatus not implemented")
}
func (UnimplementedStatusServiceServer) IDEStatus(context.Context, *IDEStatusRequest) (*IDEStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method IDEStatus not implemented")
}
func (UnimplementedStatusServiceServer) ContentStatus(context.Context, *ContentStatusRequest) (*ContentStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ContentStatus not implemented")
}
func (UnimplementedStatusServiceServer) BackupStatus(context.Context, *BackupStatusRequest) (*BackupStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method BackupStatus not implemented")
}
func (UnimplementedStatusServiceServer) PortsStatus(*PortsStatusRequest, StatusService_PortsStatusServer) error {
	return status.Errorf(codes.Unimplemented, "method PortsStatus not implemented")
}
func (UnimplementedStatusServiceServer) TasksStatus(*TasksStatusRequest, StatusService_TasksStatusServer) error {
	return status.Errorf(codes.Unimplemented, "method TasksStatus not implemented")
}
func (UnimplementedStatusServiceServer) ResourcesStatus(context.Context, *ResourcesStatusRequest) (*ResourcesStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ResourcesStatus not implemented")
}
func (UnimplementedStatusServiceServer) mustEmbedUnimplementedStatusServiceServer() {}

// UnsafeStatusServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to StatusServiceServer will
// result in compilation errors.
type UnsafeStatusServiceServer interface {
	mustEmbedUnimplementedStatusServiceServer()
}

func RegisterStatusServiceServer(s grpc.ServiceRegistrar, srv StatusServiceServer) {
	s.RegisterService(&StatusService_ServiceDesc, srv)
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

func _StatusService_TasksStatus_Handler(srv interface{}, stream grpc.ServerStream) error {
	m := new(TasksStatusRequest)
	if err := stream.RecvMsg(m); err != nil {
		return err
	}
	return srv.(StatusServiceServer).TasksStatus(m, &statusServiceTasksStatusServer{stream})
}

type StatusService_TasksStatusServer interface {
	Send(*TasksStatusResponse) error
	grpc.ServerStream
}

type statusServiceTasksStatusServer struct {
	grpc.ServerStream
}

func (x *statusServiceTasksStatusServer) Send(m *TasksStatusResponse) error {
	return x.ServerStream.SendMsg(m)
}

func _StatusService_ResourcesStatus_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ResourcesStatusRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(StatusServiceServer).ResourcesStatus(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.StatusService/ResourcesStatus",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(StatusServiceServer).ResourcesStatus(ctx, req.(*ResourcesStatusRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// StatusService_ServiceDesc is the grpc.ServiceDesc for StatusService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var StatusService_ServiceDesc = grpc.ServiceDesc{
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
		{
			MethodName: "ResourcesStatus",
			Handler:    _StatusService_ResourcesStatus_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "PortsStatus",
			Handler:       _StatusService_PortsStatus_Handler,
			ServerStreams: true,
		},
		{
			StreamName:    "TasksStatus",
			Handler:       _StatusService_TasksStatus_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "status.proto",
}
