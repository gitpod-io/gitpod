// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

// Code generated by protoc-gen-connect-proxy. DO NOT EDIT.

package v1connect

import (
	context "context"
	connect_go "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

var _ TokensServiceHandler = (*ProxyTokensServiceHandler)(nil)

type ProxyTokensServiceHandler struct {
	Client v1.TokensServiceClient
	UnimplementedTokensServiceHandler
}

func (s *ProxyTokensServiceHandler) CreatePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.CreatePersonalAccessTokenRequest]) (*connect_go.Response[v1.CreatePersonalAccessTokenResponse], error) {
	resp, err := s.Client.CreatePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyTokensServiceHandler) GetPersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.GetPersonalAccessTokenRequest]) (*connect_go.Response[v1.GetPersonalAccessTokenResponse], error) {
	resp, err := s.Client.GetPersonalAccessToken(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyTokensServiceHandler) ListPersonalAccessTokens(ctx context.Context, req *connect_go.Request[v1.ListPersonalAccessTokensRequest]) (*connect_go.Response[v1.ListPersonalAccessTokensResponse], error) {
	resp, err := s.Client.ListPersonalAccessTokens(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyTokensServiceHandler) RegeneratePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.RegeneratePersonalAccessTokenRequest]) (*connect_go.Response[v1.RegeneratePersonalAccessTokenResponse], error) {
	resp, err := s.Client.RegeneratePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyTokensServiceHandler) UpdatePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.UpdatePersonalAccessTokenRequest]) (*connect_go.Response[v1.UpdatePersonalAccessTokenResponse], error) {
	resp, err := s.Client.UpdatePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyTokensServiceHandler) DeletePersonalAccessToken(ctx context.Context, req *connect_go.Request[v1.DeletePersonalAccessTokenRequest]) (*connect_go.Response[v1.DeletePersonalAccessTokenResponse], error) {
	resp, err := s.Client.DeletePersonalAccessToken(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}
