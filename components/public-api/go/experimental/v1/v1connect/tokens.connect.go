// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-connect-go. DO NOT EDIT.
//
// Source: gitpod/experimental/v1/tokens.proto

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
	// TokensServiceName is the fully-qualified name of the TokensService service.
	TokensServiceName = "gitpod.experimental.v1.TokensService"
)

// TokensServiceClient is a client for the gitpod.experimental.v1.TokensService service.
type TokensServiceClient interface {
	// CreatePersonalAccessTokenRequest creates a new token.
	CreatePersonalAccessToken(context.Context, *connect_go.Request[v1.CreatePersonalAccessTokenRequest]) (*connect_go.Response[v1.CreatePersonalAccessTokenResponse], error)
	// ListPersonalAccessTokens returns token by ID.
	GetPersonalAccessToken(context.Context, *connect_go.Request[v1.GetPersonalAccessTokenRequest]) (*connect_go.Response[v1.GetPersonalAccessTokenResponse], error)
	// ListPersonalAccessTokens returns a list of tokens.
	ListPersonalAccessTokens(context.Context, *connect_go.Request[v1.ListPersonalAccessTokensRequest]) (*connect_go.Response[v1.ListPersonalAccessTokensResponse], error)
	// RegeneratePersonalAccessToken generates a new token and replaces the previous one.
	RegeneratePersonalAccessToken(context.Context, *connect_go.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect_go.Response[v1.RegeneratePersonalAccessTokenResponse], error)
	// UpdatePersonalAccessToken updates writable properties of a PersonalAccessToken.
	UpdatePersonalAccessToken(context.Context, *connect_go.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect_go.Response[v1.UpdatePersonalAccessTokenResponse], error)
	// DeletePersonalAccessToken removes token by ID.
	DeletePersonalAccessToken(context.Context, *connect_go.Request[v1.DeletePersonalAccessTokenRequest]) (*connect_go.Response[v1.DeletePersonalAccessTokenResponse], error)
}

// NewTokensServiceClient constructs a client for the gitpod.experimental.v1.TokensService service.
// By default, it uses the Connect protocol with the binary Protobuf Codec, asks for gzipped
// responses, and sends uncompressed requests. To use the gRPC or gRPC-Web protocols, supply the
// connect.WithGRPC() or connect.WithGRPCWeb() options.
//
// The URL supplied here should be the base URL for the Connect or gRPC server (for example,
// http://api.acme.com or https://acme.com/grpc).
func NewTokensServiceClient(httpClient connect_go.HTTPClient, baseURL string, opts ...connect_go.ClientOption) TokensServiceClient {
	baseURL = strings.TrimRight(baseURL, "/")
	return &tokensServiceClient{
		createPersonalAccessToken: connect_go.NewClient[v1.CreatePersonalAccessTokenRequest, v1.CreatePersonalAccessTokenResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TokensService/CreatePersonalAccessToken",
			opts...,
		),
		getPersonalAccessToken: connect_go.NewClient[v1.GetPersonalAccessTokenRequest, v1.GetPersonalAccessTokenResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TokensService/GetPersonalAccessToken",
			opts...,
		),
		listPersonalAccessTokens: connect_go.NewClient[v1.ListPersonalAccessTokensRequest, v1.ListPersonalAccessTokensResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TokensService/ListPersonalAccessTokens",
			opts...,
		),
		regeneratePersonalAccessToken: connect_go.NewClient[v1.RegeneratePersonalAccessTokenRequest, v1.RegeneratePersonalAccessTokenResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TokensService/RegeneratePersonalAccessToken",
			opts...,
		),
		updatePersonalAccessToken: connect_go.NewClient[v1.UpdatePersonalAccessTokenRequest, v1.UpdatePersonalAccessTokenResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TokensService/UpdatePersonalAccessToken",
			opts...,
		),
		deletePersonalAccessToken: connect_go.NewClient[v1.DeletePersonalAccessTokenRequest, v1.DeletePersonalAccessTokenResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TokensService/DeletePersonalAccessToken",
			opts...,
		),
	}
}

