// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             (unknown)
// source: gitpod/experimental/v1/user.proto

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

// UserServiceClient is the client API for UserService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type UserServiceClient interface {
	// GetAuthenticatedUser gets the user info.
	GetAuthenticatedUser(ctx context.Context, in *GetAuthenticatedUserRequest, opts ...grpc.CallOption) (*GetAuthenticatedUserResponse, error)
	// ListSSHKeys lists the public SSH keys.
	ListSSHKeys(ctx context.Context, in *ListSSHKeysRequest, opts ...grpc.CallOption) (*ListSSHKeysResponse, error)
	// CreateSSHKey adds a public SSH key.
	CreateSSHKey(ctx context.Context, in *CreateSSHKeyRequest, opts ...grpc.CallOption) (*CreateSSHKeyResponse, error)
	// GetSSHKey retrieves an ssh key by ID.
	GetSSHKey(ctx context.Context, in *GetSSHKeyRequest, opts ...grpc.CallOption) (*GetSSHKeyResponse, error)
	// DeleteSSHKey removes a public SSH key.
	DeleteSSHKey(ctx context.Context, in *DeleteSSHKeyRequest, opts ...grpc.CallOption) (*DeleteSSHKeyResponse, error)
	GetGitToken(ctx context.Context, in *GetGitTokenRequest, opts ...grpc.CallOption) (*GetGitTokenResponse, error)
	// GetSuggestedRepoURLs returns a list of suggested repositories to open for the user.
	GetSuggestedRepoURLs(ctx context.Context, in *GetSuggestedRepoURLsRequest, opts ...grpc.CallOption) (*GetSuggestedRepoURLsResponse, error)
	BlockUser(ctx context.Context, in *BlockUserRequest, opts ...grpc.CallOption) (*BlockUserResponse, error)
}

type userServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewUserServiceClient(cc grpc.ClientConnInterface) UserServiceClient {
	return &userServiceClient{cc}
}

