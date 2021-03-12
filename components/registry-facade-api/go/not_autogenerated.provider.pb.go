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
const _ = grpc.SupportPackageIsVersion6

// SpecProviderClient is the client API for SpecProvider service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type SpecProviderClient interface {
	// GetImageSpec provides the image spec for a particular ID. What the ID referes to is specific to
	// the spec provider. For example, in case of ws-manager providing the spec, the ID is a
	// workspace instance ID.
	GetImageSpec(ctx context.Context, in *GetImageSpecRequest, opts ...grpc.CallOption) (*GetImageSpecResponse, error)
}

type specProviderClient struct {
	cc grpc.ClientConnInterface
}

func NewSpecProviderClient(cc grpc.ClientConnInterface) SpecProviderClient {
	return &specProviderClient{cc}
}

func (c *specProviderClient) GetImageSpec(ctx context.Context, in *GetImageSpecRequest, opts ...grpc.CallOption) (*GetImageSpecResponse, error) {
	out := new(GetImageSpecResponse)
	err := c.cc.Invoke(ctx, "/registryfacade.SpecProvider/GetImageSpec", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// SpecProviderServer is the server API for SpecProvider service.
type SpecProviderServer interface {
	// GetImageSpec provides the image spec for a particular ID. What the ID referes to is specific to
	// the spec provider. For example, in case of ws-manager providing the spec, the ID is a
	// workspace instance ID.
	GetImageSpec(context.Context, *GetImageSpecRequest) (*GetImageSpecResponse, error)
}

// UnimplementedSpecProviderServer can be embedded to have forward compatible implementations.
type UnimplementedSpecProviderServer struct {
}

func (*UnimplementedSpecProviderServer) GetImageSpec(ctx context.Context, req *GetImageSpecRequest) (*GetImageSpecResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetImageSpec not implemented")
}

func RegisterSpecProviderServer(s *grpc.Server, srv SpecProviderServer) {
	s.RegisterService(&_SpecProvider_serviceDesc, srv)
}

func _SpecProvider_GetImageSpec_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetImageSpecRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SpecProviderServer).GetImageSpec(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/registryfacade.SpecProvider/GetImageSpec",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SpecProviderServer).GetImageSpec(ctx, req.(*GetImageSpecRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _SpecProvider_serviceDesc = grpc.ServiceDesc{
	ServiceName: "registryfacade.SpecProvider",
	HandlerType: (*SpecProviderServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetImageSpec",
			Handler:    _SpecProvider_GetImageSpec_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "provider.proto",
}
