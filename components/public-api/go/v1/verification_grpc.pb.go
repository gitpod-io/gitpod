// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             (unknown)
// source: gitpod/v1/verification.proto

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

// VerificationServiceClient is the client API for VerificationService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type VerificationServiceClient interface {
	// SendPhoneNumberVerificationToken sends a verification token to the
	// specified phone number.
	SendPhoneNumberVerificationToken(ctx context.Context, in *SendPhoneNumberVerificationTokenRequest, opts ...grpc.CallOption) (*SendPhoneNumberVerificationTokenResponse, error)
	// VerifyPhoneNumberVerificationToken verifies the specified verification
	// token.
	VerifyPhoneNumberVerificationToken(ctx context.Context, in *VerifyPhoneNumberVerificationTokenRequest, opts ...grpc.CallOption) (*VerifyPhoneNumberVerificationTokenResponse, error)
	// ListBlockedRepositories lists blocked repositories.
	ListBlockedRepositories(ctx context.Context, in *ListBlockedRepositoriesRequest, opts ...grpc.CallOption) (*ListBlockedRepositoriesResponse, error)
	// CreateBlockedRepository creates a new blocked repository.
	CreateBlockedRepository(ctx context.Context, in *CreateBlockedRepositoryRequest, opts ...grpc.CallOption) (*CreateBlockedRepositoryResponse, error)
	// DeleteBlockedRepository deletes a blocked repository.
	DeleteBlockedRepository(ctx context.Context, in *DeleteBlockedRepositoryRequest, opts ...grpc.CallOption) (*DeleteBlockedRepositoryResponse, error)
	// ListBlockedEmailDomains lists blocked email domains.
	ListBlockedEmailDomains(ctx context.Context, in *ListBlockedEmailDomainsRequest, opts ...grpc.CallOption) (*ListBlockedEmailDomainsResponse, error)
	// CreateBlockedEmailDomain creates a new blocked email domain.
	CreateBlockedEmailDomain(ctx context.Context, in *CreateBlockedEmailDomainRequest, opts ...grpc.CallOption) (*CreateBlockedEmailDomainResponse, error)
}

type verificationServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewVerificationServiceClient(cc grpc.ClientConnInterface) VerificationServiceClient {
	return &verificationServiceClient{cc}
}

