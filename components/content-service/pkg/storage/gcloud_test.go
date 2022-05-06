// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"archive/tar"
	"context"
	"crypto/rand"
	"io"
	"io/ioutil"
	"os"
	"testing"

	gcp_storage "cloud.google.com/go/storage"
	"github.com/fsouza/fake-gcs-server/fakestorage"
	"google.golang.org/api/option"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
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

	client, err := gcp_storage.NewClient(ctx, args...)
	if err != nil {
		t.Errorf("error creating GCS gcsClient: %v", err)
	}

	storage := DirectGCPStorage{
		WorkspaceName: "fake-workspace-name",
		InstanceID:    "fake-instance-id",
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

func TestObjectUpload(t *testing.T) {
	tests := []struct {
		Desc        string
		Name        string
		Stage       config.Stage
		Owner       string
		WorkspaceID string
		InstanceID  string
		Payload     func() (string, error)
	}{
		{"valid 1M backup", DefaultBackup, config.StageDevStaging, "fake-owner", "fake-workspace", "fake-instance", fakeTarPayload(1)},
		{"valid 100M backup", DefaultBackup, config.StageDevStaging, "fake-owner", "fake-workspace", "fake-instance", fakeTarPayload(100)},
		{"valid 1GB backup", DefaultBackup, config.StageDevStaging, "fake-owner", "fake-workspace", "fake-instance", fakeTarPayload(1024)},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			storage := DirectGCPStorage{
				Stage:         test.Stage,
				Username:      test.Owner,
				WorkspaceName: test.WorkspaceID,
				InstanceID:    test.InstanceID,
				GCPConfig: config.GCPConfig{
					Region:  "fake-region",
					Project: "fake-project",
				},
			}

			storage.ObjectAccess = storage.defaultObjectAccess

			server, err := fakestorage.NewServerWithOptions(fakestorage.Options{
				Writer: os.Stdout,
			})
			if err != nil {
				t.Fatalf("error creating fake GCS server: %v", err)
			}

			defer server.Stop()

			server.CreateBucketWithOpts(fakestorage.CreateBucketOpts{
				Name: gcpBucketName(test.Stage, test.Owner),
			})

			// replace internal (valid) client with fake one
			storage.client = server.Client()

			bucket := storage.client.Bucket(gcpBucketName(test.Stage, test.Owner))
			err = bucket.Create(context.Background(), "fake-project", nil)
			if err != nil {
				t.Fatal(err)
			}

			payloadPath, err := test.Payload()
			if err != nil {
				t.Fatalf("error creating test file: %v", err)
			}
			defer os.Remove(payloadPath)

			ctx, cancelFunc := context.WithCancel(context.Background())
			defer cancelFunc()

			_, _, err = storage.Upload(ctx, payloadPath, test.Name, WithContentType(csapi.ContentTypeManifest))
			if err != nil {
				t.Fatalf("error uploading file: %v", err)
			}

			_, err = server.GetObject(storage.bucketName(), storage.objectName(test.Name))
			if err != nil {
				t.Fatal(err)
			}

			dst, err := ioutil.TempDir("", "gcs-download")
			if err != nil {
				t.Fatalf("error creating temporal file: %v", err)
			}
			defer os.RemoveAll(dst)

			found, err := storage.Download(ctx, dst, test.Name, []archive.IDMapping{})
			if err != nil {
				t.Fatalf("error downloading file: %v", err)
			}

			if !found {
				t.Fatal("backup not found")
			}

			files, err := ioutil.ReadDir(dst)
			if err != nil {
				t.Fatalf("error reading content of directory: %v", err)
			}

			if len(files) != 1 {
				t.Fatalf("expected 1 file but found %v", len(files))
			}
		})
	}
}

func fakeTarPayload(mb int) func() (string, error) {
	return func() (string, error) {
		payload, err := ioutil.TempFile("", "test-payload-")
		if err != nil {
			return "", err
		}

		defer os.Remove(payload.Name())

		_, err = io.CopyN(payload, rand.Reader, int64(mb*1024*1024))
		if err != nil {
			return "", err
		}

		tarFile, err := ioutil.TempFile("", "tar-payload-")
		if err != nil {
			return "", err
		}

		defer tarFile.Close()

		tarWriter := tar.NewWriter(tarFile)
		defer tarWriter.Close()

		err = addFileToTar(payload.Name(), tarWriter)
		if err != nil {
			return "", err
		}

		return tarFile.Name(), nil
	}
}

func addFileToTar(filePath string, tarWriter *tar.Writer) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return err
	}

	err = tarWriter.WriteHeader(&tar.Header{
		Name:    file.Name(),
		Size:    stat.Size(),
		Mode:    int64(stat.Mode()),
		ModTime: stat.ModTime(),
	})
	if err != nil {
		return err
	}

	_, err = io.Copy(tarWriter, file)
	if err != nil {
		return err
	}

	return nil
}
