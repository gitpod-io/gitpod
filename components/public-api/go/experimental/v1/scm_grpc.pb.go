// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             (unknown)
// source: gitpod/experimental/v1/scm.proto

package v1

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

// SCMServiceClient is the client API for SCMService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type SCMServiceClient interface {
	// GetSuggestedRepoURLs returns a list of suggested repositories to open for
	// the user.
	GetSuggestedRepoURLs(ctx context.Context, in *GetSuggestedRepoURLsRequest, opts ...grpc.CallOption) (*GetSuggestedRepoURLsResponse, error)
}

type sCMServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewSCMServiceClient(cc grpc.ClientConnInterface) SCMServiceClient {
	return &sCMServiceClient{cc}
}

func (c *sCMServiceClient) GetSuggestedRepoURLs(ctx context.Context, in *GetSuggestedRepoURLsRequest, opts ...grpc.CallOption) (*GetSuggestedRepoURLsResponse, error) {
	out := new(GetSuggestedRepoURLsResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.SCMService/GetSuggestedRepoURLs", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// SCMServiceServer is the server API for SCMService service.
// All implementations must embed UnimplementedSCMServiceServer
// for forward compatibility
type SCMServiceServer interface {
	// GetSuggestedRepoURLs returns a list of suggested repositories to open for
	// the user.
	GetSuggestedRepoURLs(context.Context, *GetSuggestedRepoURLsRequest) (*GetSuggestedRepoURLsResponse, error)
	mustEmbedUnimplementedSCMServiceServer()
}

// UnimplementedSCMServiceServer must be embedded to have forward compatible implementations.
type UnimplementedSCMServiceServer struct {
}

func (UnimplementedSCMServiceServer) GetSuggestedRepoURLs(context.Context, *GetSuggestedRepoURLsRequest) (*GetSuggestedRepoURLsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetSuggestedRepoURLs not implemented")
}
func (UnimplementedSCMServiceServer) mustEmbedUnimplementedSCMServiceServer() {}

// UnsafeSCMServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to SCMServiceServer will
// result in compilation errors.
type UnsafeSCMServiceServer interface {
	mustEmbedUnimplementedSCMServiceServer()
}

func RegisterSCMServiceServer(s grpc.ServiceRegistrar, srv SCMServiceServer) {
	s.RegisterService(&SCMService_ServiceDesc, srv)
}

func _SCMService_GetSuggestedRepoURLs_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetSuggestedRepoURLsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SCMServiceServer).GetSuggestedRepoURLs(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.SCMService/GetSuggestedRepoURLs",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SCMServiceServer).GetSuggestedRepoURLs(ctx, req.(*GetSuggestedRepoURLsRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// SCMService_ServiceDesc is the grpc.ServiceDesc for SCMService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var SCMService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "gitpod.experimental.v1.SCMService",
	HandlerType: (*SCMServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetSuggestedRepoURLs",
			Handler:    _SCMService_GetSuggestedRepoURLs_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "gitpod/experimental/v1/scm.proto",
}