func (c *verificationServiceClient) SendPhoneNumberVerificationToken(ctx context.Context, in *SendPhoneNumberVerificationTokenRequest, opts ...grpc.CallOption) (*SendPhoneNumberVerificationTokenResponse, error) {
	out := new(SendPhoneNumberVerificationTokenResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/SendPhoneNumberVerificationToken", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *verificationServiceClient) VerifyPhoneNumberVerificationToken(ctx context.Context, in *VerifyPhoneNumberVerificationTokenRequest, opts ...grpc.CallOption) (*VerifyPhoneNumberVerificationTokenResponse, error) {
	out := new(VerifyPhoneNumberVerificationTokenResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/VerifyPhoneNumberVerificationToken", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *verificationServiceClient) ListBlockedRepositories(ctx context.Context, in *ListBlockedRepositoriesRequest, opts ...grpc.CallOption) (*ListBlockedRepositoriesResponse, error) {
	out := new(ListBlockedRepositoriesResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/ListBlockedRepositories", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *verificationServiceClient) CreateBlockedRepository(ctx context.Context, in *CreateBlockedRepositoryRequest, opts ...grpc.CallOption) (*CreateBlockedRepositoryResponse, error) {
	out := new(CreateBlockedRepositoryResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/CreateBlockedRepository", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *verificationServiceClient) DeleteBlockedRepository(ctx context.Context, in *DeleteBlockedRepositoryRequest, opts ...grpc.CallOption) (*DeleteBlockedRepositoryResponse, error) {
	out := new(DeleteBlockedRepositoryResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/DeleteBlockedRepository", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *verificationServiceClient) ListBlockedEmailDomains(ctx context.Context, in *ListBlockedEmailDomainsRequest, opts ...grpc.CallOption) (*ListBlockedEmailDomainsResponse, error) {
	out := new(ListBlockedEmailDomainsResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/ListBlockedEmailDomains", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *verificationServiceClient) CreateBlockedEmailDomain(ctx context.Context, in *CreateBlockedEmailDomainRequest, opts ...grpc.CallOption) (*CreateBlockedEmailDomainResponse, error) {
	out := new(CreateBlockedEmailDomainResponse)
	err := c.cc.Invoke(ctx, "/gitpod.v1.VerificationService/CreateBlockedEmailDomain", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// VerificationServiceServer is the server API for VerificationService service.
// All implementations must embed UnimplementedVerificationServiceServer
// for forward compatibility
type VerificationServiceServer interface {
	// SendPhoneNumberVerificationToken sends a verification token to the
	// specified phone number.
	SendPhoneNumberVerificationToken(context.Context, *SendPhoneNumberVerificationTokenRequest) (*SendPhoneNumberVerificationTokenResponse, error)
	// VerifyPhoneNumberVerificationToken verifies the specified verification
	// token.
	VerifyPhoneNumberVerificationToken(context.Context, *VerifyPhoneNumberVerificationTokenRequest) (*VerifyPhoneNumberVerificationTokenResponse, error)
	// ListBlockedRepositories lists blocked repositories.
	ListBlockedRepositories(context.Context, *ListBlockedRepositoriesRequest) (*ListBlockedRepositoriesResponse, error)
	// CreateBlockedRepository creates a new blocked repository.
	CreateBlockedRepository(context.Context, *CreateBlockedRepositoryRequest) (*CreateBlockedRepositoryResponse, error)
	// DeleteBlockedRepository deletes a blocked repository.
	DeleteBlockedRepository(context.Context, *DeleteBlockedRepositoryRequest) (*DeleteBlockedRepositoryResponse, error)
	// ListBlockedEmailDomains lists blocked email domains.
	ListBlockedEmailDomains(context.Context, *ListBlockedEmailDomainsRequest) (*ListBlockedEmailDomainsResponse, error)
	// CreateBlockedEmailDomain creates a new blocked email domain.
	CreateBlockedEmailDomain(context.Context, *CreateBlockedEmailDomainRequest) (*CreateBlockedEmailDomainResponse, error)
	mustEmbedUnimplementedVerificationServiceServer()
}

// UnimplementedVerificationServiceServer must be embedded to have forward compatible implementations.
type UnimplementedVerificationServiceServer struct {
}

func (UnimplementedVerificationServiceServer) SendPhoneNumberVerificationToken(context.Context, *SendPhoneNumberVerificationTokenRequest) (*SendPhoneNumberVerificationTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SendPhoneNumberVerificationToken not implemented")
}
func (UnimplementedVerificationServiceServer) VerifyPhoneNumberVerificationToken(context.Context, *VerifyPhoneNumberVerificationTokenRequest) (*VerifyPhoneNumberVerificationTokenResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method VerifyPhoneNumberVerificationToken not implemented")
}
func (UnimplementedVerificationServiceServer) ListBlockedRepositories(context.Context, *ListBlockedRepositoriesRequest) (*ListBlockedRepositoriesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListBlockedRepositories not implemented")
}
func (UnimplementedVerificationServiceServer) CreateBlockedRepository(context.Context, *CreateBlockedRepositoryRequest) (*CreateBlockedRepositoryResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateBlockedRepository not implemented")
}
func (UnimplementedVerificationServiceServer) DeleteBlockedRepository(context.Context, *DeleteBlockedRepositoryRequest) (*DeleteBlockedRepositoryResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DeleteBlockedRepository not implemented")
}
func (UnimplementedVerificationServiceServer) ListBlockedEmailDomains(context.Context, *ListBlockedEmailDomainsRequest) (*ListBlockedEmailDomainsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListBlockedEmailDomains not implemented")
}
func (UnimplementedVerificationServiceServer) CreateBlockedEmailDomain(context.Context, *CreateBlockedEmailDomainRequest) (*CreateBlockedEmailDomainResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateBlockedEmailDomain not implemented")
}
func (UnimplementedVerificationServiceServer) mustEmbedUnimplementedVerificationServiceServer() {}

// UnsafeVerificationServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to VerificationServiceServer will
// result in compilation errors.
type UnsafeVerificationServiceServer interface {
	mustEmbedUnimplementedVerificationServiceServer()
}

func RegisterVerificationServiceServer(s grpc.ServiceRegistrar, srv VerificationServiceServer) {
	s.RegisterService(&VerificationService_ServiceDesc, srv)
}

func _VerificationService_SendPhoneNumberVerificationToken_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SendPhoneNumberVerificationTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).SendPhoneNumberVerificationToken(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/SendPhoneNumberVerificationToken",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).SendPhoneNumberVerificationToken(ctx, req.(*SendPhoneNumberVerificationTokenRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _VerificationService_VerifyPhoneNumberVerificationToken_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(VerifyPhoneNumberVerificationTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).VerifyPhoneNumberVerificationToken(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/VerifyPhoneNumberVerificationToken",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).VerifyPhoneNumberVerificationToken(ctx, req.(*VerifyPhoneNumberVerificationTokenRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _VerificationService_ListBlockedRepositories_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListBlockedRepositoriesRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).ListBlockedRepositories(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/ListBlockedRepositories",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).ListBlockedRepositories(ctx, req.(*ListBlockedRepositoriesRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _VerificationService_CreateBlockedRepository_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateBlockedRepositoryRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).CreateBlockedRepository(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/CreateBlockedRepository",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).CreateBlockedRepository(ctx, req.(*CreateBlockedRepositoryRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _VerificationService_DeleteBlockedRepository_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(DeleteBlockedRepositoryRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).DeleteBlockedRepository(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/DeleteBlockedRepository",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).DeleteBlockedRepository(ctx, req.(*DeleteBlockedRepositoryRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _VerificationService_ListBlockedEmailDomains_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListBlockedEmailDomainsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).ListBlockedEmailDomains(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/ListBlockedEmailDomains",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).ListBlockedEmailDomains(ctx, req.(*ListBlockedEmailDomainsRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _VerificationService_CreateBlockedEmailDomain_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateBlockedEmailDomainRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(VerificationServiceServer).CreateBlockedEmailDomain(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/gitpod.v1.VerificationService/CreateBlockedEmailDomain",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(VerificationServiceServer).CreateBlockedEmailDomain(ctx, req.(*CreateBlockedEmailDomainRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// VerificationService_ServiceDesc is the grpc.ServiceDesc for VerificationService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var VerificationService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "gitpod.v1.VerificationService",
	HandlerType: (*VerificationServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "SendPhoneNumberVerificationToken",
			Handler:    _VerificationService_SendPhoneNumberVerificationToken_Handler,
		},
		{
			MethodName: "VerifyPhoneNumberVerificationToken",
			Handler:    _VerificationService_VerifyPhoneNumberVerificationToken_Handler,
		},
		{
			MethodName: "ListBlockedRepositories",
			Handler:    _VerificationService_ListBlockedRepositories_Handler,
		},
		{
			MethodName: "CreateBlockedRepository",
			Handler:    _VerificationService_CreateBlockedRepository_Handler,
		},
		{
			MethodName: "DeleteBlockedRepository",
			Handler:    _VerificationService_DeleteBlockedRepository_Handler,
		},
		{
			MethodName: "ListBlockedEmailDomains",
			Handler:    _VerificationService_ListBlockedEmailDomains_Handler,
		},
		{
			MethodName: "CreateBlockedEmailDomain",
			Handler:    _VerificationService_CreateBlockedEmailDomain_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "gitpod/v1/verification.proto",
}
