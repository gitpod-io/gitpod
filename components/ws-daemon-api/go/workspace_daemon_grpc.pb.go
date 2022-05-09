// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.20.0
// source: workspace_daemon.proto

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

// InWorkspaceServiceClient is the client API for InWorkspaceService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
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
	// EvacuateCGroup empties the workspace pod cgroup and produces a new substructure.
	// In combincation with introducing a new cgroup namespace, we can create a situation
	// where the subcontroller are enabled and the ring2-visible cgroup is of type "domain".
	EvacuateCGroup(ctx context.Context, in *EvacuateCGroupRequest, opts ...grpc.CallOption) (*EvacuateCGroupResponse, error)
	// MountProc mounts a masked proc in the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	MountProc(ctx context.Context, in *MountProcRequest, opts ...grpc.CallOption) (*MountProcResponse, error)
	// UmountProc unmounts a masked proc from the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	UmountProc(ctx context.Context, in *UmountProcRequest, opts ...grpc.CallOption) (*UmountProcResponse, error)
	// MountSysfs mounts a masked sysfs in the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	MountSysfs(ctx context.Context, in *MountProcRequest, opts ...grpc.CallOption) (*MountProcResponse, error)
	// UmountSysfs unmounts a masked sysfs from the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	UmountSysfs(ctx context.Context, in *UmountProcRequest, opts ...grpc.CallOption) (*UmountProcResponse, error)
	// Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
	// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
	Teardown(ctx context.Context, in *TeardownRequest, opts ...grpc.CallOption) (*TeardownResponse, error)
	// Set up a pair of veths that interconnect the specified PID and the workspace container's network namespace.
	SetupPairVeths(ctx context.Context, in *SetupPairVethsRequest, opts ...grpc.CallOption) (*SetupPairVethsResponse, error)
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

