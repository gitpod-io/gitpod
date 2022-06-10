// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"archive/tar"
	"context"
	"crypto/rand"
	"crypto/tls"
	"flag"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	gcp_storage "cloud.google.com/go/storage"
	"github.com/fsouza/fake-gcs-server/fakestorage"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"google.golang.org/api/option"
	"k8s.io/apimachinery/pkg/api/resource"

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
	if err != nil && !strings.Contains(err.Error(), "object doesn't exist") {
		t.Errorf("%+v", err)
	}
	if found {
		t.Errorf("gcloud storage reported object found despite it being non-existent")
	}
}

//nolint:unused
var runWithDocker = flag.Bool("with-docker", false, "run fake-gcs-server in docker")

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
		{"valid 1M backup", DefaultBackup, config.StageDevStaging, "fake-owner", "fake-workspace", "fake-instance", fakeTarPayload("1Mi")},
		{"valid 100M backup", DefaultBackup, config.StageDevStaging, "fake-owner", "fake-workspace", "fake-instance", fakeTarPayload("100Mi")},
		{"valid 1GB backup", DefaultBackup, config.StageDevStaging, "fake-owner", "fake-workspace", "fake-instance", fakeTarPayload("1Gi")},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			t.Skip()

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			var err error
			var client *gcp_storage.Client

			// use docker to run the fake GCS server
			// or start an embed server otherwise
			switch *runWithDocker {
			case true:
				var gcsContainer *fakeGCSContainer
				gcsContainer, err = setupFakeStorage(ctx)
				if err != nil {
					break
				}

				defer gcsContainer.Terminate(ctx)

				client, err = gcp_storage.NewClient(ctx,
					option.WithEndpoint(gcsContainer.URI),
					option.WithoutAuthentication(),
					option.WithHTTPClient(&http.Client{
						Transport: &http.Transport{
							TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
						},
					}),
				)
			case false:
				// the downside of using the fake server as library is the amount or
				// memory used by the test binary (this makes too hard the use of pprof)
				var server *fakestorage.Server
				server, err = fakestorage.NewServerWithOptions(fakestorage.Options{
					Writer: os.Stdout,
				})
				if err != nil {
					break
				}

				defer server.Stop()

				server.CreateBucketWithOpts(fakestorage.CreateBucketOpts{
					Name: gcpBucketName(test.Stage, test.Owner),
				})

				client = server.Client()
			}

			if err != nil {
				t.Fatalf("failed to create GCS client: %v", err)
			}

			storage := DirectGCPStorage{
				Stage:         test.Stage,
				Username:      test.Owner,
				WorkspaceName: test.WorkspaceID,
				InstanceID:    test.InstanceID,
				GCPConfig: config.GCPConfig{
					Region:  "fake-region",
					Project: "fake-project",
				},
				// replace internal (valid) client with fake one
				client: client,
			}

			storage.ObjectAccess = storage.defaultObjectAccess

			bucket := storage.client.Bucket(gcpBucketName(test.Stage, test.Owner))
			err = bucket.Create(context.Background(), "fake-project", nil)
			if err != nil {
				t.Fatal(err)
			}

			t.Log("creating fake tar file...")
			payloadPath, err := test.Payload()
			if err != nil {
				t.Fatalf("error creating test file: %v", err)
			}
			defer os.Remove(payloadPath)

			_, _, err = storage.Upload(ctx, payloadPath, test.Name, WithContentType(csapi.ContentTypeManifest))
			if err != nil {
				t.Fatalf("error uploading file: %v", err)
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

func fakeTarPayload(size string) func() (string, error) {
	return func() (string, error) {
		payload, err := ioutil.TempFile("", "test-payload-")
		if err != nil {
			return "", err
		}

		defer os.Remove(payload.Name())

		q, err := resource.ParseQuantity(size)
		if err != nil {
			return "", err
		}

		_, err = io.CopyN(payload, rand.Reader, q.Value())
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

type fakeGCSContainer struct {
	testcontainers.Container

	URI string
}

//nolint:unused
func setupFakeStorage(ctx context.Context) (*fakeGCSContainer, error) {
	req := testcontainers.ContainerRequest{
		Image:        "fsouza/fake-gcs-server",
		ExposedPorts: []string{"4443/tcp"},
		NetworkMode:  "host",
		Entrypoint:   []string{"/bin/fake-gcs-server", "-data=/data", "-backend=filesystem", "-public-host=localhost:4443"},
		WaitingFor:   wait.ForLog("server started at").WithPollInterval(1 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return nil, err
	}

	return &fakeGCSContainer{
		Container: container,
		URI:       "https://localhost:4443/storage/v1/",
	}, nil
}
