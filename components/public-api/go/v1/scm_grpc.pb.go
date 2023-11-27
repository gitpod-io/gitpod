// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             (unknown)
// source: gitpod/v1/scm.proto

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
	// SearchSCMTokens allows clients to retrieve SCM tokens based on the
	// specified host.
	SearchSCMTokens(ctx context.Context, in *SearchSCMTokensRequest, opts ...grpc.CallOption) (*SearchSCMTokensResponse, error)
	// GuessTokenScopes allows clients to retrieve scopes their SCM token would
	// require for the specified git command.
	GuessTokenScopes(ctx context.Context, in *GuessTokenScopesRequest, opts ...grpc.CallOption) (*GuessTokenScopesResponse, error)
	// SearchRepositories allows clients to search for suggested repositories of
	// SCM providers they are connected with.
	SearchRepositories(ctx context.Context, in *SearchRepositoriesRequest, opts ...grpc.CallOption) (*SearchRepositoriesResponse, error)
	// ListSuggestedRepositories allows clients to list suggested repositories
	// based on recent workspaces and accessible repo configurations.
	ListSuggestedRepositories(ctx context.Context, in *ListSuggestedRepositoriesRequest, opts ...grpc.CallOption) (*ListSuggestedRepositoriesResponse, error)
}

type sCMServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewSCMServiceClient(cc grpc.ClientConnInterface) SCMServiceClient {
	return &sCMServiceClient{cc}
}

func (c *sCMServiceClient) SearchSCMTokens(ctx context.Context, in *SearchSCMTokensRequest, opts ...grpc.CallOption) (*SearchSCMTokensResponse, error) {
	out := new(SearchSCMTokensResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.SCMService/SearchSCMTokens", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *sCMServiceClient) GuessTokenScopes(ctx context.Context, in *GuessTokenScopesRequest, opts ...grpc.CallOption) (*GuessTokenScopesResponse, error) {
	out := new(GuessTokenScopesResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.SCMService/GuessTokenScopes", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *sCMServiceClient) SearchRepositories(ctx context.Context, in *SearchRepositoriesRequest, opts ...grpc.CallOption) (*SearchRepositoriesResponse, error) {
	out := new(SearchRepositoriesResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.SCMService/SearchRepositories", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *sCMServiceClient) ListSuggestedRepositories(ctx context.Context, in *ListSuggestedRepositoriesRequest, opts ...grpc.CallOption) (*ListSuggestedRepositoriesResponse, error) {
	out := new(ListSuggestedRepositoriesResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.SCMService/ListSuggestedRepositories", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// SCMServiceServer is the server API for SCMService service.
// All implementations must embed UnimplementedSCMServiceServer
// for forward compatibility
type SCMServiceServer interface {
	// SearchSCMTokens allows clients to retrieve SCM tokens based on the
	// specified host.
	SearchSCMTokens(context.Context, *SearchSCMTokensRequest) (*SearchSCMTokensResponse, error)
	// GuessTokenScopes allows clients to retrieve scopes their SCM token would
	// require for the specified git command.
	GuessTokenScopes(context.Context, *GuessTokenScopesRequest) (*GuessTokenScopesResponse, error)
	// SearchRepositories allows clients to search for suggested repositories of
	// SCM providers they are connected with.
	SearchRepositories(context.Context, *SearchRepositoriesRequest) (*SearchRepositoriesResponse, error)
	// ListSuggestedRepositories allows clients to list suggested repositories
	// based on recent workspaces and accessible repo configurations.
	ListSuggestedRepositories(context.Context, *ListSuggestedRepositoriesRequest) (*ListSuggestedRepositoriesResponse, error)
	mustEmbedUnimplementedSCMServiceServer()
}

// UnimplementedSCMServiceServer must be embedded to have forward compatible implementations.
type UnimplementedSCMServiceServer struct {
}

func (UnimplementedSCMServiceServer) SearchSCMTokens(context.Context, *SearchSCMTokensRequest) (*SearchSCMTokensResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SearchSCMTokens not implemented")
}
func (UnimplementedSCMServiceServer) GuessTokenScopes(context.Context, *GuessTokenScopesRequest) (*GuessTokenScopesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GuessTokenScopes not implemented")
}
func (UnimplementedSCMServiceServer) SearchRepositories(context.Context, *SearchRepositoriesRequest) (*SearchRepositoriesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SearchRepositories not implemented")
}
func (UnimplementedSCMServiceServer) ListSuggestedRepositories(context.Context, *ListSuggestedRepositoriesRequest) (*ListSuggestedRepositoriesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListSuggestedRepositories not implemented")
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

func _SCMService_SearchSCMTokens_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SearchSCMTokensRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SCMServiceServer).SearchSCMTokens(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.SCMService/SearchSCMTokens",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SCMServiceServer).SearchSCMTokens(ctx, req.(*SearchSCMTokensRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SCMService_GuessTokenScopes_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GuessTokenScopesRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SCMServiceServer).GuessTokenScopes(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.SCMService/GuessTokenScopes",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SCMServiceServer).GuessTokenScopes(ctx, req.(*GuessTokenScopesRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SCMService_SearchRepositories_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SearchRepositoriesRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SCMServiceServer).SearchRepositories(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.SCMService/SearchRepositories",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SCMServiceServer).SearchRepositories(ctx, req.(*SearchRepositoriesRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SCMService_ListSuggestedRepositories_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListSuggestedRepositoriesRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SCMServiceServer).ListSuggestedRepositories(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.SCMService/ListSuggestedRepositories",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SCMServiceServer).ListSuggestedRepositories(ctx, req.(*ListSuggestedRepositoriesRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// SCMService_ServiceDesc is the grpc.ServiceDesc for SCMService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var SCMService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "gitpod.v1.SCMService",
	HandlerType: (*SCMServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "SearchSCMTokens",
			Handler:    _SCMService_SearchSCMTokens_Handler,
		},
		{
			MethodName: "GuessTokenScopes",
			Handler:    _SCMService_GuessTokenScopes_Handler,
		},
		{
			MethodName: "SearchRepositories",
			Handler:    _SCMService_SearchRepositories_Handler,
		},
		{
			MethodName: "ListSuggestedRepositories",
			Handler:    _SCMService_ListSuggestedRepositories_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "gitpod/v1/scm.proto",
}
