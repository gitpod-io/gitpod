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

// TerminalServiceClient is the client API for TerminalService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://godoc.org/google.golang.org/grpc#ClientConn.NewStream.
type TerminalServiceClient interface {
	// Open opens a new terminal running the login shell
	Open(ctx context.Context, in *OpenTerminalRequest, opts ...grpc.CallOption) (*OpenTerminalResponse, error)
	// Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
	// before closing the pseudo-terminal.
	Shutdown(ctx context.Context, in *ShutdownTerminalRequest, opts ...grpc.CallOption) (*ShutdownTerminalResponse, error)
	// Get returns an opened terminal info
	Get(ctx context.Context, in *GetTerminalRequest, opts ...grpc.CallOption) (*Terminal, error)
	// List lists all open terminals
	List(ctx context.Context, in *ListTerminalsRequest, opts ...grpc.CallOption) (*ListTerminalsResponse, error)
	// Listen listens to a terminal
	Listen(ctx context.Context, in *ListenTerminalRequest, opts ...grpc.CallOption) (TerminalService_ListenClient, error)
	// Write writes to a terminal
	Write(ctx context.Context, in *WriteTerminalRequest, opts ...grpc.CallOption) (*WriteTerminalResponse, error)
	// SetSize sets the terminal's size
	SetSize(ctx context.Context, in *SetTerminalSizeRequest, opts ...grpc.CallOption) (*SetTerminalSizeResponse, error)
}

type terminalServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewTerminalServiceClient(cc grpc.ClientConnInterface) TerminalServiceClient {
	return &terminalServiceClient{cc}
}

