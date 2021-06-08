// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"io"
	"testing"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

func TestObjectAccessToNonExistentObj(t *testing.T) {
	storage := objDoesNotExistGCloudStorage{
		Delegate: &DirectGCPStorage{
			WorkspaceName: "foobar",
			Stage:         StageDevStaging,
		},
	}
	var mappings []archive.IDMapping
	found, err := storage.Download(context.Background(), "/tmp", "foo", mappings)
	if err != nil {
		t.Errorf("%+v", err)
	}
	if found {
		t.Errorf("gcloud storage reported object found despite it being non-existent")
	}
}

type objDoesNotExistGCloudStorage struct {
	Delegate *DirectGCPStorage
}

// Init does nothing
func (rs *objDoesNotExistGCloudStorage) Init(ctx context.Context, owner, workspace, instance string) error {
	return rs.Delegate.Init(ctx, owner, workspace, instance)
}

// EnsureExists does nothing
func (rs *objDoesNotExistGCloudStorage) EnsureExists(ctx context.Context) error {
	return nil
}

// Download always returns false and does nothing
func (rs *objDoesNotExistGCloudStorage) Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	rs.Delegate.ObjectAccess = func(ctx context.Context, bkt, obj string) (io.ReadCloser, bool, error) {
		return nil, false, nil
	}

	return rs.Delegate.Download(ctx, destination, name, mappings)
}

// Download always returns false and does nothing
func (rs *objDoesNotExistGCloudStorage) DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	rs.Delegate.ObjectAccess = func(ctx context.Context, bkt, obj string) (io.ReadCloser, bool, error) {
		return nil, false, nil
	}

	return rs.Delegate.DownloadSnapshot(ctx, destination, name, mappings)
}

func (rs *objDoesNotExistGCloudStorage) Qualify(name string) string {
	return rs.Delegate.Qualify(name)
}

// Upload does nothing
func (rs *objDoesNotExistGCloudStorage) Upload(ctx context.Context, source string, name string, opts ...UploadOption) error {
	return xerrors.Errorf("not supported")
}
