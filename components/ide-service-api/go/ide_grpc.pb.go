// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.20.1
// source: ide.proto

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

// IDEServiceClient is the client API for IDEService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type IDEServiceClient interface {
	GetConfig(ctx context.Context, in *GetConfigRequest, opts ...grpc.CallOption) (*GetConfigResponse, error)
	ResolveWorkspaceConfig(ctx context.Context, in *ResolveWorkspaceConfigRequest, opts ...grpc.CallOption) (*ResolveWorkspaceConfigResponse, error)
}

type iDEServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewIDEServiceClient(cc grpc.ClientConnInterface) IDEServiceClient {
	return &iDEServiceClient{cc}
}

func (c *iDEServiceClient) GetConfig(ctx context.Context, in *GetConfigRequest, opts ...grpc.CallOption) (*GetConfigResponse, error) {
	out := new(GetConfigResponse)
	err := c.cc.Invoke(ctx, "/ide_service_api.IDEService/GetConfig", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *iDEServiceClient) ResolveWorkspaceConfig(ctx context.Context, in *ResolveWorkspaceConfigRequest, opts ...grpc.CallOption) (*ResolveWorkspaceConfigResponse, error) {
	out := new(ResolveWorkspaceConfigResponse)
	err := c.cc.Invoke(ctx, "/ide_service_api.IDEService/ResolveWorkspaceConfig", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// IDEServiceServer is the server API for IDEService service.
// All implementations must embed UnimplementedIDEServiceServer
// for forward compatibility
type IDEServiceServer interface {
	GetConfig(context.Context, *GetConfigRequest) (*GetConfigResponse, error)
	ResolveWorkspaceConfig(context.Context, *ResolveWorkspaceConfigRequest) (*ResolveWorkspaceConfigResponse, error)
	mustEmbedUnimplementedIDEServiceServer()
}

// UnimplementedIDEServiceServer must be embedded to have forward compatible implementations.
type UnimplementedIDEServiceServer struct {
}

func (UnimplementedIDEServiceServer) GetConfig(context.Context, *GetConfigRequest) (*GetConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetConfig not implemented")
}
func (UnimplementedIDEServiceServer) ResolveWorkspaceConfig(context.Context, *ResolveWorkspaceConfigRequest) (*ResolveWorkspaceConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ResolveWorkspaceConfig not implemented")
}
func (UnimplementedIDEServiceServer) mustEmbedUnimplementedIDEServiceServer() {}

// UnsafeIDEServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to IDEServiceServer will
// result in compilation errors.
type UnsafeIDEServiceServer interface {
	mustEmbedUnimplementedIDEServiceServer()
}

func RegisterIDEServiceServer(s grpc.ServiceRegistrar, srv IDEServiceServer) {
	s.RegisterService(&IDEService_ServiceDesc, srv)
}

func _IDEService_GetConfig_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetConfigRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(IDEServiceServer).GetConfig(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/ide_service_api.IDEService/GetConfig",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(IDEServiceServer).GetConfig(ctx, req.(*GetConfigRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _IDEService_ResolveWorkspaceConfig_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ResolveWorkspaceConfigRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(IDEServiceServer).ResolveWorkspaceConfig(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/ide_service_api.IDEService/ResolveWorkspaceConfig",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(IDEServiceServer).ResolveWorkspaceConfig(ctx, req.(*ResolveWorkspaceConfigRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// IDEService_ServiceDesc is the grpc.ServiceDesc for IDEService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var IDEService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "ide_service_api.IDEService",
	HandlerType: (*IDEServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetConfig",
			Handler:    _IDEService_GetConfig_Handler,
		},
		{
			MethodName: "ResolveWorkspaceConfig",
			Handler:    _IDEService_ResolveWorkspaceConfig_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "ide.proto",
}
