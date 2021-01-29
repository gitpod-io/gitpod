// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"context"
	"io/ioutil"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestSizeLimitingWriter(t *testing.T) {
	tests := []struct {
		MaxSize       int64
		BlockSize     int64
		BlockCount    int
		ExpectWritten int
		Err           error
	}{
		{30, 10, 1, 10, nil},
		{30, 10, 3, 30, nil},
		{20, 10, 3, 20, ErrMaxSizeExceeded},
	}

	for _, test := range tests {
		var (
			written int
			n       int
			err     error
		)
		w := newLimitWriter(ioutil.Discard, test.MaxSize)

		for i := 0; i < test.BlockCount; i++ {
			n, err = w.Write(make([]byte, test.BlockSize))
			written += n
			if err != nil {
				break
			}
		}

		if err != test.Err {
			t.Errorf("unexpected error: expected %v, actual %v", test.Err, err)
		}
		if written != test.ExpectWritten {
			t.Errorf("wrote unexpected number of bytes: expected %v, actual %v", test.ExpectWritten, written)
		}
	}
}

func TestBuildTarbalMaxSize(t *testing.T) {
	tests := []struct {
		Name        string
		MaxSize     int64
		ContentSize int64
		Err         error
	}{
		{"positive", 1024 * 1024, 512, nil},
		{"too-big", 512, 1024, ErrMaxSizeExceeded},
	}

	var cleanup []string
	for _, test := range tests {
		wd, err := ioutil.TempDir("", "")
		if err != nil {
			t.Errorf("cannot prepare test: %v", err)
			continue
		}
		cleanup = append(cleanup, wd)

		err = ioutil.WriteFile(filepath.Join(wd, "content.txt"), make([]byte, test.ContentSize), 0644)
		if err != nil {
			t.Errorf("cannot prepare test: %v", err)
			continue
		}

		tgt, err := ioutil.TempFile("", "")
		if err != nil {
			t.Errorf("cannot prepare test: %v", err)
			continue
		}
		tgt.Close()
		cleanup = append(cleanup, tgt.Name())

		err = BuildTarbal(context.Background(), wd, tgt.Name(), TarbalMaxSize(test.MaxSize))
		if (err == nil && test.Err != nil) || (err != nil && test.Err == nil) || (err != nil && test.Err != nil && err.Error() != test.Err.Error()) {
			t.Errorf("%s: unexpected error: expected \"%v\", actual \"%v\"", test.Name, test.Err, err)
		}
	}

	for _, c := range cleanup {
		os.RemoveAll(c)
	}
}

func TestExtractTarbal(t *testing.T) {
	type file = struct {
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
			wd, err := ioutil.TempDir("", "")
			defer os.RemoveAll(wd)
			if err != nil {
				t.Errorf("cannot prepare test: %v", err)
				t.FailNow()
			}
			sourceFolder := filepath.Join(wd, "source")
			os.MkdirAll(sourceFolder, 0777)

			for _, file := range test.Files {
				fileName := filepath.Join(sourceFolder, file.Name)
				err = ioutil.WriteFile(fileName, make([]byte, file.ContentSize), 0644)
				if err != nil {
					t.Errorf("cannot prepare test: %v", err)
					continue
				}
				err = os.Chown(fileName, file.Uid, file.Uid)
				if err != nil {
					t.Errorf("Cannot chown %s to %d: %s", file.Name, file.Uid, err)
				}
			}
			tarFile := filepath.Join(wd, "my.tar")
			BuildTarbal(context.Background(), sourceFolder, tarFile)

			reader, err := os.Open(tarFile)
			if err != nil {
				t.Errorf("Cannot open %s", tarFile)
			}
			targetFolder := filepath.Join(wd, "target")
			os.MkdirAll(targetFolder, 0777)
			ExtractTarbal(context.Background(), reader, targetFolder)

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
