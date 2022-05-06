// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"testing"

	"cloud.google.com/go/storage"
	"github.com/fsouza/fake-gcs-server/fakestorage"
	"google.golang.org/api/option"

	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

func TestObjectAccessToNonExistentObj(t *testing.T) {
	server := *fakestorage.NewServer([]fakestorage.Object{})
	defer server.Stop()

	args := []option.ClientOption{
		option.WithoutAuthentication(),
		option.WithEndpoint(server.URL()),
		option.WithHTTPClient(server.HTTPClient()),
	}

	ctx, cancelFunc := context.WithCancel(context.Background())
	defer cancelFunc()

	client, err := storage.NewClient(ctx, args...)
	if err != nil {
		t.Errorf("error creating GCS gcsClient: %v", err)
	}

	storage := DirectGCPStorage{
		WorkspaceName: "foobar",
		Stage:         config.StageDevStaging,
		client:        client,
	}

	storage.ObjectAccess = storage.defaultObjectAccess

	var mappings []archive.IDMapping
	found, err := storage.Download(context.Background(), "/tmp", "foo", mappings)
	if err != nil {
		t.Errorf("%+v", err)
	}
	if found {
		t.Errorf("gcloud storage reported object found despite it being non-existent")
	}
}
