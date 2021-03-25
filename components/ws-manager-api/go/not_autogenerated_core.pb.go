// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	context "context"

	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

// Reference imports to suppress errors if they are not otherwise used.
var _ context.Context
var _ grpc.ClientConnInterface

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
const _ = grpc.SupportPackageIsVersion6

// WorkspaceManagerClient is the client API for WorkspaceManager service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type WorkspaceManagerClient interface {
	// getWorkspaces produces a list of running workspaces and their status
	GetWorkspaces(ctx context.Context, in *GetWorkspacesRequest, opts ...grpc.CallOption) (*GetWorkspacesResponse, error)
	// startWorkspace creates a new running workspace within the manager's cluster
	StartWorkspace(ctx context.Context, in *StartWorkspaceRequest, opts ...grpc.CallOption) (*StartWorkspaceResponse, error)
	// stopWorkspace stops a running workspace
	StopWorkspace(ctx context.Context, in *StopWorkspaceRequest, opts ...grpc.CallOption) (*StopWorkspaceResponse, error)
	// describeWorkspace investigates a workspace and returns its status, and configuration
	DescribeWorkspace(ctx context.Context, in *DescribeWorkspaceRequest, opts ...grpc.CallOption) (*DescribeWorkspaceResponse, error)
	// subscribe streams all status updates to a client
	Subscribe(ctx context.Context, in *SubscribeRequest, opts ...grpc.CallOption) (WorkspaceManager_SubscribeClient, error)
	// markActive records a workspace as being active which prevents it from timing out
	MarkActive(ctx context.Context, in *MarkActiveRequest, opts ...grpc.CallOption) (*MarkActiveResponse, error)
	// setTimeout changes the default timeout for a running workspace
	SetTimeout(ctx context.Context, in *SetTimeoutRequest, opts ...grpc.CallOption) (*SetTimeoutResponse, error)
	// controlPort publicly exposes or un-exposes a network port for a workspace
	ControlPort(ctx context.Context, in *ControlPortRequest, opts ...grpc.CallOption) (*ControlPortResponse, error)
	// takeSnapshot creates a copy of the workspace content which can initialize a new workspace.
	TakeSnapshot(ctx context.Context, in *TakeSnapshotRequest, opts ...grpc.CallOption) (*TakeSnapshotResponse, error)
	// controlAdmission makes a workspace accessible for everyone or for the owner only
	ControlAdmission(ctx context.Context, in *ControlAdmissionRequest, opts ...grpc.CallOption) (*ControlAdmissionResponse, error)
}

type workspaceManagerClient struct {
	cc grpc.ClientConnInterface
}

func NewWorkspaceManagerClient(cc grpc.ClientConnInterface) WorkspaceManagerClient {
	return &workspaceManagerClient{cc}
}

