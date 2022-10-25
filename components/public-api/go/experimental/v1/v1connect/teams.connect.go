// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Code generated by protoc-gen-connect-go. DO NOT EDIT.
//
// Source: gitpod/experimental/v1/teams.proto

package v1connect

import (
	context "context"
	errors "errors"
	connect_go "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/public-api/experimental/v1"
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
	// TeamsServiceName is the fully-qualified name of the TeamsService service.
	TeamsServiceName = "gitpod.experimental.v1.TeamsService"
)

// TeamsServiceClient is a client for the gitpod.experimental.v1.TeamsService service.
type TeamsServiceClient interface {
	// CreateTeam creates a new Team.
	CreateTeam(context.Context, *connect_go.Request[v1.CreateTeamRequest]) (*connect_go.Response[v1.CreateTeamResponse], error)
}

// NewTeamsServiceClient constructs a client for the gitpod.experimental.v1.TeamsService service. By
// default, it uses the Connect protocol with the binary Protobuf Codec, asks for gzipped responses,
// and sends uncompressed requests. To use the gRPC or gRPC-Web protocols, supply the
// connect.WithGRPC() or connect.WithGRPCWeb() options.
//
// The URL supplied here should be the base URL for the Connect or gRPC server (for example,
// http://api.acme.com or https://acme.com/grpc).
func NewTeamsServiceClient(httpClient connect_go.HTTPClient, baseURL string, opts ...connect_go.ClientOption) TeamsServiceClient {
	baseURL = strings.TrimRight(baseURL, "/")
	return &teamsServiceClient{
		createTeam: connect_go.NewClient[v1.CreateTeamRequest, v1.CreateTeamResponse](
			httpClient,
			baseURL+"/gitpod.experimental.v1.TeamsService/CreateTeam",
			opts...,
		),
	}
}

// teamsServiceClient implements TeamsServiceClient.
type teamsServiceClient struct {
	createTeam *connect_go.Client[v1.CreateTeamRequest, v1.CreateTeamResponse]
}

// CreateTeam calls gitpod.experimental.v1.TeamsService.CreateTeam.
func (c *teamsServiceClient) CreateTeam(ctx context.Context, req *connect_go.Request[v1.CreateTeamRequest]) (*connect_go.Response[v1.CreateTeamResponse], error) {
	return c.createTeam.CallUnary(ctx, req)
}

// TeamsServiceHandler is an implementation of the gitpod.experimental.v1.TeamsService service.
type TeamsServiceHandler interface {
	// CreateTeam creates a new Team.
	CreateTeam(context.Context, *connect_go.Request[v1.CreateTeamRequest]) (*connect_go.Response[v1.CreateTeamResponse], error)
}

// NewTeamsServiceHandler builds an HTTP handler from the service implementation. It returns the
// path on which to mount the handler and the handler itself.
//
// By default, handlers support the Connect, gRPC, and gRPC-Web protocols with the binary Protobuf
// and JSON codecs. They also support gzip compression.
func NewTeamsServiceHandler(svc TeamsServiceHandler, opts ...connect_go.HandlerOption) (string, http.Handler) {
	mux := http.NewServeMux()
	mux.Handle("/gitpod.experimental.v1.TeamsService/CreateTeam", connect_go.NewUnaryHandler(
		"/gitpod.experimental.v1.TeamsService/CreateTeam",
		svc.CreateTeam,
		opts...,
	))
	return "/gitpod.experimental.v1.TeamsService/", mux
}

// UnimplementedTeamsServiceHandler returns CodeUnimplemented from all methods.
type UnimplementedTeamsServiceHandler struct{}

func (UnimplementedTeamsServiceHandler) CreateTeam(context.Context, *connect_go.Request[v1.CreateTeamRequest]) (*connect_go.Response[v1.CreateTeamResponse], error) {
	return nil, connect_go.NewError(connect_go.CodeUnimplemented, errors.New("gitpod.experimental.v1.TeamsService.CreateTeam is not implemented"))
}
