// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"io"
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
