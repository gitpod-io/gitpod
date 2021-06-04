// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

const (
	defaultRingbufferSize = 4
)

func TestWrite(t *testing.T) {
	type Expectation struct {
		N     int
		Error string
		Buf   []byte
	}
	tests := []struct {
		Name        string
		Write       func(b *RingBuffer) (int, error)
		Expectation Expectation
	}{
		{
			Name:        "write nothing",
			Write:       func(b *RingBuffer) (int, error) { return b.Write(nil) },
			Expectation: Expectation{N: 0, Buf: make([]byte, defaultRingbufferSize)},
		},
		{
			Name:        "write too much",
			Write:       func(b *RingBuffer) (int, error) { return b.Write(make([]byte, 2*defaultRingbufferSize)) },
			Expectation: Expectation{N: 2 * defaultRingbufferSize, Buf: make([]byte, defaultRingbufferSize)},
		},
		{
			Name:        "write some",
			Write:       func(b *RingBuffer) (int, error) { return b.Write(make([]byte, defaultRingbufferSize/2)) },
			Expectation: Expectation{N: defaultRingbufferSize / 2, Buf: make([]byte, defaultRingbufferSize)},
		},
		{
			Name: "write twice",
			Write: func(b *RingBuffer) (int, error) {
				var rn int
				n, err := b.Write([]byte("a"))
				if err != nil {
					return n, err
				}
				rn += n
				n, err = b.Write([]byte("b"))
				if err != nil {
					return n, err
				}
				rn += n
				return rn, nil
			},
			Expectation: Expectation{
				N:   2,
				Buf: []byte{'a', 'b', 0x00, 0x00},
			},
		},
		{
			Name:  "write overflow",
			Write: func(b *RingBuffer) (int, error) { return b.Write([]byte("acaba")) },
			Expectation: Expectation{
				N:   5,
				Buf: []byte("caba"),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			b, err := NewRingBuffer(defaultRingbufferSize)
			if err != nil {
				t.Fatal(err)
			}

			var act Expectation
			n, err := test.Write(b)
			if err != nil {
				act.Error = err.Error()
			}
			act.N = n
			act.Buf = b.data

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRead(t *testing.T) {
	type Expectation struct {
		Output string
		EOF    bool
	}
	tests := []struct {
		Name        string
		Size        int64
		Input       string
		BufSize     int64
		Offset      int64
		Expectation Expectation
		Mod         func(*RingBuffer)
	}{
		{
			Name:        "hello world",
			Size:        24,
			Input:       "hello world",
			BufSize:     24,
			Expectation: Expectation{Output: "hello world"},
		},
		{
			Name:        "wrap around",
			Size:        5,
			Input:       "hello world",
			BufSize:     24,
			Expectation: Expectation{Output: "world"},
		},
		{
			Name:        "offset > size",
			Size:        12,
			Input:       "",
			Offset:      128,
			BufSize:     24,
			Expectation: Expectation{EOF: true},
		},
		{
			Name:        "offset > write",
			Size:        24,
			Input:       "0123456789",
			Offset:      12,
			BufSize:     24,
			Expectation: Expectation{EOF: true},
		},
		{
			Name:        "offset < write",
			Size:        24,
			Input:       "0123456789",
			Offset:      6,
			BufSize:     24,
			Expectation: Expectation{Output: "6789"},
		},
		{
			Name:        "full read",
			Size:        6,
			Input:       "012345",
			Offset:      0,
			BufSize:     24,
			Expectation: Expectation{Output: "012345"},
		},
		{
			Name:        "offset 2",
			Size:        6,
			Input:       "012345",
			Offset:      2,
			BufSize:     24,
			Expectation: Expectation{Output: "2345"},
		},
		{
			Name:        "write size+1, offset 2",
			Size:        6,
			Input:       "012345a",
			Offset:      2,
			BufSize:     24,
			Expectation: Expectation{Output: "345a"},
		},
		{
			Name:        "offset size+2",
			Size:        6,
			Input:       "012345abcdef",
			Offset:      8,
			BufSize:     24,
			Expectation: Expectation{Output: "cdef"},
		},
		{
			Name:        "read all",
			Size:        6,
			Input:       "012345abcdef",
			Offset:      12,
			BufSize:     24,
			Expectation: Expectation{EOF: true},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			b, err := NewRingBuffer(test.Size)
			if err != nil {
				t.Fatal(err)
			}

			_, err = b.Write([]byte(test.Input))
			if err != nil {
				t.Fatal(err)
			}

			if test.Mod != nil {
				test.Mod(b)
			}

			buf := make([]byte, test.BufSize)
			n := b.Read(buf, test.Offset)
			var act Expectation
			if n >= 0 {
				act.Output = string(buf[:n])
			} else {
				act.EOF = true
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
