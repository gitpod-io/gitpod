// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package storage_test

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

type TestablePresignedAccess interface {
	storage.PresignedAccess

	ForTestCreateObj(ctx context.Context, bucket, path, content string) error
	ForTestReset(ctx context.Context) error
}

func SuiteTestPresignedAccess(t *testing.T, ps TestablePresignedAccess) {
	tests := []struct {
		Name string
		Test func(t *testing.T, ps TestablePresignedAccess)
	}{
		{
			Name: "happy path",
			Test: testPresignedHappyPath,
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			test.Test(t, ps)
		})
	}
}

func testPresignedHappyPath(t *testing.T, ps TestablePresignedAccess) {
	ctx := context.Background()
	failOnErr(t, ps.ForTestReset(ctx))

	const (
		bucket = "test-bucket"
		path   = "foo/bar.txt"
	)

	failOnErr(t, ps.ForTestCreateObj(ctx, bucket, path, "hello world"))

	tests := []struct {
		Name string
		Test func(t *testing.T, os TestablePresignedAccess)
	}{
		{
			Name: "ObjectExists",
			Test: func(t *testing.T, os TestablePresignedAccess) {
				exists, err := ps.ObjectExists(ctx, bucket, path)
				failOnErr(t, err)
				if !exists {
					t.Errorf("expected %s/%s to exist - it did not", bucket, path)
				}
			},
		},
		{
			Name: "ObjectHash",
			Test: func(t *testing.T, os TestablePresignedAccess) {

				hash, err := ps.ObjectHash(ctx, bucket, path)
				failOnErr(t, err)
				if hash == "" {
					t.Errorf("expected non-empty object hash")
				}
			},
		},
		{
			Name: "DiskUsage",
			Test: func(t *testing.T, os TestablePresignedAccess) {
				size, err := ps.DiskUsage(ctx, bucket, path)
				failOnErr(t, err)
				if size == 0 {
					t.Errorf("expected non-zero disk usage")
				}
			},
		},
		{
			Name: "SignDownload",
			Test: func(t *testing.T, os TestablePresignedAccess) {
				nfo, err := ps.SignDownload(ctx, bucket, path, &storage.SignedURLOptions{})
				failOnErr(t, err)
				switch {
				case nfo == nil:
					t.Errorf("expected non-nil download info")
				case nfo.URL == "":
					t.Errorf("expected non-empty download URL")
				case nfo.Size == 0:
					t.Errorf("expected non-zero object size")
				}
			},
		},
		{
			Name: "SignUpload",
			Test: func(t *testing.T, os TestablePresignedAccess) {
				nfo, err := ps.SignUpload(ctx, bucket, path, &storage.SignedURLOptions{})
				failOnErr(t, err)
				switch {
				case nfo == nil:
					t.Errorf("expected non-nil download info")
				case nfo.URL == "":
					t.Errorf("expected non-empty download URL")
				}
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			test.Test(t, ps)
		})
	}
}

func failOnErr(t *testing.T, err error) {
	if err != nil {
		t.Fatal(err)
	}
}
