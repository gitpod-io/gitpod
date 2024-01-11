// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-connect-go. DO NOT EDIT.
//
// Source: gitpod/experimental/v1/oidc.proto

package v1connect

import (
	context "context"
	errors "errors"
	connect_go "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	http "net/http"
	strings "strings"
)

// This is a compile-time assertion to ensure that this generated file and the connect package are
// compatible. If you get a compiler error that this constant is not defined, this code was
// generated with a version of connect newer than the one compiled into your binary. You can fix the
// problem by either regenerating this code with an older version of connect or updating the connect
// version compiled into your binary.
const _ = connect_go.IsAtLeastVersion0_1_0

const (
	// OIDCServiceName is the fully-qualified name of the OIDCService service.
	OIDCServiceName = "gitpod.experimental.v1.OIDCService"
)

// OIDCServiceClient is a client for the gitpod.experimental.v1.OIDCService service.
type OIDCServiceClient interface {
	// Creates a new OIDC client configuration.
	CreateClientConfig(context.Context, *connect_go.Request[v1.CreateClientConfigRequest]) (*connect_go.Response[v1.CreateClientConfigResponse], error)
	// Retrieves an OIDC client configuration by ID.
	GetClientConfig(context.Context, *connect_go.Request[v1.GetClientConfigRequest]) (*connect_go.Response[v1.GetClientConfigResponse], error)
	// Lists OIDC client configurations.
	ListClientConfigs(context.Context, *connect_go.Request[v1.ListClientConfigsRequest]) (*connect_go.Response[v1.ListClientConfigsResponse], error)
	// Updates modifiable properties of an existing OIDC client configuration.
	UpdateClientConfig(context.Context, *connect_go.Request[v1.UpdateClientConfigRequest]) (*connect_go.Response[v1.UpdateClientConfigResponse], error)
	// Removes an OIDC client configuration by ID.
	DeleteClientConfig(context.Context, *connect_go.Request[v1.DeleteClientConfigRequest]) (*connect_go.Response[v1.DeleteClientConfigResponse], error)
	// Activates an OIDC client configuration by ID.
	SetClientConfigActivation(context.Context, *connect_go.Request[v1.SetClientConfigActivationRequest]) (*connect_go.Response[v1.SetClientConfigActivationResponse], error)
}

// NewOIDCServiceClient constructs a client for the gitpod.experimental.v1.OIDCService service. By
// default, it uses the Connect protocol with the binary Protobuf Codec, asks for gzipped responses,
// and sends uncompressed requests. To use the gRPC or gRPC-Web protocols, supply the
// connect.WithGRPC() or connect.WithGRPCWeb() options.
//
// The URL supplied here should be the base URL for the Connect or gRPC server (for example,
// http://api.acme.com or https://acme.com/grpc).
func NewOIDCServiceClient(httpClient connect_go.HTTPClient, baseURL string, opts ...connect_go.ClientOption) OIDCServiceClient {
	baseURL = strings.TrimRight(baseURL, "/")
	return &oIDCServiceClient{
		createClientConfig: connect_go.NewClient[v1.CreateClientConfigRequest, v1.CreateClientConfigResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.OIDCService/CreateClientConfig",
			opts...,
		),
		getClientConfig: connect_go.NewClient[v1.GetClientConfigRequest, v1.GetClientConfigResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.OIDCService/GetClientConfig",
			opts...,
		),
		listClientConfigs: connect_go.NewClient[v1.ListClientConfigsRequest, v1.ListClientConfigsResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.OIDCService/ListClientConfigs",
			opts...,
		),
		updateClientConfig: connect_go.NewClient[v1.UpdateClientConfigRequest, v1.UpdateClientConfigResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.OIDCService/UpdateClientConfig",
			opts...,
		),
		deleteClientConfig: connect_go.NewClient[v1.DeleteClientConfigRequest, v1.DeleteClientConfigResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.OIDCService/DeleteClientConfig",
			opts...,
		),
		setClientConfigActivation: connect_go.NewClient[v1.SetClientConfigActivationRequest, v1.SetClientConfigActivationResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.OIDCService/SetClientConfigActivation",
			opts...,
		),
	}
}

