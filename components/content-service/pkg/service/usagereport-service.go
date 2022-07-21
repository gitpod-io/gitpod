// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
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

const (
	bucketName = "usage-reports"
)

// UsageReportService implements UsageReportServiceServer
type UsageReportService struct {
	cfg config.StorageConfig
	s   storage.PresignedAccess

	api.UnimplementedUsageReportServiceServer
}

// NewUsageReportService create a new usagereport service
func NewUsageReportService(cfg config.StorageConfig) (res *UsageReportService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	return &UsageReportService{cfg: cfg, s: s}, nil
}

// UploadURL provides a URL to which clients can upload the content via HTTP PUT.
func (us *UsageReportService) UploadURL(ctx context.Context, req *api.UsageReportUploadURLRequest) (resp *api.UsageReportUploadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "UsageReport.UploadURL")
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	err = us.s.EnsureExists(ctx, bucketName)
	if err != nil {
		return nil, status.Error(codes.NotFound, err.Error())
	}

	info, err := us.s.SignUpload(ctx, bucketName, req.Name, &storage.SignedURLOptions{
		ContentType: "*/*",
	})
	if err != nil {
		log.WithField("name", req.Name).
			WithField("bucket", bucketName).
			WithError(err).
			Error("Error getting UsageReport SignUpload URL")
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}
	return &api.UsageReportUploadURLResponse{Url: info.URL}, nil
}
