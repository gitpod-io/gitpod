// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
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

// DownloadLatestWsSnapshot always returns false and does nothing
func (rs *DirectNoopStorage) DownloadLatestWsSnapshot(ctx context.Context, destination string, name string) (bool, error) {
	return false, nil
}

// DownloadWsSnapshot always returns false and does nothing
func (rs *DirectNoopStorage) DownloadWsSnapshot(ctx context.Context, destination string, name string) (bool, error) {
	return false, nil
}

// QualifyWsSnapshot just returns the name
func (rs *DirectNoopStorage) QualifyWsSnapshot(name string) string {
	return name
}

// UploadWsSnapshot does nothing
func (rs *DirectNoopStorage) UploadWsSnapshot(ctx context.Context, source string, name string, opts ...UploadOption) (string, string, error) {
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

// SignDownload returns ErrNotFound
func (*PresignedNoopStorage) SignDownload(ctx context.Context, bucket, obj string) (info *DownloadInfo, err error) {
	return nil, ErrNotFound
}

// Bucket returns an empty string
func (*PresignedNoopStorage) Bucket(string) string {
	return ""
}
