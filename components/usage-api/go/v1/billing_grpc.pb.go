// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.2.0
// - protoc             (unknown)
// source: usage/v1/billing.proto

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

// BillingServiceClient is the client API for BillingService service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type BillingServiceClient interface {
	// ReconcileInvoices retrieves current credit balance and reflects it in billing system.
	// Internal RPC, not intended for general consumption.
	ReconcileInvoices(ctx context.Context, in *ReconcileInvoicesRequest, opts ...grpc.CallOption) (*ReconcileInvoicesResponse, error)
	// FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
	// having been invoiced.
	FinalizeInvoice(ctx context.Context, in *FinalizeInvoiceRequest, opts ...grpc.CallOption) (*FinalizeInvoiceResponse, error)
	// CancelSubscription cancels a stripe subscription in our system
	// Called by a stripe webhook
	CancelSubscription(ctx context.Context, in *CancelSubscriptionRequest, opts ...grpc.CallOption) (*CancelSubscriptionResponse, error)
	// GetStripeCustomer retrieves a Stripe Customer
	GetStripeCustomer(ctx context.Context, in *GetStripeCustomerRequest, opts ...grpc.CallOption) (*GetStripeCustomerResponse, error)
	CreateStripeCustomer(ctx context.Context, in *CreateStripeCustomerRequest, opts ...grpc.CallOption) (*CreateStripeCustomerResponse, error)
	CreateStripeSubscription(ctx context.Context, in *CreateStripeSubscriptionRequest, opts ...grpc.CallOption) (*CreateStripeSubscriptionResponse, error)
	// GetPriceInformation returns the price information for a given attribtion id
	GetPriceInformation(ctx context.Context, in *GetPriceInformationRequest, opts ...grpc.CallOption) (*GetPriceInformationResponse, error)
}

type billingServiceClient struct {
	cc grpc.ClientConnInterface
}

func NewBillingServiceClient(cc grpc.ClientConnInterface) BillingServiceClient {
	return &billingServiceClient{cc}
}