// oIDCServiceClient implements OIDCServiceClient.
type oIDCServiceClient struct {
	createClientConfig        *connect_go.Client[v1.CreateClientConfigRequest, v1.CreateClientConfigResponse]
	getClientConfig           *connect_go.Client[v1.GetClientConfigRequest, v1.GetClientConfigResponse]
	listClientConfigs         *connect_go.Client[v1.ListClientConfigsRequest, v1.ListClientConfigsResponse]
	updateClientConfig        *connect_go.Client[v1.UpdateClientConfigRequest, v1.UpdateClientConfigResponse]
	deleteClientConfig        *connect_go.Client[v1.DeleteClientConfigRequest, v1.DeleteClientConfigResponse]
	setClientConfigActivation *connect_go.Client[v1.SetClientConfigActivationRequest, v1.SetClientConfigActivationResponse]
}

// CreateClientConfig calls gitpod.experimental.v1.OIDCService.CreateClientConfig.
func (c *oIDCServiceClient) CreateClientConfig(ctx context.Context, req *connect_go.Request[v1.CreateClientConfigRequest]) (*connect_go.Response[v1.CreateClientConfigResponse], error) {
	return c.createClientConfig.CallUnary(ctx, req)
}

// GetClientConfig calls gitpod.experimental.v1.OIDCService.GetClientConfig.
func (c *oIDCServiceClient) GetClientConfig(ctx context.Context, req *connect_go.Request[v1.GetClientConfigRequest]) (*connect_go.Response[v1.GetClientConfigResponse], error) {
	return c.getClientConfig.CallUnary(ctx, req)
}

// ListClientConfigs calls gitpod.experimental.v1.OIDCService.ListClientConfigs.
func (c *oIDCServiceClient) ListClientConfigs(ctx context.Context, req *connect_go.Request[v1.ListClientConfigsRequest]) (*connect_go.Response[v1.ListClientConfigsResponse], error) {
	return c.listClientConfigs.CallUnary(ctx, req)
}

// UpdateClientConfig calls gitpod.experimental.v1.OIDCService.UpdateClientConfig.
func (c *oIDCServiceClient) UpdateClientConfig(ctx context.Context, req *connect_go.Request[v1.UpdateClientConfigRequest]) (*connect_go.Response[v1.UpdateClientConfigResponse], error) {
	return c.updateClientConfig.CallUnary(ctx, req)
}

// DeleteClientConfig calls gitpod.experimental.v1.OIDCService.DeleteClientConfig.
func (c *oIDCServiceClient) DeleteClientConfig(ctx context.Context, req *connect_go.Request[v1.DeleteClientConfigRequest]) (*connect_go.Response[v1.DeleteClientConfigResponse], error) {
	return c.deleteClientConfig.CallUnary(ctx, req)
}

// SetClientConfigActivation calls gitpod.experimental.v1.OIDCService.SetClientConfigActivation.
func (c *oIDCServiceClient) SetClientConfigActivation(ctx context.Context, req *connect_go.Request[v1.SetClientConfigActivationRequest]) (*connect_go.Response[v1.SetClientConfigActivationResponse], error) {
	return c.setClientConfigActivation.CallUnary(ctx, req)
}

