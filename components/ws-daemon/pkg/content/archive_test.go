// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"

	carchive "github.com/gitpod-io/gitpod/content-service/pkg/archive"
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
		w := newLimitWriter(io.Discard, test.MaxSize)

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
		wd, err := os.MkdirTemp("", "")
		if err != nil {
			t.Errorf("cannot prepare test: %v", err)
			continue
		}
		cleanup = append(cleanup, wd)

		err = os.WriteFile(filepath.Join(wd, "content.txt"), make([]byte, test.ContentSize), 0600)
		if err != nil {
			t.Errorf("cannot prepare test: %v", err)
			continue
		}

		tgt, err := os.CreateTemp("", "")
		if err != nil {
			t.Errorf("cannot prepare test: %v", err)
			continue
		}
		tgt.Close()
		cleanup = append(cleanup, tgt.Name())

		err = BuildTarbal(context.Background(), wd, tgt.Name(), false, carchive.TarbalMaxSize(test.MaxSize))
		if (err == nil && test.Err != nil) || (err != nil && test.Err == nil) || (err != nil && test.Err != nil && err.Error() != test.Err.Error()) {
			t.Errorf("%s: unexpected error: expected \"%v\", actual \"%v\"", test.Name, test.Err, err)
		} else {

			_, doesNotExistErr := os.Stat(tgt.Name())
			doesNotExist := doesNotExistErr != nil && os.IsNotExist(doesNotExistErr)
			if err != nil && !doesNotExist {
				t.Errorf("The file should be deleted when buildTarbal failed.")
			}
		}
	}

	for _, c := range cleanup {
		os.RemoveAll(c)
	}
}
