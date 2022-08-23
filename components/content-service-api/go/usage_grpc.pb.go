// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.20.1
// source: usage.proto

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

// UsageReportServiceClient is the client API for UsageReportService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type UsageReportServiceClient interface {
	// UploadURL provides a URL to which clients can upload the content via HTTP PUT.
	UploadURL(ctx context.Context, in *UsageReportUploadURLRequest, opts ...grpc.CallOption) (*UsageReportUploadURLResponse, error)
	// DownloadURL retrieves a URL which can be used to download a Usage Report.
	DownloadURL(ctx context.Context, in *UsageReportDownloadURLRequest, opts ...grpc.CallOption) (*UsageReportDownloadURLResponse, error)
}

type usageReportServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewUsageReportServiceClient(cc grpc.ClientConnInterface) UsageReportServiceClient {
	return &usageReportServiceClient{cc}
}

func (c *usageReportServiceClient) UploadURL(ctx context.Context, in *UsageReportUploadURLRequest, opts ...grpc.CallOption) (*UsageReportUploadURLResponse, error) {
	out := new(UsageReportUploadURLResponse)
	err := c.cc.Invoke(ctx, "/contentservice.UsageReportService/UploadURL", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *usageReportServiceClient) DownloadURL(ctx context.Context, in *UsageReportDownloadURLRequest, opts ...grpc.CallOption) (*UsageReportDownloadURLResponse, error) {
	out := new(UsageReportDownloadURLResponse)
	err := c.cc.Invoke(ctx, "/contentservice.UsageReportService/DownloadURL", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// UsageReportServiceServer is the server API for UsageReportService service.
// All implementations must embed UnimplementedUsageReportServiceServer
// for forward compatibility
type UsageReportServiceServer interface {
	// UploadURL provides a URL to which clients can upload the content via HTTP PUT.
	UploadURL(context.Context, *UsageReportUploadURLRequest) (*UsageReportUploadURLResponse, error)
	// DownloadURL retrieves a URL which can be used to download a Usage Report.
	DownloadURL(context.Context, *UsageReportDownloadURLRequest) (*UsageReportDownloadURLResponse, error)
	mustEmbedUnimplementedUsageReportServiceServer()
}

// UnimplementedUsageReportServiceServer must be embedded to have forward compatible implementations.
type UnimplementedUsageReportServiceServer struct {
}

func (UnimplementedUsageReportServiceServer) UploadURL(context.Context, *UsageReportUploadURLRequest) (*UsageReportUploadURLResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UploadURL not implemented")
}
func (UnimplementedUsageReportServiceServer) DownloadURL(context.Context, *UsageReportDownloadURLRequest) (*UsageReportDownloadURLResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DownloadURL not implemented")
}
func (UnimplementedUsageReportServiceServer) mustEmbedUnimplementedUsageReportServiceServer() {}

// UnsafeUsageReportServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to UsageReportServiceServer will
// result in compilation errors.
type UnsafeUsageReportServiceServer interface {
	mustEmbedUnimplementedUsageReportServiceServer()
}

func RegisterUsageReportServiceServer(s grpc.ServiceRegistrar, srv UsageReportServiceServer) {
	s.RegisterService(&UsageReportService_ServiceDesc, srv)
}

func _UsageReportService_UploadURL_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UsageReportUploadURLRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageReportServiceServer).UploadURL(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/contentservice.UsageReportService/UploadURL",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageReportServiceServer).UploadURL(ctx, req.(*UsageReportUploadURLRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UsageReportService_DownloadURL_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UsageReportDownloadURLRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageReportServiceServer).DownloadURL(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/contentservice.UsageReportService/DownloadURL",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageReportServiceServer).DownloadURL(ctx, req.(*UsageReportDownloadURLRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// UsageReportService_ServiceDesc is the grpc.ServiceDesc for UsageReportService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var UsageReportService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "contentservice.UsageReportService",
	HandlerType: (*UsageReportServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "UploadURL",
			Handler:    _UsageReportService_UploadURL_Handler,
		},
		{
			MethodName: "DownloadURL",
			Handler:    _UsageReportService_DownloadURL_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "usage.proto",
}