func (c *billingServiceClient) ReconcileInvoices(ctx context.Context, in *ReconcileInvoicesRequest, opts ...grpc.CallOption) (*ReconcileInvoicesResponse, error) {
	out := new(ReconcileInvoicesResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/ReconcileInvoices", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *billingServiceClient) FinalizeInvoice(ctx context.Context, in *FinalizeInvoiceRequest, opts ...grpc.CallOption) (*FinalizeInvoiceResponse, error) {
	out := new(FinalizeInvoiceResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/FinalizeInvoice", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *billingServiceClient) CancelSubscription(ctx context.Context, in *CancelSubscriptionRequest, opts ...grpc.CallOption) (*CancelSubscriptionResponse, error) {
	out := new(CancelSubscriptionResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/CancelSubscription", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *billingServiceClient) GetStripeCustomer(ctx context.Context, in *GetStripeCustomerRequest, opts ...grpc.CallOption) (*GetStripeCustomerResponse, error) {
	out := new(GetStripeCustomerResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/GetStripeCustomer", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *billingServiceClient) CreateStripeCustomer(ctx context.Context, in *CreateStripeCustomerRequest, opts ...grpc.CallOption) (*CreateStripeCustomerResponse, error) {
	out := new(CreateStripeCustomerResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/CreateStripeCustomer", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *billingServiceClient) CreateStripeSubscription(ctx context.Context, in *CreateStripeSubscriptionRequest, opts ...grpc.CallOption) (*CreateStripeSubscriptionResponse, error) {
	out := new(CreateStripeSubscriptionResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/CreateStripeSubscription", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *billingServiceClient) GetPriceInformation(ctx context.Context, in *GetPriceInformationRequest, opts ...grpc.CallOption) (*GetPriceInformationResponse, error) {
	out := new(GetPriceInformationResponse)
	err := c.cc.Invoke(ctx, "/usage.v1.BillingService/GetPriceInformation", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// BillingServiceServer is the server API for BillingService service.
// All implementations must embed UnimplementedBillingServiceServer
// for forward compatibility
type BillingServiceServer interface {
	// ReconcileInvoices retrieves current credit balance and reflects it in billing system.
	// Internal RPC, not intended for general consumption.
	ReconcileInvoices(context.Context, *ReconcileInvoicesRequest) (*ReconcileInvoicesResponse, error)
	// FinalizeInvoice marks all sessions occurring in the given Stripe invoice as
	// having been invoiced.
	FinalizeInvoice(context.Context, *FinalizeInvoiceRequest) (*FinalizeInvoiceResponse, error)
	// CancelSubscription cancels a stripe subscription in our system
	// Called by a stripe webhook
	CancelSubscription(context.Context, *CancelSubscriptionRequest) (*CancelSubscriptionResponse, error)
	// GetStripeCustomer retrieves a Stripe Customer
	GetStripeCustomer(context.Context, *GetStripeCustomerRequest) (*GetStripeCustomerResponse, error)
	CreateStripeCustomer(context.Context, *CreateStripeCustomerRequest) (*CreateStripeCustomerResponse, error)
	CreateStripeSubscription(context.Context, *CreateStripeSubscriptionRequest) (*CreateStripeSubscriptionResponse, error)
	// GetPriceInformation returns the price information for a given attribtion id
	GetPriceInformation(context.Context, *GetPriceInformationRequest) (*GetPriceInformationResponse, error)
	mustEmbedUnimplementedBillingServiceServer()
}

// UnimplementedBillingServiceServer must be embedded to have forward compatible implementations.
type UnimplementedBillingServiceServer struct {
}

func (UnimplementedBillingServiceServer) ReconcileInvoices(context.Context, *ReconcileInvoicesRequest) (*ReconcileInvoicesResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ReconcileInvoices not implemented")
}
func (UnimplementedBillingServiceServer) FinalizeInvoice(context.Context, *FinalizeInvoiceRequest) (*FinalizeInvoiceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method FinalizeInvoice not implemented")
}
func (UnimplementedBillingServiceServer) CancelSubscription(context.Context, *CancelSubscriptionRequest) (*CancelSubscriptionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CancelSubscription not implemented")
}
func (UnimplementedBillingServiceServer) GetStripeCustomer(context.Context, *GetStripeCustomerRequest) (*GetStripeCustomerResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetStripeCustomer not implemented")
}
func (UnimplementedBillingServiceServer) CreateStripeCustomer(context.Context, *CreateStripeCustomerRequest) (*CreateStripeCustomerResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateStripeCustomer not implemented")
}
func (UnimplementedBillingServiceServer) CreateStripeSubscription(context.Context, *CreateStripeSubscriptionRequest) (*CreateStripeSubscriptionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateStripeSubscription not implemented")
}
func (UnimplementedBillingServiceServer) GetPriceInformation(context.Context, *GetPriceInformationRequest) (*GetPriceInformationResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetPriceInformation not implemented")
}
func (UnimplementedBillingServiceServer) mustEmbedUnimplementedBillingServiceServer() {}

// UnsafeBillingServiceServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to BillingServiceServer will
// result in compilation errors.
type UnsafeBillingServiceServer interface {
	mustEmbedUnimplementedBillingServiceServer()
}

func RegisterBillingServiceServer(s grpc.ServiceRegistrar, srv BillingServiceServer) {
	s.RegisterService(&BillingService_ServiceDesc, srv)
}

func _BillingService_ReconcileInvoices_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ReconcileInvoicesRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).ReconcileInvoices(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/ReconcileInvoices",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).ReconcileInvoices(ctx, req.(*ReconcileInvoicesRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BillingService_FinalizeInvoice_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(FinalizeInvoiceRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).FinalizeInvoice(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/FinalizeInvoice",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).FinalizeInvoice(ctx, req.(*FinalizeInvoiceRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BillingService_CancelSubscription_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CancelSubscriptionRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).CancelSubscription(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/CancelSubscription",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).CancelSubscription(ctx, req.(*CancelSubscriptionRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BillingService_GetStripeCustomer_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetStripeCustomerRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).GetStripeCustomer(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/GetStripeCustomer",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).GetStripeCustomer(ctx, req.(*GetStripeCustomerRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BillingService_CreateStripeCustomer_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateStripeCustomerRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).CreateStripeCustomer(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/CreateStripeCustomer",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).CreateStripeCustomer(ctx, req.(*CreateStripeCustomerRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BillingService_CreateStripeSubscription_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateStripeSubscriptionRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).CreateStripeSubscription(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/CreateStripeSubscription",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).CreateStripeSubscription(ctx, req.(*CreateStripeSubscriptionRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _BillingService_GetPriceInformation_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetPriceInformationRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(BillingServiceServer).GetPriceInformation(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: "/usage.v1.BillingService/GetPriceInformation",
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(BillingServiceServer).GetPriceInformation(ctx, req.(*GetPriceInformationRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// BillingService_ServiceDesc is the grpc.ServiceDesc for BillingService service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var BillingService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "usage.v1.BillingService",
	HandlerType: (*BillingServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "ReconcileInvoices",
			Handler:    _BillingService_ReconcileInvoices_Handler,
		},
		{
			MethodName: "FinalizeInvoice",
			Handler:    _BillingService_FinalizeInvoice_Handler,
		},
		{
			MethodName: "CancelSubscription",
			Handler:    _BillingService_CancelSubscription_Handler,
		},
		{
			MethodName: "GetStripeCustomer",
			Handler:    _BillingService_GetStripeCustomer_Handler,
		},
		{
			MethodName: "CreateStripeCustomer",
			Handler:    _BillingService_CreateStripeCustomer_Handler,
		},
		{
			MethodName: "CreateStripeSubscription",
			Handler:    _BillingService_CreateStripeSubscription_Handler,
		},
		{
			MethodName: "GetPriceInformation",
			Handler:    _BillingService_GetPriceInformation_Handler,
		},
	},
	Streams:  []grpc.StreamDesc{},
	Metadata: "usage/v1/billing.proto",
}