func (c *inWorkspaceServiceClient) EvacuateCGroup(ctx context.Context, in *EvacuateCGroupRequest, opts ...grpc.CallOption) (*EvacuateCGroupResponse, error) {
	out := new(EvacuateCGroupResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/EvacuateCGroup", in, out, opts...)
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

func (c *inWorkspaceServiceClient) MountSysfs(ctx context.Context, in *MountProcRequest, opts ...grpc.CallOption) (*MountProcResponse, error) {
	out := new(MountProcResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/MountSysfs", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inWorkspaceServiceClient) UmountSysfs(ctx context.Context, in *UmountProcRequest, opts ...grpc.CallOption) (*UmountProcResponse, error) {
	out := new(UmountProcResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/UmountSysfs", in, out, opts...)
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

func (c *inWorkspaceServiceClient) SetupPairVeths(ctx context.Context, in *SetupPairVethsRequest, opts ...grpc.CallOption) (*SetupPairVethsResponse, error) {
	out := new(SetupPairVethsResponse)
	err := c.cc.Invoke(ctx, "/iws.InWorkspaceService/SetupPairVeths", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// InWorkspaceServiceServer is the server API for InWorkspaceService service.
// All implementations must embed UnimplementedInWorkspaceServiceServer
// for forward compatibility
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
	// EvacuateCGroup empties the workspace pod cgroup and produces a new substructure.
	// In combincation with introducing a new cgroup namespace, we can create a situation
	// where the subcontroller are enabled and the ring2-visible cgroup is of type "domain".
	EvacuateCGroup(context.Context, *EvacuateCGroupRequest) (*EvacuateCGroupResponse, error)
	// MountProc mounts a masked proc in the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	MountProc(context.Context, *MountProcRequest) (*MountProcResponse, error)
	// UmountProc unmounts a masked proc from the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	UmountProc(context.Context, *UmountProcRequest) (*UmountProcResponse, error)
	// MountSysfs mounts a masked sysfs in the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	MountSysfs(context.Context, *MountProcRequest) (*MountProcResponse, error)
	// UmountSysfs unmounts a masked sysfs from the container's rootfs.
	// The PID must be in the PID namespace of the workspace container.
	// The path is relative to the mount namespace of the PID.
	UmountSysfs(context.Context, *UmountProcRequest) (*UmountProcResponse, error)
	// Teardown prepares workspace content backups and unmounts shiftfs mounts. The canary is supposed to be triggered
	// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
	Teardown(context.Context, *TeardownRequest) (*TeardownResponse, error)
	// Set up a pair of veths that interconnect the specified PID and the workspace container's network namespace.
	SetupPairVeths(context.Context, *SetupPairVethsRequest) (*SetupPairVethsResponse, error)
	mustEmbedUnimplementedInWorkspaceServiceServer()
}

// UnimplementedInWorkspaceServiceServer must be embedded to have forward compatible implementations.
type UnimplementedInWorkspaceServiceServer struct {
}

func (UnimplementedInWorkspaceServiceServer) PrepareForUserNS(context.Context, *PrepareForUserNSRequest) (*PrepareForUserNSResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method PrepareForUserNS not implemented")
}
func (UnimplementedInWorkspaceServiceServer) WriteIDMapping(context.Context, *WriteIDMappingRequest) (*WriteIDMappingResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method WriteIDMapping not implemented")
}
func (UnimplementedInWorkspaceServiceServer) EvacuateCGroup(context.Context, *EvacuateCGroupRequest) (*EvacuateCGroupResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method EvacuateCGroup not implemented")
}
func (UnimplementedInWorkspaceServiceServer) MountProc(context.Context, *MountProcRequest) (*MountProcResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method MountProc not implemented")
}
func (UnimplementedInWorkspaceServiceServer) UmountProc(context.Context, *UmountProcRequest) (*UmountProcResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UmountProc not implemented")
}
func (UnimplementedInWorkspaceServiceServer) MountSysfs(context.Context, *MountProcRequest) (*MountProcResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method MountSysfs not implemented")
}
func (UnimplementedInWorkspaceServiceServer) UmountSysfs(context.Context, *UmountProcRequest) (*UmountProcResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UmountSysfs not implemented")
}
func (UnimplementedInWorkspaceServiceServer) Teardown(context.Context, *TeardownRequest) (*TeardownResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Teardown not implemented")
}
func (UnimplementedInWorkspaceServiceServer) SetupPairVeths(context.Context, *SetupPairVethsRequest) (*SetupPairVethsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetupPairVeths not implemented")
}
func (UnimplementedInWorkspaceServiceServer) mustEmbedUnimplementedInWorkspaceServiceServer() {}

// UnsafeInWorkspaceServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to InWorkspaceServiceServer will
// result in compilation errors.
type UnsafeInWorkspaceServiceServer interface {
	mustEmbedUnimplementedInWorkspaceServiceServer()
}

func RegisterInWorkspaceServiceServer(s grpc.ServiceRegistrar, srv InWorkspaceServiceServer) {
	s.RegisterService(&InWorkspaceService_ServiceDesc, srv)
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

func _InWorkspaceService_EvacuateCGroup_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(EvacuateCGroupRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).EvacuateCGroup(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/EvacuateCGroup",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).EvacuateCGroup(ctx, req.(*EvacuateCGroupRequest))
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

func _InWorkspaceService_MountSysfs_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(MountProcRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).MountSysfs(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/MountSysfs",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).MountSysfs(ctx, req.(*MountProcRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _InWorkspaceService_UmountSysfs_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UmountProcRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).UmountSysfs(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/UmountSysfs",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).UmountSysfs(ctx, req.(*UmountProcRequest))
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

func _InWorkspaceService_SetupPairVeths_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SetupPairVethsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InWorkspaceServiceServer).SetupPairVeths(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/iws.InWorkspaceService/SetupPairVeths",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InWorkspaceServiceServer).SetupPairVeths(ctx, req.(*SetupPairVethsRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// InWorkspaceService_ServiceDesc is the grpc.ServiceDesc for InWorkspaceService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var InWorkspaceService_ServiceDesc = grpc.ServiceDesc{
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
			MethodName: "EvacuateCGroup",
			Handler:    _InWorkspaceService_EvacuateCGroup_Handler,
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
			MethodName: "MountSysfs",
			Handler:    _InWorkspaceService_MountSysfs_Handler,
		},
		{
			MethodName: "UmountSysfs",
			Handler:    _InWorkspaceService_UmountSysfs_Handler,
		},
		{
			MethodName: "Teardown",
			Handler:    _InWorkspaceService_Teardown_Handler,
		},
		{
			MethodName: "SetupPairVeths",
			Handler:    _InWorkspaceService_SetupPairVeths_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "workspace_daemon.proto",
}