func (c *userServiceClient) GetAuthenticatedUser(ctx context.Context, in *GetAuthenticatedUserRequest, opts ...grpc.CallOption) (*GetAuthenticatedUserResponse, error) {
	out := new(GetAuthenticatedUserResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/GetAuthenticatedUser", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) ListSSHKeys(ctx context.Context, in *ListSSHKeysRequest, opts ...grpc.CallOption) (*ListSSHKeysResponse, error) {
	out := new(ListSSHKeysResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/ListSSHKeys", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) CreateSSHKey(ctx context.Context, in *CreateSSHKeyRequest, opts ...grpc.CallOption) (*CreateSSHKeyResponse, error) {
	out := new(CreateSSHKeyResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/CreateSSHKey", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) GetSSHKey(ctx context.Context, in *GetSSHKeyRequest, opts ...grpc.CallOption) (*GetSSHKeyResponse, error) {
	out := new(GetSSHKeyResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/GetSSHKey", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) DeleteSSHKey(ctx context.Context, in *DeleteSSHKeyRequest, opts ...grpc.CallOption) (*DeleteSSHKeyResponse, error) {
	out := new(DeleteSSHKeyResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/DeleteSSHKey", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) GetGitToken(ctx context.Context, in *GetGitTokenRequest, opts ...grpc.CallOption) (*GetGitTokenResponse, error) {
	out := new(GetGitTokenResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/GetGitToken", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) GetSuggestedRepoURLs(ctx context.Context, in *GetSuggestedRepoURLsRequest, opts ...grpc.CallOption) (*GetSuggestedRepoURLsResponse, error) {
	out := new(GetSuggestedRepoURLsResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/GetSuggestedRepoURLs", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userServiceClient) BlockUser(ctx context.Context, in *BlockUserRequest, opts ...grpc.CallOption) (*BlockUserResponse, error) {
	out := new(BlockUserResponse)
	err := c.cc.Invoke(ctx, "/gitpod.experimental.v1.UserService/BlockUser", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// UserServiceServer is the server API for UserService service.
// All implementations must embed UnimplementedUserServiceServer
// for forward compatibility
type UserServiceServer interface {
	// GetAuthenticatedUser gets the user info.
	GetAuthenticatedUser(context.Context, *GetAuthenticatedUserRequest) (*GetAuthenticatedUserResponse, error)
	// ListSSHKeys lists the public SSH keys.
	ListSSHKeys(context.Context, *ListSSHKeysRequest) (*ListSSHKeysResponse, error)
	// CreateSSHKey adds a public SSH key.
	CreateSSHKey(context.Context, *CreateSSHKeyRequest) (*CreateSSHKeyResponse, error)
	// GetSSHKey retrieves an ssh key by ID.
	GetSSHKey(context.Context, *GetSSHKeyRequest) (*GetSSHKeyResponse, error)
	// DeleteSSHKey removes a public SSH key.
	DeleteSSHKey(context.Context, *DeleteSSHKeyRequest) (*DeleteSSHKeyResponse, error)
	GetGitToken(context.Context, *GetGitTokenRequest) (*GetGitTokenResponse, error)
	// GetSuggestedRepoURLs returns a list of suggested repositories to open for the user.
	GetSuggestedRepoURLs(context.Context, *GetSuggestedRepoURLsRequest) (*GetSuggestedRepoURLsResponse, error)
	BlockUser(context.Context, *BlockUserRequest) (*BlockUserResponse, error)
	mustEmbedUnimplementedUserServiceServer()
}

// UnimplementedUserServiceServer must be embedded to have forward compatible implementations.
type UnimplementedUserServiceServer struct {
}

func (UnimplementedUserServiceServer) GetAuthenticatedUser(context.Context, *GetAuthenticatedUserRequest) (*GetAuthenticatedUserResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetAuthenticatedUser not implemented")
}
func (UnimplementedUserServiceServer) ListSSHKeys(context.Context, *ListSSHKeysRequest) (*ListSSHKeysResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListSSHKeys not implemented")
}
func (UnimplementedUserServiceServer) CreateSSHKey(context.Context, *CreateSSHKeyRequest) (*CreateSSHKeyResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateSSHKey not implemented")
}
func (UnimplementedUserServiceServer) GetSSHKey(context.Context, *GetSSHKeyRequest) (*GetSSHKeyResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetSSHKey not implemented")
}
func (UnimplementedUserServiceServer) DeleteSSHKey(context.Context, *DeleteSSHKeyRequest) (*DeleteSSHKeyResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DeleteSSHKey not implemented")
}
func (UnimplementedUserServiceServer) GetGitToken(context.Context, *GetGitTokenRequest) (*GetGitTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetGitToken not implemented")
}
func (UnimplementedUserServiceServer) GetSuggestedRepoURLs(context.Context, *GetSuggestedRepoURLsRequest) (*GetSuggestedRepoURLsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetSuggestedRepoURLs not implemented")
}
func (UnimplementedUserServiceServer) BlockUser(context.Context, *BlockUserRequest) (*BlockUserResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method BlockUser not implemented")
}
func (UnimplementedUserServiceServer) mustEmbedUnimplementedUserServiceServer() {}

// UnsafeUserServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to UserServiceServer will
// result in compilation errors.
type UnsafeUserServiceServer interface {
	mustEmbedUnimplementedUserServiceServer()
}

func RegisterUserServiceServer(s grpc.ServiceRegistrar, srv UserServiceServer) {
	s.RegisterService(&UserService_ServiceDesc, srv)
}

func _UserService_GetAuthenticatedUser_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetAuthenticatedUserRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).GetAuthenticatedUser(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/GetAuthenticatedUser",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).GetAuthenticatedUser(ctx, req.(*GetAuthenticatedUserRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_ListSSHKeys_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListSSHKeysRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).ListSSHKeys(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/ListSSHKeys",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).ListSSHKeys(ctx, req.(*ListSSHKeysRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_CreateSSHKey_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateSSHKeyRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).CreateSSHKey(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/CreateSSHKey",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).CreateSSHKey(ctx, req.(*CreateSSHKeyRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_GetSSHKey_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetSSHKeyRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).GetSSHKey(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/GetSSHKey",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).GetSSHKey(ctx, req.(*GetSSHKeyRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_DeleteSSHKey_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(DeleteSSHKeyRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).DeleteSSHKey(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/DeleteSSHKey",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).DeleteSSHKey(ctx, req.(*DeleteSSHKeyRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_GetGitToken_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetGitTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).GetGitToken(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/GetGitToken",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).GetGitToken(ctx, req.(*GetGitTokenRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_GetSuggestedRepoURLs_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetSuggestedRepoURLsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).GetSuggestedRepoURLs(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/GetSuggestedRepoURLs",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).GetSuggestedRepoURLs(ctx, req.(*GetSuggestedRepoURLsRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserService_BlockUser_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(BlockUserRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserServiceServer).BlockUser(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.experimental.v1.UserService/BlockUser",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserServiceServer).BlockUser(ctx, req.(*BlockUserRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// UserService_ServiceDesc is the grpc.ServiceDesc for UserService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var UserService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "gitpod.experimental.v1.UserService",
	HandlerType: (*UserServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetAuthenticatedUser",
			Handler:    _UserService_GetAuthenticatedUser_Handler,
		},
		{
			MethodName: "ListSSHKeys",
			Handler:    _UserService_ListSSHKeys_Handler,
		},
		{
			MethodName: "CreateSSHKey",
			Handler:    _UserService_CreateSSHKey_Handler,
		},
		{
			MethodName: "GetSSHKey",
			Handler:    _UserService_GetSSHKey_Handler,
		},
		{
			MethodName: "DeleteSSHKey",
			Handler:    _UserService_DeleteSSHKey_Handler,
		},
		{
			MethodName: "GetGitToken",
			Handler:    _UserService_GetGitToken_Handler,
		},
		{
			MethodName: "GetSuggestedRepoURLs",
			Handler:    _UserService_GetSuggestedRepoURLs_Handler,
		},
		{
			MethodName: "BlockUser",
			Handler:    _UserService_BlockUser_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "gitpod/experimental/v1/user.proto",
}
