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

var _ IDEClientServiceHandler = (*ProxyIDEClientServiceHandler)(nil)

type ProxyIDEClientServiceHandler struct {
	Client v1.IDEClientServiceClient
	UnimplementedIDEClientServiceHandler
}

func (s *ProxyIDEClientServiceHandler) SendHeartbeat(ctx context.Context, req *connect_go.Request[v1.SendHeartbeatRequest]) (*connect_go.Response[v1.SendHeartbeatResponse], error) {
	resp, err := s.Client.SendHeartbeat(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}

func (s *ProxyIDEClientServiceHandler) SendDidClose(ctx context.Context, req *connect_go.Request[v1.SendDidCloseRequest]) (*connect_go.Response[v1.SendDidCloseResponse], error) {
	resp, err := s.Client.SendDidClose(ctx, req.Msg)
	if err != nil {
		// TODO(milan): Convert to correct status code
		return nil, err
	}

	return connect_go.NewResponse(resp), nil

}
