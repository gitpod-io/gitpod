// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"errors"
	"io"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/api"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
			return handleProxyError(err)
		}

		// generic hack, can't compare R to nil because R's default value is unclear (not even sure this is nil)
		// But, we can get the default value which will be nil because underneath R is an interface.
		var defaultResp R
		if resp == defaultResp {
			break
		}
		err = send(resp)
		if err != nil {
			return handleProxyError(err)
		}
	}

	return nil
}

// handleProxyError ensures all errors have proper gRPC status codes
func handleProxyError(err error) error {
	if err == nil {
		return nil
	}

	// If it's already a gRPC status error, check for DeadlineExceeded
	if st, ok := status.FromError(err); ok {
		if st.Code() == codes.DeadlineExceeded {
			// Return nil (OK) for DeadlineExceeded as requested
			return nil
		}

		log.WithError(err).WithField("code", status.Code(err)).Error("unexpected error while sending stream response upstream")
		return err
	}

	// Handle context errors
	if errors.Is(err, context.DeadlineExceeded) {
		// Return nil (OK) for DeadlineExceeded
		return nil
	}

	if errors.Is(err, io.EOF) {
		// Return nil (OK) for EOF, which is a normal when the client ends the stream
		return nil
	}

	log.WithError(err).Error("unexpected error while sending stream response upstream")

	if errors.Is(err, context.Canceled) {
		return status.Error(codes.Canceled, err.Error())
	}

	// Wrap any other error as Internal
	return status.Error(codes.Internal, err.Error())
}
