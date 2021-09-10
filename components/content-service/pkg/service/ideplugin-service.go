// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"

	"github.com/opentracing/opentracing-go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// IDEPluginService implements IDEPluginServiceServer
type IDEPluginService struct {
	cfg config.StorageConfig
	s   storage.PresignedAccess

	api.UnimplementedIDEPluginServiceServer
}

// NewIDEPluginService create a new IDE plugin service
func NewIDEPluginService(cfg config.StorageConfig) (res *IDEPluginService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	return &IDEPluginService{cfg: cfg, s: s}, nil
}

// UploadURL provides a URL to which clients can upload the content via HTTP PUT.
func (cs *IDEPluginService) UploadURL(ctx context.Context, req *api.PluginUploadURLRequest) (resp *api.PluginUploadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Plugin.UploadURL")
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	err = cs.s.EnsureExists(ctx, req.Bucket)
	if err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}

	info, err := cs.s.SignUpload(ctx, req.Bucket, req.Name, &storage.SignedURLOptions{
		ContentType: "*/*",
	})
	if err != nil {
		log.WithField("name", req.Name).
			WithField("bucket", req.Bucket).
			WithError(err).
			Error("error getting Plugin SignUpload URL")
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}
	return &api.PluginUploadURLResponse{Url: info.URL}, nil
}

// DownloadURL provides a URL from which clients can download the content via HTTP GET.
func (cs *IDEPluginService) DownloadURL(ctx context.Context, req *api.PluginDownloadURLRequest) (resp *api.PluginDownloadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Plugin.DownloadURL")
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	info, err := cs.s.SignDownload(ctx, req.Bucket, req.Name, &storage.SignedURLOptions{
		ContentType: "*/*",
	})
	if err != nil {
		log.WithField("name", req.Name).
			WithField("bucket", req.Bucket).
			WithError(err).
			Error("error getting Plugin SignDownload URL")
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}
	return &api.PluginDownloadURLResponse{Url: info.URL}, nil
}

// PluginHash provides a hash of the plugin
func (cs *IDEPluginService) PluginHash(ctx context.Context, req *api.PluginHashRequest) (resp *api.PluginHashResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Plugin.PluginHash")
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	hash, err := cs.s.ObjectHash(ctx, req.Bucket, req.Name)
	if err != nil {
		log.WithField("name", req.Name).
			WithField("bucket", req.Bucket).
			WithError(err).
			Error("error getting Plugin Hash")
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}
	return &api.PluginHashResponse{Hash: hash}, nil
}
