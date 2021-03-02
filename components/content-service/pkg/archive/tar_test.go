// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"archive/tar"
	"bytes"
	"context"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestExtractTarbal(t *testing.T) {
	type file struct {
		Name        string
		ContentSize int64
		Uid         int
	}
	tests := []struct {
		Name  string
		Files []file
	}{
		{
			Name: "simple-test",
			Files: []file{
				{"file.txt", 1024, 33333},
				{"file2.txt", 1024, 33333},
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
					Uid:      file.Uid,
					Gid:      file.Uid,
					Mode:     0644,
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
			os.MkdirAll(targetFolder, 0777)
			ExtractTarbal(context.Background(), buf, targetFolder)

			for _, file := range test.Files {
				stat, err := os.Stat(filepath.Join(targetFolder, file.Name))
				if err != nil {
					t.Errorf("expected %s", file.Name)
					continue
				}
				uid := stat.Sys().(*syscall.Stat_t).Uid
				if uid != uint32(file.Uid) {
					t.Errorf("expected uid %d", file.Uid)
					continue
				}
				gid := stat.Sys().(*syscall.Stat_t).Gid
				if gid != uint32(file.Uid) {
					t.Errorf("expected gid %d", file.Uid)
					continue
				}
			}
		})
	}
}
