// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"

	"github.com/gitpod-io/gitpod/image-builder/api"
	"google.golang.org/protobuf/proto"
)

type ImageBuilder struct {
	D api.ImageBuilderClient

	api.UnimplementedImageBuilderServer
}

func (p ImageBuilder) ResolveBaseImage(ctx context.Context, req *api.ResolveBaseImageRequest) (*api.ResolveBaseImageResponse, error) {
	return p.D.ResolveBaseImage(ctx, req)
}

func (p ImageBuilder) ResolveWorkspaceImage(ctx context.Context, req *api.ResolveWorkspaceImageRequest) (*api.ResolveWorkspaceImageResponse, error) {
	return p.D.ResolveWorkspaceImage(ctx, req)
}

func (p ImageBuilder) Build(req *api.BuildRequest, srv api.ImageBuilder_BuildServer) error {
	c, err := p.D.Build(srv.Context(), req)
	if err != nil {
		return err
	}
	defer c.CloseSend()

	return forwardStream(srv.Context(), c.Recv, srv.Send)
}

func (p ImageBuilder) Logs(req *api.LogsRequest, srv api.ImageBuilder_LogsServer) error {
	c, err := p.D.Logs(srv.Context(), req)
	if err != nil {
		return err
	}
	defer c.CloseSend()

	return forwardStream(srv.Context(), c.Recv, srv.Send)
}

func (p ImageBuilder) ListBuilds(ctx context.Context, req *api.ListBuildsRequest) (*api.ListBuildsResponse, error) {
	return p.D.ListBuilds(ctx, req)
}

type ProtoMessage interface {
	proto.Message
	comparable
}

func forwardStream[R ProtoMessage](ctx context.Context, recv func() (R, error), send func(R) error) error {
	for {
		resp, err := recv()
		if err != nil {
			return err
		}

		// generic hack, can't compare R to nil because R's default value is unclear (not even sure this is nil)
		// But, we can get the default value which will be nil because underneath R is an interface.
		var defaultResp R
		if resp == defaultResp {
			break
		}
		err = send(resp)
		if err != nil {
			return err
		}
	}

	return nil
}
