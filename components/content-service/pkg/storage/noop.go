// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"

	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

var _ DirectAccess = &DirectNoopStorage{}

// DirectNoopStorage stores nothing, does nothing
type DirectNoopStorage struct{}

// Init does nothing
func (rs *DirectNoopStorage) Init(ctx context.Context, owner, workspace string) error {
	return nil
}

// EnsureExists does nothing
func (rs *DirectNoopStorage) EnsureExists(ctx context.Context) error {
	return nil
}

// Download always returns false and does nothing
func (rs *DirectNoopStorage) Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	return false, nil
}

// DownloadSnapshot always returns false and does nothing
func (rs *DirectNoopStorage) DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	return false, nil
}

// Qualify just returns the name
func (rs *DirectNoopStorage) Qualify(name string) string {
	return name
}

// Upload does nothing
func (rs *DirectNoopStorage) Upload(ctx context.Context, source string, name string, opts ...UploadOption) (string, string, error) {
	return "", "", nil
}

// Bucket returns an empty string
func (rs *DirectNoopStorage) Bucket(string) string {
	return ""
}

// BackupObject returns a backup's object name that a direct downloader would download
func (rs *DirectNoopStorage) BackupObject(name string) string {
	return ""
}

// SnapshotObject returns a snapshot's object name that a direct downloer would download
func (rs *DirectNoopStorage) SnapshotObject(name string) string {
	return ""
}

// PresignedNoopStorage does nothing
type PresignedNoopStorage struct{}

func (*PresignedNoopStorage) EnsureExists(ctx context.Context, ownerId string) (err error) {
	return nil
}

func (*PresignedNoopStorage) DiskUsage(ctx context.Context, bucket string, prefix string) (size int64, err error) {
	return 0, nil
}

// SignDownload returns ErrNotFound
func (*PresignedNoopStorage) SignDownload(ctx context.Context, bucket, obj string) (info *DownloadInfo, err error) {
	return nil, ErrNotFound
}

// SignUpload describes an object for upload
func (s *PresignedNoopStorage) SignUpload(ctx context.Context, bucket, obj string) (info *UploadInfo, err error) {
	return nil, ErrNotFound
}

// DeleteObject deletes objects in the given bucket specified by the given query
func (s *PresignedNoopStorage) DeleteObject(ctx context.Context, bucket string, query *DeleteObjectQuery) error {
	return nil
}

// Bucket returns an empty string
func (*PresignedNoopStorage) Bucket(string) string {
	return ""
}

// BlobObject returns a blob's object name
func (*PresignedNoopStorage) BlobObject(name string) (string, error) {
	return "", nil
}
