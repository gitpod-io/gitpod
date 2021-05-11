// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package terminal

import (
	"fmt"
)

// RingBuffer implements a ring buffer. It is a fixed size,
// and new writes overwrite older data, such that for a buffer
// of size N, for any amount of writes, only the last N bytes
// are retained.
type RingBuffer struct {
	data        []byte
	size        int64
	writeCursor int64
	written     int64
}

// NewRingBuffer creates a new buffer of a given size. The size
// must be greater than 0.
func NewRingBuffer(size int64) (*RingBuffer, error) {
	if size <= 0 {
		return nil, fmt.Errorf("Size must be positive")
	}

	b := &RingBuffer{
		size: size,
		data: make([]byte, size),
	}
	return b, nil
}

// Write writes up to len(buf) bytes to the internal ring,
// overriding older data if necessary.
func (b *RingBuffer) Write(buf []byte) (int, error) {
	// Account for total bytes written
	n := len(buf)
	b.written += int64(n)

	// If the buffer is larger than ours, then we only care
	// about the last size bytes anyways
	if int64(n) > b.size {
		buf = buf[int64(n)-b.size:]
	}

	// Copy in place
	remain := b.size - b.writeCursor
	copy(b.data[b.writeCursor:], buf)
	if int64(len(buf)) > remain {
		copy(b.data, buf[remain:])
	}

	// Update location of the cursor
	b.writeCursor = ((b.writeCursor + int64(len(buf))) % b.size)
	return n, nil
}

// Size returns the size of the buffer
func (b *RingBuffer) Size() int64 {
	return b.size
}

// TotalWritten provides the total number of bytes written
func (b *RingBuffer) TotalWritten() int64 {
	return b.written
}

// Bytes provides a slice of the bytes written. This
// slice should not be written to.
func (b *RingBuffer) Bytes() []byte {
	out := make([]byte, b.size)
	n := b.Read(out, 0)
	return out[:n]
}

// Read reads a slice from the buffer
func (b *RingBuffer) Read(buf []byte, offset int64) (bytesRead int64) {
	if offset >= b.written {
		return -1
	}
	if b.written >= b.size {
		// wrap around the full buffer: after write cursor until the buffer end + buffer beginning until the write cursor
		if b.writeCursor+offset < b.size {
			n := copy(buf, b.data[offset:])
			n += copy(buf[n:], b.data[:b.writeCursor])
			return int64(n)
		}

		off := (b.writeCursor + offset) % b.size
		// offset wrapped around buffer: from the beginning of buffer until the write cursor
		if off < b.writeCursor {
			n := copy(buf, b.data[off:b.writeCursor])
			return int64(n)
		}

		// offset wrapped around the buffer and overtook write cursor: from the offset unil the end of the buffer
		n := copy(buf, b.data[off:])
		return int64(n)
	}

	// buffer isn't full yet, can only read until the write cursor
	if offset > b.writeCursor {
		return 0
	}
	bytesRead = b.writeCursor - offset
	if bytesRead > int64(len(buf)) {
		bytesRead = int64(len(buf))
	}
	return int64(copy(buf, b.data[offset:b.writeCursor]))
}

// Reset resets the buffer so it has no content.
func (b *RingBuffer) Reset() {
	b.writeCursor = 0
	b.written = 0
}

// String returns the contents of the buffer as a string
func (b *RingBuffer) String() string {
	return string(b.Bytes())
}
