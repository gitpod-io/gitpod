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

// Reference imports to suppress errors if they are not otherwise used.
var _ context.Context
var _ grpc.ClientConnInterface

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
const _ = grpc.SupportPackageIsVersion7

// InWorkspaceServiceClient is the client API for InWorkspaceService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type InWorkspaceServiceClient interface {
	// PrepareForUserNS prepares a workspace container for wrapping it in a user namespace.
	// A container that called this function MUST call Teardown.
	//
	// This call will make the workspace container's rootfs shared, and mount the workspace
	// container's rootfs as a shiftfs mark under `/.workspace/mark` if the workspace has
	// the daemon hostPath mount. Can only be used once per workspace.
	PrepareForUserNS(ctx context.Context, in *PrepareForUserNSRequest, opts ...grpc.CallOption) (*PrepareForUserNSResponse, error)
	// WriteIDMapping writes a new user/group ID mapping to /proc/<pid>/uid_map (gid_map respectively). This is used
	// for user namespaces and is available four times every 10 seconds.
	WriteIDMapping(ctx context.Context, in *WriteIDMappingRequest, opts ...grpc.CallOption) (*WriteIDMappingResponse, error)
	// MountProc mounts a masked proc in the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	MountProc(ctx context.Context, in *MountProcRequest, opts ...grpc.CallOption) (*MountProcResponse, error)
	// UmountProc unmounts a masked proc from the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	UmountProc(ctx context.Context, in *UmountProcRequest, opts ...grpc.CallOption) (*UmountProcResponse, error)
	// Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
	// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
	Teardown(ctx context.Context, in *TeardownRequest, opts ...grpc.CallOption) (*TeardownResponse, error)
}

type inWorkspaceServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewInWorkspaceServiceClient(cc grpc.ClientConnInterface) InWorkspaceServiceClient {
	return &inWorkspaceServiceClient{cc}
}

func (c *inWorkspaceServiceClient) PrepareForUserNS(ctx context.Context, in *PrepareForUserNSRequest, opts ...grpc.CallOption) (*PrepareForUserNSResponse, error) {
	out := new(PrepareForUserNSResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/PrepareForUserNS", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inWorkspaceServiceClient) WriteIDMapping(ctx context.Context, in *WriteIDMappingRequest, opts ...grpc.CallOption) (*WriteIDMappingResponse, error) {
	out := new(WriteIDMappingResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/WriteIDMapping", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inWorkspaceServiceClient) MountProc(ctx context.Context, in *MountProcRequest, opts ...grpc.CallOption) (*MountProcResponse, error) {
	out := new(MountProcResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/MountProc", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inWorkspaceServiceClient) UmountProc(ctx context.Context, in *UmountProcRequest, opts ...grpc.CallOption) (*UmountProcResponse, error) {
	out := new(UmountProcResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/UmountProc", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inWorkspaceServiceClient) Teardown(ctx context.Context, in *TeardownRequest, opts ...grpc.CallOption) (*TeardownResponse, error) {
	out := new(TeardownResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/Teardown", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// InWorkspaceServiceServer is the server API for InWorkspaceService service.
type InWorkspaceServiceServer interface {
	// PrepareForUserNS prepares a workspace container for wrapping it in a user namespace.
	// A container that called this function MUST call Teardown.
	//
	// This call will make the workspace container's rootfs shared, and mount the workspace
	// container's rootfs as a shiftfs mark under `/.workspace/mark` if the workspace has
	// the daemon hostPath mount. Can only be used once per workspace.
	PrepareForUserNS(context.Context, *PrepareForUserNSRequest) (*PrepareForUserNSResponse, error)
	// WriteIDMapping writes a new user/group ID mapping to /proc/<pid>/uid_map (gid_map respectively). This is used
	// for user namespaces and is available four times every 10 seconds.
	WriteIDMapping(context.Context, *WriteIDMappingRequest) (*WriteIDMappingResponse, error)
	// MountProc mounts a masked proc in the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	MountProc(context.Context, *MountProcRequest) (*MountProcResponse, error)
	// UmountProc unmounts a masked proc from the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	UmountProc(context.Context, *UmountProcRequest) (*UmountProcResponse, error)
	// Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
	// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
	Teardown(context.Context, *TeardownRequest) (*TeardownResponse, error)
}

// UnimplementedInWorkspaceServiceServer can be embedded to have forward compatible implementations.
type UnimplementedInWorkspaceServiceServer struct {
}

func (*UnimplementedInWorkspaceServiceServer) PrepareForUserNS(ctx context.Context, req *PrepareForUserNSRequest) (*PrepareForUserNSResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method PrepareForUserNS not implemented")
}
func (*UnimplementedInWorkspaceServiceServer) WriteIDMapping(ctx context.Context, req *WriteIDMappingRequest) (*WriteIDMappingResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method WriteIDMapping not implemented")
}
func (*UnimplementedInWorkspaceServiceServer) MountProc(ctx context.Context, req *MountProcRequest) (*MountProcResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method MountProc not implemented")
}
func (*UnimplementedInWorkspaceServiceServer) UmountProc(ctx context.Context, req *UmountProcRequest) (*UmountProcResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UmountProc not implemented")
}
func (*UnimplementedInWorkspaceServiceServer) Teardown(ctx context.Context, req *TeardownRequest) (*TeardownResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Teardown not implemented")
}

func RegisterInWorkspaceServiceServer(s *grpc.Server, srv InWorkspaceServiceServer) {
	s.RegisterService(&_InWorkspaceService_serviceDesc, srv)
}

func _InWorkspaceService_PrepareForUserNS_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(PrepareForUserNSRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).PrepareForUserNS(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/PrepareForUserNS",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).PrepareForUserNS(ctx, req.(*PrepareForUserNSRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _InWorkspaceService_WriteIDMapping_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(WriteIDMappingRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).WriteIDMapping(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/WriteIDMapping",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).WriteIDMapping(ctx, req.(*WriteIDMappingRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _InWorkspaceService_MountProc_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(MountProcRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).MountProc(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/MountProc",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).MountProc(ctx, req.(*MountProcRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _InWorkspaceService_UmountProc_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UmountProcRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).UmountProc(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/UmountProc",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).UmountProc(ctx, req.(*UmountProcRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _InWorkspaceService_Teardown_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(TeardownRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).Teardown(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/Teardown",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).Teardown(ctx, req.(*TeardownRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _InWorkspaceService_serviceDesc = grpc.ServiceDesc{
	ServiceName: "iws.InWorkspaceService",
	HandlerType: (*InWorkspaceServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "PrepareForUserNS",
			Handler:    _InWorkspaceService_PrepareForUserNS_Handler,
		},
		{
			MethodName: "WriteIDMapping",
			Handler:    _InWorkspaceService_WriteIDMapping_Handler,
		},
		{
			MethodName: "MountProc",
			Handler:    _InWorkspaceService_MountProc_Handler,
		},
		{
			MethodName: "UmountProc",
			Handler:    _InWorkspaceService_UmountProc_Handler,
		},
		{
			MethodName: "Teardown",
			Handler:    _InWorkspaceService_Teardown_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "workspace.proto",
}
