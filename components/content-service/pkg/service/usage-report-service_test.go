// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	storagemock "github.com/gitpod-io/gitpod/content-service/pkg/storage/mock"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
)

// TestUploadURL tests that usageReportService.UploadURL interacts with PresignedAccess
// correctly to produce an upload URL for the correct bucket and filename.
func TestUploadURL(t *testing.T) {
	const (
		fileName   = "some-report-filename"
		bucketName = "gitpod-usage-reports"
	)

	ctrl := gomock.NewController(t)
	s := storagemock.NewMockPresignedAccess(ctrl)

	s.EXPECT().EnsureExists(gomock.Any(), bucketName).
		Return(nil)
	s.EXPECT().SignUpload(gomock.Any(), bucketName, fileName, gomock.Any()).
		Return(&storage.UploadInfo{URL: "http://example.com/some-path"}, nil)

	svc := &UsageReportService{cfg: config.StorageConfig{}, s: s, bucketName: bucketName}
	resp, err := svc.UploadURL(context.Background(), &api.UsageReportUploadURLRequest{Name: fileName})

	require.NoError(t, err)
	require.Equal(t, "http://example.com/some-path", resp.Url)
}

func TestDownloadURL(t *testing.T) {
	const (
		fileName   = "some-report-filename"
		bucketName = "gitpod-usage-reports"
	)

	ctrl := gomock.NewController(t)
	s := storagemock.NewMockPresignedAccess(ctrl)

	s.EXPECT().EnsureExists(gomock.Any(), bucketName).
		Return(nil)
	s.EXPECT().SignDownload(gomock.Any(), bucketName, fileName, gomock.Any()).
		Return(&storage.DownloadInfo{URL: "http://example.com/some-path"}, nil)

	svc := &UsageReportService{cfg: config.StorageConfig{}, s: s, bucketName: bucketName}
	resp, err := svc.DownloadURL(context.Background(), &api.UsageReportDownloadURLRequest{Name: fileName})

	require.NoError(t, err)
	require.Equal(t, "http://example.com/some-path", resp.Url)
}
