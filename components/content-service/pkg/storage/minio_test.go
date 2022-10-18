// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"testing"

	config "github.com/gitpod-io/gitpod/content-service/api/config"
)

func TestMinioBucketName(t *testing.T) {
	tests := []struct {
		Name             string
		BucketNameConfig string
		OwnerID          string
		ExpectedBucket   string
	}{
		{
			Name:             "no dedicated bucket",
			BucketNameConfig: "",
			OwnerID:          "fake-owner-id",
			ExpectedBucket:   "gitpod-user-fake-owner-id",
		},
		{
			Name:             "with dedicated bucket",
			BucketNameConfig: "root-bucket",
			OwnerID:          "fake-owner-id",
			ExpectedBucket:   "root-bucket",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			cfg := config.MinIOConfig{
				Endpoint:        "fake",
				AccessKeyID:     "fake_access_key",
				SecretAccessKey: "fake_secret",
				Region:          "none",
				BucketName:      test.BucketNameConfig,
			}
			minio, err := newDirectMinIOAccess(cfg)
			if err != nil {
				t.Fatalf("failed to create minio access: '%v'", err)
			}

			actualBucketName := minio.Bucket(test.OwnerID)
			if actualBucketName != test.ExpectedBucket {
				t.Fatalf("[minio] unexpected bucket name: is '%s' but expected '%s'", actualBucketName, test.ExpectedBucket)
			}

			presignedMinio, err := newPresignedMinIOAccess(cfg)
			if err != nil {
				t.Fatalf("failed to create presigned minio access: '%v'", err)
			}

			actualBucketName = presignedMinio.Bucket(test.OwnerID)
			if actualBucketName != test.ExpectedBucket {
				t.Fatalf("[presigned minio] unexpected bucket name: is '%s' but expected '%s'", actualBucketName, test.ExpectedBucket)
			}
		})
	}
}

func TestMinioBackupObject(t *testing.T) {
	tests := []struct {
		Name                 string
		BucketNameConfig     string
		Username             string
		Workspace            string
		InstanceID           string
		ObjectName           string
		ExpectedBackupObject string
	}{
		{
			Name:                 "no dedicated bucket",
			BucketNameConfig:     "",
			Username:             "test-user",
			Workspace:            "gitpodio-gitpod-2cx8z8e643x",
			InstanceID:           "fa9aa2af-b6de-45fc-8b48-534bb440429f",
			ObjectName:           "backup.tar",
			ExpectedBackupObject: "workspaces/gitpodio-gitpod-2cx8z8e643x/backup.tar",
		},
		{
			Name:                 "with dedicated bucket",
			BucketNameConfig:     "root-bucket",
			Username:             "test-user",
			Workspace:            "gitpodio-gitpod-2cx8z8e643x",
			InstanceID:           "fa9aa2af-b6de-45fc-8b48-534bb440429f",
			ObjectName:           "backup.tar",
			ExpectedBackupObject: "test-user/workspaces/gitpodio-gitpod-2cx8z8e643x/backup.tar",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			cfg := config.MinIOConfig{
				Endpoint:        "fake",
				AccessKeyID:     "fake_access_key",
				SecretAccessKey: "fake_secret",
				Region:          "none",
				BucketName:      test.BucketNameConfig,
			}
			minio, err := newDirectMinIOAccess(cfg)
			if err != nil {
				t.Fatalf("failed to create minio access: '%v'", err)
			}
			err = minio.Init(context.Background(), test.Username, test.Workspace, test.InstanceID)
			if err != nil {
				t.Fatalf("failed to init minio access: '%v'", err)
			}

			actualBackupObject := minio.BackupObject(test.ObjectName)
			if actualBackupObject != test.ExpectedBackupObject {
				t.Fatalf("[minio] unexpected backup object name: is '%s' but expected '%s'", actualBackupObject, test.ExpectedBackupObject)
			}

			presignedMinio, err := newPresignedMinIOAccess(cfg)
			if err != nil {
				t.Fatalf("failed to create presigned minio access: '%v'", err)
			}

			actualBackupObject = presignedMinio.BackupObject(test.Username, test.Workspace, test.ObjectName)
			if actualBackupObject != test.ExpectedBackupObject {
				t.Fatalf("[presigned minio] unexpected backup object name: is '%s' but expected '%s'", actualBackupObject, test.ExpectedBackupObject)
			}

		})
	}
}