func (c *terminalServiceClient) Open(ctx context.Context, in *OpenTerminalRequest, opts ...grpc.CallOption) (*OpenTerminalResponse, error) {
	out := new(OpenTerminalResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TerminalService/Open", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *terminalServiceClient) Shutdown(ctx context.Context, in *ShutdownTerminalRequest, opts ...grpc.CallOption) (*ShutdownTerminalResponse, error) {
	out := new(ShutdownTerminalResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TerminalService/Shutdown", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *terminalServiceClient) Get(ctx context.Context, in *GetTerminalRequest, opts ...grpc.CallOption) (*Terminal, error) {
	out := new(Terminal)
	err := c.cc.Invoke(ctx, "/supervisor.TerminalService/Get", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *terminalServiceClient) List(ctx context.Context, in *ListTerminalsRequest, opts ...grpc.CallOption) (*ListTerminalsResponse, error) {
	out := new(ListTerminalsResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TerminalService/List", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *terminalServiceClient) Listen(ctx context.Context, in *ListenTerminalRequest, opts ...grpc.CallOption) (TerminalService_ListenClient, error) {
	stream, err := c.cc.NewStream(ctx, &_TerminalService_serviceDesc.Streams[0], "/supervisor.TerminalService/Listen", opts...)
	if err != nil {
		return nil, err
	}
	x := &terminalServiceListenClient{stream}
	if err := x.ClientStream.SendMsg(in); err != nil {
		return nil, err
	}
	if err := x.ClientStream.CloseSend(); err != nil {
		return nil, err
	}
	return x, nil
}

type TerminalService_ListenClient interface {
	Recv() (*ListenTerminalResponse, error)
	grpc.ClientStream
}

type terminalServiceListenClient struct {
	grpc.ClientStream
}

func (x *terminalServiceListenClient) Recv() (*ListenTerminalResponse, error) {
	m := new(ListenTerminalResponse)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *terminalServiceClient) Write(ctx context.Context, in *WriteTerminalRequest, opts ...grpc.CallOption) (*WriteTerminalResponse, error) {
	out := new(WriteTerminalResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TerminalService/Write", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *terminalServiceClient) SetSize(ctx context.Context, in *SetTerminalSizeRequest, opts ...grpc.CallOption) (*SetTerminalSizeResponse, error) {
	out := new(SetTerminalSizeResponse)
	err := c.cc.Invoke(ctx, "/supervisor.TerminalService/SetSize", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// TerminalServiceServer is the server API for TerminalService service.
type TerminalServiceServer interface {
	// Open opens a new terminal running the login shell
	Open(context.Context, *OpenTerminalRequest) (*OpenTerminalResponse, error)
	// Shutdown closes a terminal for the given alias, SIGKILL'ing all child processes
	// before closing the pseudo-terminal.
	Shutdown(context.Context, *ShutdownTerminalRequest) (*ShutdownTerminalResponse, error)
	// Get returns an opened terminal info
	Get(context.Context, *GetTerminalRequest) (*Terminal, error)
	// List lists all open terminals
	List(context.Context, *ListTerminalsRequest) (*ListTerminalsResponse, error)
	// Listen listens to a terminal
	Listen(*ListenTerminalRequest, TerminalService_ListenServer) error
	// Write writes to a terminal
	Write(context.Context, *WriteTerminalRequest) (*WriteTerminalResponse, error)
	// SetSize sets the terminal's size
	SetSize(context.Context, *SetTerminalSizeRequest) (*SetTerminalSizeResponse, error)
}

// UnimplementedTerminalServiceServer can be embedded to have forward compatible implementations.
type UnimplementedTerminalServiceServer struct {
}

func (*UnimplementedTerminalServiceServer) Open(context.Context, *OpenTerminalRequest) (*OpenTerminalResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Open not implemented")
}
func (*UnimplementedTerminalServiceServer) Shutdown(context.Context, *ShutdownTerminalRequest) (*ShutdownTerminalResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Shutdown not implemented")
}
func (*UnimplementedTerminalServiceServer) Get(context.Context, *GetTerminalRequest) (*Terminal, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Get not implemented")
}
func (*UnimplementedTerminalServiceServer) List(context.Context, *ListTerminalsRequest) (*ListTerminalsResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method List not implemented")
}
func (*UnimplementedTerminalServiceServer) Listen(*ListenTerminalRequest, TerminalService_ListenServer) error {
	return status.Errorf(codes.Unimplemented, "method Listen not implemented")
}
func (*UnimplementedTerminalServiceServer) Write(context.Context, *WriteTerminalRequest) (*WriteTerminalResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Write not implemented")
}
func (*UnimplementedTerminalServiceServer) SetSize(context.Context, *SetTerminalSizeRequest) (*SetTerminalSizeResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetSize not implemented")
}

func RegisterTerminalServiceServer(s *grpc.Server, srv TerminalServiceServer) {
	s.RegisterService(&_TerminalService_serviceDesc, srv)
}

func _TerminalService_Open_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(OpenTerminalRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TerminalServiceServer).Open(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TerminalService/Open",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TerminalServiceServer).Open(ctx, req.(*OpenTerminalRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TerminalService_Shutdown_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ShutdownTerminalRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TerminalServiceServer).Shutdown(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TerminalService/Shutdown",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TerminalServiceServer).Shutdown(ctx, req.(*ShutdownTerminalRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TerminalService_Get_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetTerminalRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TerminalServiceServer).Get(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TerminalService/Get",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TerminalServiceServer).Get(ctx, req.(*GetTerminalRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TerminalService_List_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListTerminalsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TerminalServiceServer).List(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TerminalService/List",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TerminalServiceServer).List(ctx, req.(*ListTerminalsRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TerminalService_Listen_Handler(srv interface{}, stream grpc.ServerStream) error {
	m := new(ListenTerminalRequest)
	if err := stream.RecvMsg(m); err != nil {
		return err
	}
	return srv.(TerminalServiceServer).Listen(m, &terminalServiceListenServer{stream})
}

type TerminalService_ListenServer interface {
	Send(*ListenTerminalResponse) error
	grpc.ServerStream
}

type terminalServiceListenServer struct {
	grpc.ServerStream
}

func (x *terminalServiceListenServer) Send(m *ListenTerminalResponse) error {
	return x.ServerStream.SendMsg(m)
}

func _TerminalService_Write_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(WriteTerminalRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TerminalServiceServer).Write(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TerminalService/Write",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TerminalServiceServer).Write(ctx, req.(*WriteTerminalRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _TerminalService_SetSize_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SetTerminalSizeRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(TerminalServiceServer).SetSize(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/supervisor.TerminalService/SetSize",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(TerminalServiceServer).SetSize(ctx, req.(*SetTerminalSizeRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var _TerminalService_serviceDesc = grpc.ServiceDesc{
	ServiceName: "supervisor.TerminalService",
	HandlerType: (*TerminalServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "Open",
			Handler:    _TerminalService_Open_Handler,
		},
		{
			MethodName: "Shutdown",
			Handler:    _TerminalService_Shutdown_Handler,
		},
		{
			MethodName: "Get",
			Handler:    _TerminalService_Get_Handler,
		},
		{
			MethodName: "List",
			Handler:    _TerminalService_List_Handler,
		},
		{
			MethodName: "Write",
			Handler:    _TerminalService_Write_Handler,
		},
		{
			MethodName: "SetSize",
			Handler:    _TerminalService_SetSize_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "Listen",
			Handler:       _TerminalService_Listen_Handler,
			ServerStreams: true,
		},
	},
	Metadata: "terminal.proto",
}
