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

// ContentService implements ContentServiceServer
type ContentService struct {
	cfg config.StorageConfig
	s   storage.PresignedAccess

	api.UnimplementedContentServiceServer
}

// NewContentService create a new content service
func NewContentService(cfg config.StorageConfig) (res *ContentService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	return &ContentService{cfg: cfg, s: s}, nil
}

// DeleteUserContent deletes all content associated with a user.
func (cs *ContentService) DeleteUserContent(ctx context.Context, req *api.DeleteUserContentRequest) (resp *api.DeleteUserContentResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "DeleteUserContent")
	span.SetTag("user", req.OwnerId)
	defer tracing.FinishSpan(span, &err)

	bucket := cs.s.Bucket(req.OwnerId)
	err = cs.s.DeleteBucket(ctx, bucket)
	if err == storage.ErrNotFound {
		log.WithFields(log.OWI(req.OwnerId, "", "")).WithError(err).Error("DeleteUserContent: NotFound")
		return &api.DeleteUserContentResponse{}, nil
	}
	if err != nil {
		log.WithFields(log.OWI(req.OwnerId, "", "")).WithError(err).Error("DeleteUserContent: failed")
		return nil, status.Error(codes.Unknown, err.Error())
	}
	log.WithFields(log.OWI(req.OwnerId, "", "")).Debug("DeleteUserContent: done")
	return &api.DeleteUserContentResponse{}, nil
}
