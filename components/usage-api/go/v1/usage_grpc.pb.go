// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             v3.20.1
// source: usage/v1/usage.proto

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

// UsageServiceClient is the client API for UsageService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type UsageServiceClient interface {
	// GetCostCenter retrieves the active cost center for the given attributionID
	GetCostCenter(ctx context.Context, in *GetCostCenterRequest, opts ...grpc.CallOption) (*GetCostCenterResponse, error)
	// DEPRECATED (use UpdateBillingStrategy)
	SetCostCenter(ctx context.Context, in *SetCostCenterRequest, opts ...grpc.CallOption) (*SetCostCenterResponse, error)
	// UpdateBillingStrategy updates the billing strategy for the given attributionID
	UpdateBillingStrategy(ctx context.Context, in *UpdateBillingStrategyRequest, opts ...grpc.CallOption) (*UpdateBillingStrategyResponse, error)
	// Triggers reconciliation of usage with ledger implementation.
	ReconcileUsageWithLedger(ctx context.Context, in *ReconcileUsageWithLedgerRequest, opts ...grpc.CallOption) (*ReconcileUsageWithLedgerResponse, error)
	// ListUsage retrieves all usage for the specified attributionId and theb given time range
	ListUsage(ctx context.Context, in *ListUsageRequest, opts ...grpc.CallOption) (*ListUsageResponse, error)
}

type usageServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewUsageServiceClient(cc grpc.ClientConnInterface) UsageServiceClient {
	return &usageServiceClient{cc}
}

func (c *usageServiceClient) GetCostCenter(ctx context.Context, in *GetCostCenterRequest, opts ...grpc.CallOption) (*GetCostCenterResponse, error) {
	out := new(GetCostCenterResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.UsageService/GetCostCenter", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *usageServiceClient) SetCostCenter(ctx context.Context, in *SetCostCenterRequest, opts ...grpc.CallOption) (*SetCostCenterResponse, error) {
	out := new(SetCostCenterResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.UsageService/SetCostCenter", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *usageServiceClient) UpdateBillingStrategy(ctx context.Context, in *UpdateBillingStrategyRequest, opts ...grpc.CallOption) (*UpdateBillingStrategyResponse, error) {
	out := new(UpdateBillingStrategyResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.UsageService/UpdateBillingStrategy", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *usageServiceClient) ReconcileUsageWithLedger(ctx context.Context, in *ReconcileUsageWithLedgerRequest, opts ...grpc.CallOption) (*ReconcileUsageWithLedgerResponse, error) {
	out := new(ReconcileUsageWithLedgerResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.UsageService/ReconcileUsageWithLedger", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *usageServiceClient) ListUsage(ctx context.Context, in *ListUsageRequest, opts ...grpc.CallOption) (*ListUsageResponse, error) {
	out := new(ListUsageResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.UsageService/ListUsage", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// UsageServiceServer is the server API for UsageService service.
// All implementations must embed UnimplementedUsageServiceServer
// for forward compatibility
type UsageServiceServer interface {
	// GetCostCenter retrieves the active cost center for the given attributionID
	GetCostCenter(context.Context, *GetCostCenterRequest) (*GetCostCenterResponse, error)
	// DEPRECATED (use UpdateBillingStrategy)
	SetCostCenter(context.Context, *SetCostCenterRequest) (*SetCostCenterResponse, error)
	// UpdateBillingStrategy updates the billing strategy for the given attributionID
	UpdateBillingStrategy(context.Context, *UpdateBillingStrategyRequest) (*UpdateBillingStrategyResponse, error)
	// Triggers reconciliation of usage with ledger implementation.
	ReconcileUsageWithLedger(context.Context, *ReconcileUsageWithLedgerRequest) (*ReconcileUsageWithLedgerResponse, error)
	// ListUsage retrieves all usage for the specified attributionId and theb given time range
	ListUsage(context.Context, *ListUsageRequest) (*ListUsageResponse, error)
	mustEmbedUnimplementedUsageServiceServer()
}

// UnimplementedUsageServiceServer must be embedded to have forward compatible implementations.
type UnimplementedUsageServiceServer struct {
}

func (UnimplementedUsageServiceServer) GetCostCenter(context.Context, *GetCostCenterRequest) (*GetCostCenterResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetCostCenter not implemented")
}
func (UnimplementedUsageServiceServer) SetCostCenter(context.Context, *SetCostCenterRequest) (*SetCostCenterResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetCostCenter not implemented")
}
func (UnimplementedUsageServiceServer) UpdateBillingStrategy(context.Context, *UpdateBillingStrategyRequest) (*UpdateBillingStrategyResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UpdateBillingStrategy not implemented")
}
func (UnimplementedUsageServiceServer) ReconcileUsageWithLedger(context.Context, *ReconcileUsageWithLedgerRequest) (*ReconcileUsageWithLedgerResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ReconcileUsageWithLedger not implemented")
}
func (UnimplementedUsageServiceServer) ListUsage(context.Context, *ListUsageRequest) (*ListUsageResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListUsage not implemented")
}
func (UnimplementedUsageServiceServer) mustEmbedUnimplementedUsageServiceServer() {}

// UnsafeUsageServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to UsageServiceServer will
// result in compilation errors.
type UnsafeUsageServiceServer interface {
	mustEmbedUnimplementedUsageServiceServer()
}

func RegisterUsageServiceServer(s grpc.ServiceRegistrar, srv UsageServiceServer) {
	s.RegisterService(&UsageService_ServiceDesc, srv)
}

func _UsageService_GetCostCenter_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetCostCenterRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageServiceServer).GetCostCenter(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.UsageService/GetCostCenter",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageServiceServer).GetCostCenter(ctx, req.(*GetCostCenterRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UsageService_SetCostCenter_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SetCostCenterRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageServiceServer).SetCostCenter(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.UsageService/SetCostCenter",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageServiceServer).SetCostCenter(ctx, req.(*SetCostCenterRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UsageService_UpdateBillingStrategy_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UpdateBillingStrategyRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageServiceServer).UpdateBillingStrategy(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.UsageService/UpdateBillingStrategy",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageServiceServer).UpdateBillingStrategy(ctx, req.(*UpdateBillingStrategyRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UsageService_ReconcileUsageWithLedger_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ReconcileUsageWithLedgerRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageServiceServer).ReconcileUsageWithLedger(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.UsageService/ReconcileUsageWithLedger",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageServiceServer).ReconcileUsageWithLedger(ctx, req.(*ReconcileUsageWithLedgerRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UsageService_ListUsage_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListUsageRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UsageServiceServer).ListUsage(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.UsageService/ListUsage",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UsageServiceServer).ListUsage(ctx, req.(*ListUsageRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// UsageService_ServiceDesc is the grpc.ServiceDesc for UsageService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var UsageService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "usage.v1.UsageService",
	HandlerType: (*UsageServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "GetCostCenter",
			Handler:    _UsageService_GetCostCenter_Handler,
		},
		{
			MethodName: "SetCostCenter",
			Handler:    _UsageService_SetCostCenter_Handler,
		},
		{
			MethodName: "UpdateBillingStrategy",
			Handler:    _UsageService_UpdateBillingStrategy_Handler,
		},
		{
			MethodName: "ReconcileUsageWithLedger",
			Handler:    _UsageService_ReconcileUsageWithLedger_Handler,
		},
		{
			MethodName: "ListUsage",
			Handler:    _UsageService_ListUsage_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "usage/v1/usage.proto",
}
