// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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

// Download always returns false and does nothing
func (rs *DirectNoopStorage) Download(ctx context.Context, destination string, name string) (bool, error) {
	return false, nil
}

// DownloadSnapshot always returns false and does nothing
func (rs *DirectNoopStorage) DownloadSnapshot(ctx context.Context, destination string, name string) (bool, error) {
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

// PresignedNoopStorage does nothing
type PresignedNoopStorage struct{}

// Download returns ErrNotFound
func (*PresignedNoopStorage) Download(ctx context.Context, bucket, obj string) (info *DownloadInfo, err error) {
	return nil, ErrNotFound
}

// Bucket returns an empty string
func (*PresignedNoopStorage) Bucket(string) string {
	return ""
}