// OIDCServiceHandler is an implementation of the gitpod.experimental.v1.OIDCService service.
type OIDCServiceHandler interface {
	// Creates a new OIDC client configuration.
	CreateClientConfig(context.Context, *connect_go.Request[v1.CreateClientConfigRequest]) (*connect_go.Response[v1.CreateClientConfigResponse], error)
	// Retrieves an OIDC client configuration by ID.
	GetClientConfig(context.Context, *connect_go.Request[v1.GetClientConfigRequest]) (*connect_go.Response[v1.GetClientConfigResponse], error)
	// Lists OIDC client configurations.
	ListClientConfigs(context.Context, *connect_go.Request[v1.ListClientConfigsRequest]) (*connect_go.Response[v1.ListClientConfigsResponse], error)
	// Updates modifiable properties of an existing OIDC client configuration.
	UpdateClientConfig(context.Context, *connect_go.Request[v1.UpdateClientConfigRequest]) (*connect_go.Response[v1.UpdateClientConfigResponse], error)
	// Removes an OIDC client configuration by ID.
	DeleteClientConfig(context.Context, *connect_go.Request[v1.DeleteClientConfigRequest]) (*connect_go.Response[v1.DeleteClientConfigResponse], error)
	// Activates an OIDC client configuration by ID.
	SetClientConfigActivation(context.Context, *connect_go.Request[v1.SetClientConfigActivationRequest]) (*connect_go.Response[v1.SetClientConfigActivationResponse], error)
}

// NewOIDCServiceHandler builds an HTTP handler from the service implementation. It returns the path
// on which to mount the handler and the handler itself.
//
// By default, handlers support the Connect, gRPC, and gRPC-Web protocols with the binary Protobuf
// and JSON codecs. They also support gzip compression.
func NewOIDCServiceHandler(svc OIDCServiceHandler, opts ...connect_go.HandlerOption) (string, http.Handler) {
	mux := http.NewServeMux()
	mux.Handle("/gitpod.experimental.v1.OIDCService/CreateClientConfig", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.OIDCService/CreateClientConfig",
		svc.CreateClientConfig,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.OIDCService/GetClientConfig", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.OIDCService/GetClientConfig",
		svc.GetClientConfig,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.OIDCService/ListClientConfigs", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.OIDCService/ListClientConfigs",
		svc.ListClientConfigs,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.OIDCService/UpdateClientConfig", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.OIDCService/UpdateClientConfig",
		svc.UpdateClientConfig,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.OIDCService/DeleteClientConfig", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.OIDCService/DeleteClientConfig",
		svc.DeleteClientConfig,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.OIDCService/SetClientConfigActivation", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.OIDCService/SetClientConfigActivation",
		svc.SetClientConfigActivation,
		opts...,
	))
	return "/gitpod.experimental.v1.OIDCService/", mux
}

// UnimplementedOIDCServiceHandler returns CodeUnimplemented from all methods.
type UnimplementedOIDCServiceHandler struct{}

func (UnimplementedOIDCServiceHandler) CreateClientConfig(context.Context, *connect_go.Request[v1.CreateClientConfigRequest]) (*connect_go.Response[v1.CreateClientConfigResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.CreateClientConfig is not implemented"))
}

func (UnimplementedOIDCServiceHandler) GetClientConfig(context.Context, *connect_go.Request[v1.GetClientConfigRequest]) (*connect_go.Response[v1.GetClientConfigResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.GetClientConfig is not implemented"))
}

func (UnimplementedOIDCServiceHandler) ListClientConfigs(context.Context, *connect_go.Request[v1.ListClientConfigsRequest]) (*connect_go.Response[v1.ListClientConfigsResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.ListClientConfigs is not implemented"))
}

func (UnimplementedOIDCServiceHandler) UpdateClientConfig(context.Context, *connect_go.Request[v1.UpdateClientConfigRequest]) (*connect_go.Response[v1.UpdateClientConfigResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.UpdateClientConfig is not implemented"))
}

func (UnimplementedOIDCServiceHandler) DeleteClientConfig(context.Context, *connect_go.Request[v1.DeleteClientConfigRequest]) (*connect_go.Response[v1.DeleteClientConfigResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.DeleteClientConfig is not implemented"))
}

func (UnimplementedOIDCServiceHandler) SetClientConfigActivation(context.Context, *connect_go.Request[v1.SetClientConfigActivationRequest]) (*connect_go.Response[v1.SetClientConfigActivationResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.SetClientConfigActivation is not implemented"))
}