func (c *workspaceManagerClient) GetWorkspaces(ctx context.Context, in *GetWorkspacesRequest, opts ...grpc.CallOption) (*GetWorkspacesResponse, error) {
	out := new(GetWorkspacesResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/GetWorkspaces", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) StartWorkspace(ctx context.Context, in *StartWorkspaceRequest, opts ...grpc.CallOption) (*StartWorkspaceResponse, error) {
	out := new(StartWorkspaceResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/StartWorkspace", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) StopWorkspace(ctx context.Context, in *StopWorkspaceRequest, opts ...grpc.CallOption) (*StopWorkspaceResponse, error) {
	out := new(StopWorkspaceResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/StopWorkspace", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) DescribeWorkspace(ctx context.Context, in *DescribeWorkspaceRequest, opts ...grpc.CallOption) (*DescribeWorkspaceResponse, error) {
	out := new(DescribeWorkspaceResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/DescribeWorkspace", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) Subscribe(ctx context.Context, in *SubscribeRequest, opts ...grpc.CallOption) (WorkspaceManager_SubscribeClient, error) {
	stream, err := c.cc.NewStream(ctx, &_WorkspaceManager_serviceDesc.Streams[0], "/wsman.WorkspaceManager/Subscribe", opts...)
	if err != nil {
		return nil, err
	}
	x := &workspaceManagerSubscribeClient{stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	return x, nil
}

type WorkspaceManager_SubscribeClient interface {
	Recv() (*SubscribeResponse, error)
	grpc.ClientStream
}

type workspaceManagerSubscribeClient struct {
	grpc.ClientStream
}

func (x *workspaceManagerSubscribeClient) Recv() (*SubscribeResponse, error) {
	m := new(SubscribeResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *workspaceManagerClient) MarkActive(ctx context.Context, in *MarkActiveRequest, opts ...grpc.CallOption) (*MarkActiveResponse, error) {
	out := new(MarkActiveResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/MarkActive", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) SetTimeout(ctx context.Context, in *SetTimeoutRequest, opts ...grpc.CallOption) (*SetTimeoutResponse, error) {
	out := new(SetTimeoutResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/SetTimeout", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) ControlPort(ctx context.Context, in *ControlPortRequest, opts ...grpc.CallOption) (*ControlPortResponse, error) {
	out := new(ControlPortResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/ControlPort", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) TakeSnapshot(ctx context.Context, in *TakeSnapshotRequest, opts ...grpc.CallOption) (*TakeSnapshotResponse, error) {
	out := new(TakeSnapshotResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/TakeSnapshot", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceManagerClient) ControlAdmission(ctx context.Context, in *ControlAdmissionRequest, opts ...grpc.CallOption) (*ControlAdmissionResponse, error) {
	out := new(ControlAdmissionResponse)
	err := c.cc.Invoke(ctx, "/wsman.WorkspaceManager/ControlAdmission", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// WorkspaceManagerServer is the server API for WorkspaceManager service.
type WorkspaceManagerServer interface {
	// getWorkspaces produces a list of running workspaces and their status
	GetWorkspaces(context.Context, *GetWorkspacesRequest) (*GetWorkspacesResponse, error)
	// startWorkspace creates a new running workspace within the manager's cluster
	StartWorkspace(context.Context, *StartWorkspaceRequest) (*StartWorkspaceResponse, error)
	// stopWorkspace stops a running workspace
	StopWorkspace(context.Context, *StopWorkspaceRequest) (*StopWorkspaceResponse, error)
	// describeWorkspace investigates a workspace and returns its status, and configuration
	DescribeWorkspace(context.Context, *DescribeWorkspaceRequest) (*DescribeWorkspaceResponse, error)
	// subscribe streams all status updates to a client
	Subscribe(*SubscribeRequest, WorkspaceManager_SubscribeServer) error
	// markActive records a workspace as being active which prevents it from timing out
	MarkActive(context.Context, *MarkActiveRequest) (*MarkActiveResponse, error)
	// setTimeout changes the default timeout for a running workspace
	SetTimeout(context.Context, *SetTimeoutRequest) (*SetTimeoutResponse, error)
	// controlPort publicly exposes or un-exposes a network port for a workspace
	ControlPort(context.Context, *ControlPortRequest) (*ControlPortResponse, error)
	// takeSnapshot creates a copy of the workspace content which can initialize a new workspace.
	TakeSnapshot(context.Context, *TakeSnapshotRequest) (*TakeSnapshotResponse, error)
	// controlAdmission makes a workspace accessible for everyone or for the owner only
	ControlAdmission(context.Context, *ControlAdmissionRequest) (*ControlAdmissionResponse, error)
}

// UnimplementedWorkspaceManagerServer can be embedded to have forward compatible implementations.
type UnimplementedWorkspaceManagerServer struct {
}

func (*UnimplementedWorkspaceManagerServer) GetWorkspaces(ctx context.Context, req *GetWorkspacesRequest) (*GetWorkspacesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetWorkspaces not implemented")
}
func (*UnimplementedWorkspaceManagerServer) StartWorkspace(ctx context.Context, req *StartWorkspaceRequest) (*StartWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method StartWorkspace not implemented")
}
func (*UnimplementedWorkspaceManagerServer) StopWorkspace(ctx context.Context, req *StopWorkspaceRequest) (*StopWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method StopWorkspace not implemented")
}
func (*UnimplementedWorkspaceManagerServer) DescribeWorkspace(ctx context.Context, req *DescribeWorkspaceRequest) (*DescribeWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DescribeWorkspace not implemented")
}
func (*UnimplementedWorkspaceManagerServer) Subscribe(req *SubscribeRequest, srv WorkspaceManager_SubscribeServer) error {
	return status.Errorf(codes.Unimplemented, "method Subscribe not implemented")
}
func (*UnimplementedWorkspaceManagerServer) MarkActive(ctx context.Context, req *MarkActiveRequest) (*MarkActiveResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method MarkActive not implemented")
}
func (*UnimplementedWorkspaceManagerServer) SetTimeout(ctx context.Context, req *SetTimeoutRequest) (*SetTimeoutResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetTimeout not implemented")
}
func (*UnimplementedWorkspaceManagerServer) ControlPort(ctx context.Context, req *ControlPortRequest) (*ControlPortResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ControlPort not implemented")
}
func (*UnimplementedWorkspaceManagerServer) TakeSnapshot(ctx context.Context, req *TakeSnapshotRequest) (*TakeSnapshotResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method TakeSnapshot not implemented")
}
func (*UnimplementedWorkspaceManagerServer) ControlAdmission(ctx context.Context, req *ControlAdmissionRequest) (*ControlAdmissionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ControlAdmission not implemented")
}

func RegisterWorkspaceManagerServer(s *grpc.Server, srv WorkspaceManagerServer) {
	s.RegisterService(&_WorkspaceManager_serviceDesc, srv)
}

func _WorkspaceManager_GetWorkspaces_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetWorkspacesRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).GetWorkspaces(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/GetWorkspaces",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).GetWorkspaces(ctx, req.(*GetWorkspacesRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_StartWorkspace_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(StartWorkspaceRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).StartWorkspace(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/StartWorkspace",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).StartWorkspace(ctx, req.(*StartWorkspaceRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_StopWorkspace_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(StopWorkspaceRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).StopWorkspace(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/StopWorkspace",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).StopWorkspace(ctx, req.(*StopWorkspaceRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_DescribeWorkspace_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(DescribeWorkspaceRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).DescribeWorkspace(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/DescribeWorkspace",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).DescribeWorkspace(ctx, req.(*DescribeWorkspaceRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_Subscribe_Handler(srv interface{}, stream grpc.ServerStream) error {
	m := new(SubscribeRequest)
	if err := stream.RecvMsg(m); err != nil {
		return err
	}
	return srv.(WorkspaceManagerServer).Subscribe(m, &workspaceManagerSubscribeServer{stream})
}

type WorkspaceManager_SubscribeServer interface {
	Send(*SubscribeResponse) error
	grpc.ServerStream
}

type workspaceManagerSubscribeServer struct {
	grpc.ServerStream
}

func (x *workspaceManagerSubscribeServer) Send(m *SubscribeResponse) error {
	return x.ServerStream.SendMsg(m)
}

func _WorkspaceManager_MarkActive_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(MarkActiveRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).MarkActive(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/MarkActive",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).MarkActive(ctx, req.(*MarkActiveRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_SetTimeout_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SetTimeoutRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).SetTimeout(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/SetTimeout",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).SetTimeout(ctx, req.(*SetTimeoutRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_ControlPort_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ControlPortRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).ControlPort(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/ControlPort",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).ControlPort(ctx, req.(*ControlPortRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_TakeSnapshot_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(TakeSnapshotRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).TakeSnapshot(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/TakeSnapshot",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).TakeSnapshot(ctx, req.(*TakeSnapshotRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceManager_ControlAdmission_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ControlAdmissionRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceManagerServer).ControlAdmission(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsman.WorkspaceManager/ControlAdmission",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceManagerServer).ControlAdmission(ctx, req.(*ControlAdmissionRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _WorkspaceManager_serviceDesc = grpc.ServiceDesc{
	ServiceName: "wsman.WorkspaceManager",
	HandlerType: (*WorkspaceManagerServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetWorkspaces",
			Handler:    _WorkspaceManager_GetWorkspaces_Handler,
		},
		{
			MethodName: "StartWorkspace",
			Handler:    _WorkspaceManager_StartWorkspace_Handler,
		},
		{
			MethodName: "StopWorkspace",
			Handler:    _WorkspaceManager_StopWorkspace_Handler,
		},
		{
			MethodName: "DescribeWorkspace",
			Handler:    _WorkspaceManager_DescribeWorkspace_Handler,
		},
		{
			MethodName: "MarkActive",
			Handler:    _WorkspaceManager_MarkActive_Handler,
		},
		{
			MethodName: "SetTimeout",
			Handler:    _WorkspaceManager_SetTimeout_Handler,
		},
		{
			MethodName: "ControlPort",
			Handler:    _WorkspaceManager_ControlPort_Handler,
		},
		{
			MethodName: "TakeSnapshot",
			Handler:    _WorkspaceManager_TakeSnapshot_Handler,
		},
		{
			MethodName: "ControlAdmission",
			Handler:    _WorkspaceManager_ControlAdmission_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "Subscribe",
			Handler:       _WorkspaceManager_Subscribe_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "core.proto",
}