// tokensServiceClient implements TokensServiceClient.
type tokensServiceClient struct {
	createPersonalAccessToken     *connect_go.Client[v1.CreatePersonalAccessTokenRequest, v1.CreatePersonalAccessTokenResponse]
	getPersonalAccessToken        *connect_go.Client[v1.GetPersonalAccessTokenRequest, v1.GetPersonalAccessTokenResponse]
	listPersonalAccessTokens      *connect_go.Client[v1.ListPersonalAccessTokensRequest, v1.ListPersonalAccessTokensResponse]
	regeneratePersonalAccessToken *connect_go.Client[v1.RegeneratePersonalAccessTokenRequest, v1.RegeneratePersonalAccessTokenResponse]
	updatePersonalAccessToken     *connect_go.Client[v1.UpdatePersonalAccessTokenRequest, v1.UpdatePersonalAccessTokenResponse]
	deletePersonalAccessToken     *connect_go.Client[v1.DeletePersonalAccessTokenRequest, v1.DeletePersonalAccessTokenResponse]
}

// CreatePersonalAccessToken calls gitpod.experimental.v1.TokensService.CreatePersonalAccessToken.
func (c *tokensServiceClient) CreatePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.CreatePersonalAccessTokenRequest]) (*connect_go.Response[v1.CreatePersonalAccessTokenResponse], error) {
	return c.createPersonalAccessToken.CallUnary(ctx, req)
}

// GetPersonalAccessToken calls gitpod.experimental.v1.TokensService.GetPersonalAccessToken.
func (c *tokensServiceClient) GetPersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.GetPersonalAccessTokenRequest]) (*connect_go.Response[v1.GetPersonalAccessTokenResponse], error) {
	return c.getPersonalAccessToken.CallUnary(ctx, req)
}

// ListPersonalAccessTokens calls gitpod.experimental.v1.TokensService.ListPersonalAccessTokens.
func (c *tokensServiceClient) ListPersonalAccessTokens(ctx context.Context, req *connect_go.Request[v1.ListPersonalAccessTokensRequest]) (*connect_go.Response[v1.ListPersonalAccessTokensResponse], error) {
	return c.listPersonalAccessTokens.CallUnary(ctx, req)
}

// RegeneratePersonalAccessToken calls
// gitpod.experimental.v1.TokensService.RegeneratePersonalAccessToken.
func (c *tokensServiceClient) RegeneratePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect_go.Response[v1.RegeneratePersonalAccessTokenResponse], error) {
	return c.regeneratePersonalAccessToken.CallUnary(ctx, req)
}

// UpdatePersonalAccessToken calls gitpod.experimental.v1.TokensService.UpdatePersonalAccessToken.
func (c *tokensServiceClient) UpdatePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect_go.Response[v1.UpdatePersonalAccessTokenResponse], error) {
	return c.updatePersonalAccessToken.CallUnary(ctx, req)
}

// DeletePersonalAccessToken calls gitpod.experimental.v1.TokensService.DeletePersonalAccessToken.
func (c *tokensServiceClient) DeletePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.DeletePersonalAccessTokenRequest]) (*connect_go.Response[v1.DeletePersonalAccessTokenResponse], error) {
	return c.deletePersonalAccessToken.CallUnary(ctx, req)
}

// TokensServiceHandler is an implementation of the gitpod.experimental.v1.TokensService service.
type TokensServiceHandler interface {
	// CreatePersonalAccessTokenRequest creates a new token.
	CreatePersonalAccessToken(context.Context, *connect_go.Request[v1.CreatePersonalAccessTokenRequest]) (*connect_go.Response[v1.CreatePersonalAccessTokenResponse], error)
	// ListPersonalAccessTokens returns token by ID.
	GetPersonalAccessToken(context.Context, *connect_go.Request[v1.GetPersonalAccessTokenRequest]) (*connect_go.Response[v1.GetPersonalAccessTokenResponse], error)
	// ListPersonalAccessTokens returns a list of tokens.
	ListPersonalAccessTokens(context.Context, *connect_go.Request[v1.ListPersonalAccessTokensRequest]) (*connect_go.Response[v1.ListPersonalAccessTokensResponse], error)
	// RegeneratePersonalAccessToken generates a new token and replaces the previous one.
	RegeneratePersonalAccessToken(context.Context, *connect_go.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect_go.Response[v1.RegeneratePersonalAccessTokenResponse], error)
	// UpdatePersonalAccessToken updates writable properties of a PersonalAccessToken.
	UpdatePersonalAccessToken(context.Context, *connect_go.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect_go.Response[v1.UpdatePersonalAccessTokenResponse], error)
	// DeletePersonalAccessToken removes token by ID.
	DeletePersonalAccessToken(context.Context, *connect_go.Request[v1.DeletePersonalAccessTokenRequest]) (*connect_go.Response[v1.DeletePersonalAccessTokenResponse], error)
}

