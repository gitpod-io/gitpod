// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// WorkspaceContentServiceClient is the client API for WorkspaceContentService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type WorkspaceContentServiceClient interface {
	// initWorkspace intialises a new workspace folder in the working area
	InitWorkspace(ctx context.Context, in *InitWorkspaceRequest, opts ...grpc.CallOption) (*InitWorkspaceResponse, error)
	// WaitForInit waits until a workspace is fully initialized.
	// If the workspace is already initialized, this function returns immediately.
	// If there is no initialization is going on, an error is returned.
	WaitForInit(ctx context.Context, in *WaitForInitRequest, opts ...grpc.CallOption) (*WaitForInitResponse, error)
	// TakeSnapshot creates a backup/snapshot of a workspace
	TakeSnapshot(ctx context.Context, in *TakeSnapshotRequest, opts ...grpc.CallOption) (*TakeSnapshotResponse, error)
	// disposeWorkspace cleans up a workspace, possibly after taking a final backup
	DisposeWorkspace(ctx context.Context, in *DisposeWorkspaceRequest, opts ...grpc.CallOption) (*DisposeWorkspaceResponse, error)
}

type workspaceContentServiceClient struct {
	cc grpc.ClientConnInterface `json:"cc,omitempty"`
}

func NewWorkspaceContentServiceClient(cc grpc.ClientConnInterface) WorkspaceContentServiceClient {
	return &workspaceContentServiceClient{cc}
}

func (c *workspaceContentServiceClient) InitWorkspace(ctx context.Context, in *InitWorkspaceRequest, opts ...grpc.CallOption) (*InitWorkspaceResponse, error) {
	out := new(InitWorkspaceResponse)
	err := c.cc.Invoke(ctx, "/wsdaemon.WorkspaceContentService/InitWorkspace", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceContentServiceClient) WaitForInit(ctx context.Context, in *WaitForInitRequest, opts ...grpc.CallOption) (*WaitForInitResponse, error) {
	out := new(WaitForInitResponse)
	err := c.cc.Invoke(ctx, "/wsdaemon.WorkspaceContentService/WaitForInit", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceContentServiceClient) TakeSnapshot(ctx context.Context, in *TakeSnapshotRequest, opts ...grpc.CallOption) (*TakeSnapshotResponse, error) {
	out := new(TakeSnapshotResponse)
	err := c.cc.Invoke(ctx, "/wsdaemon.WorkspaceContentService/TakeSnapshot", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *workspaceContentServiceClient) DisposeWorkspace(ctx context.Context, in *DisposeWorkspaceRequest, opts ...grpc.CallOption) (*DisposeWorkspaceResponse, error) {
	out := new(DisposeWorkspaceResponse)
	err := c.cc.Invoke(ctx, "/wsdaemon.WorkspaceContentService/DisposeWorkspace", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// WorkspaceContentServiceServer is the server API for WorkspaceContentService service.
type WorkspaceContentServiceServer interface {
	// initWorkspace intialises a new workspace folder in the working area
	InitWorkspace(context.Context, *InitWorkspaceRequest) (*InitWorkspaceResponse, error)
	// WaitForInit waits until a workspace is fully initialized.
	// If the workspace is already initialized, this function returns immediately.
	// If there is no initialization is going on, an error is returned.
	WaitForInit(context.Context, *WaitForInitRequest) (*WaitForInitResponse, error)
	// TakeSnapshot creates a backup/snapshot of a workspace
	TakeSnapshot(context.Context, *TakeSnapshotRequest) (*TakeSnapshotResponse, error)
	// disposeWorkspace cleans up a workspace, possibly after taking a final backup
	DisposeWorkspace(context.Context, *DisposeWorkspaceRequest) (*DisposeWorkspaceResponse, error)
}

// UnimplementedWorkspaceContentServiceServer can be embedded to have forward compatible implementations.
type UnimplementedWorkspaceContentServiceServer struct {
}

func (*UnimplementedWorkspaceContentServiceServer) InitWorkspace(ctx context.Context, req *InitWorkspaceRequest) (*InitWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method InitWorkspace not implemented")
}
func (*UnimplementedWorkspaceContentServiceServer) WaitForInit(ctx context.Context, req *WaitForInitRequest) (*WaitForInitResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method WaitForInit not implemented")
}
func (*UnimplementedWorkspaceContentServiceServer) TakeSnapshot(ctx context.Context, req *TakeSnapshotRequest) (*TakeSnapshotResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method TakeSnapshot not implemented")
}
func (*UnimplementedWorkspaceContentServiceServer) DisposeWorkspace(ctx context.Context, req *DisposeWorkspaceRequest) (*DisposeWorkspaceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DisposeWorkspace not implemented")
}

func RegisterWorkspaceContentServiceServer(s *grpc.Server, srv WorkspaceContentServiceServer) {
	s.RegisterService(&_WorkspaceContentService_serviceDesc, srv)
}

func _WorkspaceContentService_InitWorkspace_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(InitWorkspaceRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceContentServiceServer).InitWorkspace(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsdaemon.WorkspaceContentService/InitWorkspace",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceContentServiceServer).InitWorkspace(ctx, req.(*InitWorkspaceRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceContentService_WaitForInit_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(WaitForInitRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceContentServiceServer).WaitForInit(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsdaemon.WorkspaceContentService/WaitForInit",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceContentServiceServer).WaitForInit(ctx, req.(*WaitForInitRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceContentService_TakeSnapshot_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(TakeSnapshotRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceContentServiceServer).TakeSnapshot(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsdaemon.WorkspaceContentService/TakeSnapshot",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceContentServiceServer).TakeSnapshot(ctx, req.(*TakeSnapshotRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _WorkspaceContentService_DisposeWorkspace_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(DisposeWorkspaceRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkspaceContentServiceServer).DisposeWorkspace(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/wsdaemon.WorkspaceContentService/DisposeWorkspace",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(WorkspaceContentServiceServer).DisposeWorkspace(ctx, req.(*DisposeWorkspaceRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _WorkspaceContentService_serviceDesc = grpc.ServiceDesc{
	ServiceName: "wsdaemon.WorkspaceContentService",
	HandlerType: (*WorkspaceContentServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "InitWorkspace",
			Handler:    _WorkspaceContentService_InitWorkspace_Handler,
		},
		{
			MethodName: "WaitForInit",
			Handler:    _WorkspaceContentService_WaitForInit_Handler,
		},
		{
			MethodName: "TakeSnapshot",
			Handler:    _WorkspaceContentService_TakeSnapshot_Handler,
		},
		{
			MethodName: "DisposeWorkspace",
			Handler:    _WorkspaceContentService_DisposeWorkspace_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "daemon.proto",
}
