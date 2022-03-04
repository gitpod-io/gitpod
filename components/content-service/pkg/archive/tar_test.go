// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"archive/tar"
	"bytes"
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestExtractTarbal(t *testing.T) {
	type file struct {
		Name        string
		ContentSize int64
		UID         int
		Mode        int
	}
	tests := []struct {
		Name  string
		Files []file
	}{
		{
			Name: "simple-test",
			Files: []file{
				{"file.txt", 1024, 33333, 0644},
				{"file2.txt", 1024, 33333, 4555},
			},
		},
		{
			Name:  "empty-tar",
			Files: []file{},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var (
				buf = bytes.NewBuffer(nil)
				tw  = tar.NewWriter(buf)
			)

			for _, file := range test.Files {
				err := tw.WriteHeader(&tar.Header{
					Name:     file.Name,
					Size:     file.ContentSize,
					Uid:      file.UID,
					Gid:      file.UID,
					Mode:     int64(file.Mode),
					Typeflag: tar.TypeReg,
				})
				if err != nil {
					t.Fatalf("cannot prepare archive: %q", err)
				}
				_, err = tw.Write(make([]byte, file.ContentSize))
				if err != nil {
					t.Fatalf("cannot prepare archive: %q", err)
				}
			}
			tw.Flush()
			tw.Close()

			wd, err := os.MkdirTemp("", "")
			defer os.RemoveAll(wd)
			if err != nil {
				t.Fatalf("cannot prepare test: %v", err)
			}
			targetFolder := filepath.Join(wd, "target")
			err = os.MkdirAll(targetFolder, 0777)
			if err != nil {
				t.Fatalf("cannot extract tar content: %v", err)
			}

			err = ExtractTarbal(context.Background(), buf, targetFolder)
			if err != nil {
				t.Fatalf("cannot extract tar content: %v", err)
			}

			for _, file := range test.Files {
				stat, err := os.Stat(filepath.Join(targetFolder, file.Name))
				if err != nil {
					t.Errorf("expected %s", file.Name)
					continue
				}
				uid := stat.Sys().(*syscall.Stat_t).Uid
				if uid != uint32(file.UID) {
					t.Errorf("expected uid %d", file.UID)
					continue
				}
				gid := stat.Sys().(*syscall.Stat_t).Gid
				if gid != uint32(file.UID) {
					t.Errorf("expected gid %d", file.UID)
					continue
				}

				expectedMode := stat.Mode()
				testMode := fs.FileMode(file.Mode)
				if expectedMode.String() != testMode.String() {
					t.Errorf("expected fileMode %d but returned %v", testMode, expectedMode)
					continue
				}

			}
		})
	}
}