// NewTokensServiceHandler builds an HTTP handler from the service implementation. It returns the
// path on which to mount the handler and the handler itself.
//
// By default, handlers support the Connect, gRPC, and gRPC-Web protocols with the binary Protobuf
// and JSON codecs. They also support gzip compression.
func NewTokensServiceHandler(svc TokensServiceHandler, opts ...connect_go.HandlerOption) (string, http.Handler) {
	mux := http.NewServeMux()
	mux.Handle("/gitpod.experimental.v1.TokensService/CreatePersonalAccessToken", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TokensService/CreatePersonalAccessToken",
		svc.CreatePersonalAccessToken,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.TokensService/GetPersonalAccessToken", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TokensService/GetPersonalAccessToken",
		svc.GetPersonalAccessToken,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.TokensService/ListPersonalAccessTokens", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TokensService/ListPersonalAccessTokens",
		svc.ListPersonalAccessTokens,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.TokensService/RegeneratePersonalAccessToken", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TokensService/RegeneratePersonalAccessToken",
		svc.RegeneratePersonalAccessToken,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.TokensService/UpdatePersonalAccessToken", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TokensService/UpdatePersonalAccessToken",
		svc.UpdatePersonalAccessToken,
		opts...,
	))
	mux.Handle("/gitpod.experimental.v1.TokensService/DeletePersonalAccessToken", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TokensService/DeletePersonalAccessToken",
		svc.DeletePersonalAccessToken,
		opts...,
	))
	return "/gitpod.experimental.v1.TokensService/", mux
}

// UnimplementedTokensServiceHandler returns CodeUnimplemented from all methods.
type UnimplementedTokensServiceHandler struct{}

func (UnimplementedTokensServiceHandler) CreatePersonalAccessToken(context.Context, *connect_go.Request[v1.CreatePersonalAccessTokenRequest]) (*connect_go.Response[v1.CreatePersonalAccessTokenResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.CreatePersonalAccessToken is not implemented"))
}

func (UnimplementedTokensServiceHandler) GetPersonalAccessToken(context.Context, *connect_go.Request[v1.GetPersonalAccessTokenRequest]) (*connect_go.Response[v1.GetPersonalAccessTokenResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.GetPersonalAccessToken is not implemented"))
}

func (UnimplementedTokensServiceHandler) ListPersonalAccessTokens(context.Context, *connect_go.Request[v1.ListPersonalAccessTokensRequest]) (*connect_go.Response[v1.ListPersonalAccessTokensResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.ListPersonalAccessTokens is not implemented"))
}

func (UnimplementedTokensServiceHandler) RegeneratePersonalAccessToken(context.Context, *connect_go.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect_go.Response[v1.RegeneratePersonalAccessTokenResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.RegeneratePersonalAccessToken is not implemented"))
}

func (UnimplementedTokensServiceHandler) UpdatePersonalAccessToken(context.Context, *connect_go.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect_go.Response[v1.UpdatePersonalAccessTokenResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.UpdatePersonalAccessToken is not implemented"))
}

func (UnimplementedTokensServiceHandler) DeletePersonalAccessToken(context.Context, *connect_go.Request[v1.DeletePersonalAccessTokenRequest]) (*connect_go.Response[v1.DeletePersonalAccessTokenResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TokensService.DeletePersonalAccessToken is not implemented"))
}
