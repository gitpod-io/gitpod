// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.20.1
// source: token.proto

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

// TokenServiceClient is the client API for TokenService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type TokenServiceClient interface {
	GetToken(ctx context.Context, in *GetTokenRequest, opts ...grpc.CallOption) (*GetTokenResponse, error)
	SetToken(ctx context.Context, in *SetTokenRequest, opts ...grpc.CallOption) (*SetTokenResponse, error)
	ClearToken(ctx context.Context, in *ClearTokenRequest, opts ...grpc.CallOption) (*ClearTokenResponse, error)
	ProvideToken(ctx context.Context, opts ...grpc.CallOption) (TokenService_ProvideTokenClient, error)
}

type tokenServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewTokenServiceClient(cc grpc.ClientConnInterface) TokenServiceClient {
	return &tokenServiceClient{cc}
}

func (c *tokenServiceClient) GetToken(ctx context.Context, in *GetTokenRequest, opts ...grpc.CallOption) (*GetTokenResponse, error) {
	out := new(GetTokenResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TokenService/GetToken", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *tokenServiceClient) SetToken(ctx context.Context, in *SetTokenRequest, opts ...grpc.CallOption) (*SetTokenResponse, error) {
	out := new(SetTokenResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TokenService/SetToken", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *tokenServiceClient) ClearToken(ctx context.Context, in *ClearTokenRequest, opts ...grpc.CallOption) (*ClearTokenResponse, error) {
	out := new(ClearTokenResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TokenService/ClearToken", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *tokenServiceClient) ProvideToken(ctx context.Context, opts ...grpc.CallOption) (TokenService_ProvideTokenClient, error) {
	stream, err := c.cc.NewStream(ctx, &TokenService_ServiceDesc.Streams[0], "/supervisor.TokenService/ProvideToken", opts...)
	if err != nil {
		return nil, err
	}
	x := &tokenServiceProvideTokenClient{stream}
	return x, nil
}

type TokenService_ProvideTokenClient interface {
	Send(*ProvideTokenRequest) error
	Recv() (*ProvideTokenResponse, error)
	grpc.ClientStream
}

type tokenServiceProvideTokenClient struct {
	grpc.ClientStream
}

func (x *tokenServiceProvideTokenClient) Send(m *ProvideTokenRequest) error {
	return x.ClientStream.SendMsg(m)
}

func (x *tokenServiceProvideTokenClient) Recv() (*ProvideTokenResponse, error) {
	m := new(ProvideTokenResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

// TokenServiceServer is the server API for TokenService service.
// All implementations must embed UnimplementedTokenServiceServer
// for forward compatibility
type TokenServiceServer interface {
	GetToken(context.Context, *GetTokenRequest) (*GetTokenResponse, error)
	SetToken(context.Context, *SetTokenRequest) (*SetTokenResponse, error)
	ClearToken(context.Context, *ClearTokenRequest) (*ClearTokenResponse, error)
	ProvideToken(TokenService_ProvideTokenServer) error
	mustEmbedUnimplementedTokenServiceServer()
}

// UnimplementedTokenServiceServer must be embedded to have forward compatible implementations.
type UnimplementedTokenServiceServer struct {
}

func (UnimplementedTokenServiceServer) GetToken(context.Context, *GetTokenRequest) (*GetTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetToken not implemented")
}
func (UnimplementedTokenServiceServer) SetToken(context.Context, *SetTokenRequest) (*SetTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetToken not implemented")
}
func (UnimplementedTokenServiceServer) ClearToken(context.Context, *ClearTokenRequest) (*ClearTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ClearToken not implemented")
}
func (UnimplementedTokenServiceServer) ProvideToken(TokenService_ProvideTokenServer) error {
	return status.Errorf(codes.Unimplemented, "method ProvideToken not implemented")
}
func (UnimplementedTokenServiceServer) mustEmbedUnimplementedTokenServiceServer() {}

// UnsafeTokenServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to TokenServiceServer will
// result in compilation errors.
type UnsafeTokenServiceServer interface {
	mustEmbedUnimplementedTokenServiceServer()
}

func RegisterTokenServiceServer(s grpc.ServiceRegistrar, srv TokenServiceServer) {
	s.RegisterService(&TokenService_ServiceDesc, srv)
}

func _TokenService_GetToken_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TokenServiceServer).GetToken(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TokenService/GetToken",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TokenServiceServer).GetToken(ctx, req.(*GetTokenRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TokenService_SetToken_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SetTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TokenServiceServer).SetToken(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TokenService/SetToken",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TokenServiceServer).SetToken(ctx, req.(*SetTokenRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TokenService_ClearToken_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ClearTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TokenServiceServer).ClearToken(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TokenService/ClearToken",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TokenServiceServer).ClearToken(ctx, req.(*ClearTokenRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TokenService_ProvideToken_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(TokenServiceServer).ProvideToken(&tokenServiceProvideTokenServer{stream})
}

type TokenService_ProvideTokenServer interface {
	Send(*ProvideTokenResponse) error
	Recv() (*ProvideTokenRequest, error)
	grpc.ServerStream
}

type tokenServiceProvideTokenServer struct {
	grpc.ServerStream
}

func (x *tokenServiceProvideTokenServer) Send(m *ProvideTokenResponse) error {
	return x.ServerStream.SendMsg(m)
}

func (x *tokenServiceProvideTokenServer) Recv() (*ProvideTokenRequest, error) {
	m := new(ProvideTokenRequest)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

// TokenService_ServiceDesc is the grpc.ServiceDesc for TokenService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var TokenService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "supervisor.TokenService",
	HandlerType: (*TokenServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetToken",
			Handler:    _TokenService_GetToken_Handler,
		},
		{
			MethodName: "SetToken",
			Handler:    _TokenService_SetToken_Handler,
		},
		{
			MethodName: "ClearToken",
			Handler:    _TokenService_ClearToken_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "ProvideToken",
			Handler:       _TokenService_ProvideToken_Handler,
			ServerStreams: true,
			ClientStreams: true,
		},
	},
	Metadata: "token.proto",
}
