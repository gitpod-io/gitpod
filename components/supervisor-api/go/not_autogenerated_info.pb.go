// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	context "context"

	_ "google.golang.org/genproto/googleapis/api/annotations"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

// InfoServiceClient is the client API for InfoService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type InfoServiceClient interface {
	WorkspaceInfo(ctx context.Context, in *WorkspaceInfoRequest, opts ...grpc.CallOption) (*WorkspaceInfoResponse, error)
}

type infoServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewInfoServiceClient(cc grpc.ClientConnInterface) InfoServiceClient {
	return &infoServiceClient{cc}
}

func (c *infoServiceClient) WorkspaceInfo(ctx context.Context, in *WorkspaceInfoRequest, opts ...grpc.CallOption) (*WorkspaceInfoResponse, error) {
	out := new(WorkspaceInfoResponse)
	err := c.cc.Invoke(ctx, "/supervisor.InfoService/WorkspaceInfo", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// InfoServiceServer is the server API for InfoService service.
type InfoServiceServer interface {
	WorkspaceInfo(context.Context, *WorkspaceInfoRequest) (*WorkspaceInfoResponse, error)
}

// UnimplementedInfoServiceServer can be embedded to have forward compatible implementations.
type UnimplementedInfoServiceServer struct {
}

func (*UnimplementedInfoServiceServer) WorkspaceInfo(context.Context, *WorkspaceInfoRequest) (*WorkspaceInfoResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method WorkspaceInfo not implemented")
}

func RegisterInfoServiceServer(s *grpc.Server, srv InfoServiceServer) {
	s.RegisterService(&_InfoService_serviceDesc, srv)
}

func _InfoService_WorkspaceInfo_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(WorkspaceInfoRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InfoServiceServer).WorkspaceInfo(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.InfoService/WorkspaceInfo",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(InfoServiceServer).WorkspaceInfo(ctx, req.(*WorkspaceInfoRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _InfoService_serviceDesc = grpc.ServiceDesc{
	ServiceName: "supervisor.InfoService",
	HandlerType: (*InfoServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "WorkspaceInfo",
			Handler:    _InfoService_WorkspaceInfo_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "info.proto",
}
