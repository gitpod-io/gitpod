// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/opentracing/opentracing-go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ContentService implements ContentServiceServer
type ContentService struct {
	cfg storage.Config
	s   storage.PresignedAccess
}

// NewContentService create a new content service
func NewContentService(cfg storage.Config) (res *ContentService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	return &ContentService{cfg, s}, nil
}

// UploadUrl provides a upload URL
func (cs *ContentService) UploadUrl(ctx context.Context, req *api.UploadUrlRequest) (resp *api.UploadUrlResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "UploadUrl")
	span.SetTag("user", req.OwnerId)
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	err = cs.s.EnsureExists(ctx, req.OwnerId)
	if err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}

	blobName, err := cs.s.BlobObject(req.Name)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	bucket := cs.s.Bucket(req.OwnerId)

	if cs.cfg.BlobQuota > 0 {
		prefix := strings.Split(blobName, "/")[0]
		size, err := cs.s.DiskUsage(ctx, bucket, prefix)

		if err != nil {
			return nil, status.Error(codes.Unknown, err.Error())
		}
		exceeded := size >= cs.cfg.BlobQuota
		log.WithFields(log.OWI(req.OwnerId, "", "")).Debugf("checking blob quota - quota: %d, size: %d, exceeded: %t", cs.cfg.BlobQuota, size, exceeded)
		if exceeded {
			return nil, status.Error(codes.ResourceExhausted, "quota exceeded")
		}
	} else {
		log.Debug("blob quota disabled")
	}

	info, err := cs.s.SignUpload(ctx, bucket, blobName, &storage.SignedURLOptions{
		ContentType: req.ContentType,
	})
	if err != nil {
		log.Error("error getting SignUpload URL: ", err)
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}

	return &api.UploadUrlResponse{
		Url: info.URL,
	}, nil
}

// DownloadUrl provides a download URL
func (cs *ContentService) DownloadUrl(ctx context.Context, req *api.DownloadUrlRequest) (resp *api.DownloadUrlResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "DownloadUrl")
	span.SetTag("user", req.OwnerId)
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	blobName, err := cs.s.BlobObject(req.Name)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	info, err := cs.s.SignDownload(ctx, cs.s.Bucket(req.OwnerId), blobName, &storage.SignedURLOptions{
		ContentType: req.ContentType,
	})
	if err != nil {
		log.Error("error getting SignDownload URL: ", err)
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}

	return &api.DownloadUrlResponse{
		Url: info.URL,
	}, nil
}

// Delete deletes the uploaded content
func (cs *ContentService) Delete(ctx context.Context, req *api.DeleteRequest) (resp *api.DeleteResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "Delete")
	span.SetTag("user", req.OwnerId)
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	var query *storage.DeleteObjectQuery
	exact := req.GetExact()
	prefix := req.GetPrefix()
	if exact != "" {
		exact, err = cs.s.BlobObject(exact)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		query = &storage.DeleteObjectQuery{Name: exact}
	} else if prefix != "" {
		prefix, err = cs.s.BlobObject(prefix)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		query = &storage.DeleteObjectQuery{Prefix: prefix}
	} else {
		return nil, status.Error(codes.InvalidArgument, "Name arg is missing")
	}

	bucket := cs.s.Bucket(req.OwnerId)

	err = cs.s.DeleteObject(ctx, bucket, query)
	if err != nil {
		return nil, err
	}
	resp = &api.DeleteResponse{}
	return resp, nil
}
