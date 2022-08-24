// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"errors"
	"github.com/opentracing/opentracing-go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// UsageReportService implements UsageReportServiceServer
type UsageReportService struct {
	cfg        config.StorageConfig
	s          storage.PresignedAccess
	bucketName string

	api.UnimplementedUsageReportServiceServer
}

// NewUsageReportService create a new usagereport service
func NewUsageReportService(cfg config.StorageConfig, bucketName string) (res *UsageReportService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	return &UsageReportService{cfg: cfg, s: s, bucketName: bucketName}, nil
}

// UploadURL provides a URL to which clients can upload the content via HTTP PUT.
func (us *UsageReportService) UploadURL(ctx context.Context, req *api.UsageReportUploadURLRequest) (resp *api.UsageReportUploadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "UsageReport.UploadURL")
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	if req.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "Name is required but got empty.")
	}

	logger := log.WithField("name", req.Name).
		WithField("bucket", us.bucketName)

	err = us.ensureBucketExists(ctx)
	if err != nil {
		return nil, err
	}

	info, err := us.s.SignUpload(ctx, us.bucketName, req.Name, &storage.SignedURLOptions{
		ContentType: "application/json",
	})
	if err != nil {
		logger.WithError(err).Error("Error getting UsageReport SignUpload URL")
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &api.UsageReportUploadURLResponse{Url: info.URL}, nil
}

func (us *UsageReportService) DownloadURL(ctx context.Context, req *api.UsageReportDownloadURLRequest) (resp *api.UsageReportDownloadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "UsageReport.DownloadURL")
	span.SetTag("name", req.Name)
	defer tracing.FinishSpan(span, &err)

	if req.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "Name is required but got empty.")
	}

	err = us.ensureBucketExists(ctx)
	if err != nil {
		return nil, err
	}

	download, err := us.s.SignDownload(ctx, us.bucketName, req.GetName(), &storage.SignedURLOptions{
		ContentType: "application/json",
	})
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return nil, status.Errorf(codes.NotFound, "Object %s does not exist.", req.GetName())
		}

		return nil, status.Errorf(codes.Internal, "Failed to generate download URL for usage report: %s", err.Error())
	}

	return &api.UsageReportDownloadURLResponse{
		Url: download.URL,
	}, nil
}

func (us *UsageReportService) ensureBucketExists(ctx context.Context) error {
	err := us.s.EnsureExists(ctx, us.bucketName)
	if err != nil {
		log.WithError(err).Errorf("Bucket %s does not exist", us.bucketName)
		return status.Error(codes.Internal, err.Error())
	}

	return nil
}
