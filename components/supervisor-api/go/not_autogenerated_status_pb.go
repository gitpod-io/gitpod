// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	context "context"

	_ "google.golang.org/genproto/googleapis/api/annotations"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

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
	// TasksStatus provides tasks status information.
	TasksStatus(ctx context.Context, in *TasksStatusRequest, opts ...grpc.CallOption) (StatusService_TasksStatusClient, error)
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

func (c *statusServiceClient) TasksStatus(ctx context.Context, in *TasksStatusRequest, opts ...grpc.CallOption) (StatusService_TasksStatusClient, error) {
	stream, err := c.cc.NewStream(ctx, &_StatusService_serviceDesc.Streams[1], "/supervisor.StatusService/TasksStatus", opts...)
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
	// TasksStatus provides tasks status information.
	TasksStatus(*TasksStatusRequest, StatusService_TasksStatusServer) error
}

// UnimplementedStatusServiceServer can be embedded to have forward compatible implementations.
type UnimplementedStatusServiceServer struct {
}

func (*UnimplementedStatusServiceServer) SupervisorStatus(context.Context, *SupervisorStatusRequest) (*SupervisorStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SupervisorStatus not implemented")
}
func (*UnimplementedStatusServiceServer) IDEStatus(context.Context, *IDEStatusRequest) (*IDEStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method IDEStatus not implemented")
}
func (*UnimplementedStatusServiceServer) ContentStatus(context.Context, *ContentStatusRequest) (*ContentStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ContentStatus not implemented")
}
func (*UnimplementedStatusServiceServer) BackupStatus(context.Context, *BackupStatusRequest) (*BackupStatusResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method BackupStatus not implemented")
}
func (*UnimplementedStatusServiceServer) PortsStatus(*PortsStatusRequest, StatusService_PortsStatusServer) error {
	return status.Errorf(codes.Unimplemented, "method PortsStatus not implemented")
}
func (*UnimplementedStatusServiceServer) TasksStatus(*TasksStatusRequest, StatusService_TasksStatusServer) error {
	return status.Errorf(codes.Unimplemented, "method TasksStatus not implemented")
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
		{
			StreamName:    "TasksStatus",
			Handler:       _StatusService_TasksStatus_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "status.proto",
}
