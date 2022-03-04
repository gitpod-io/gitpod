// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dropwriter

import (
	"io"
	"sync"
	"time"
)

// Clock abstracts time for the bucket limiter.
type Clock func() time.Time

// NewBucket creates a new bucket limiter with a realtime clock.
func NewBucket(capacity, refillRatePerSec int64) *Bucket {
	return NewBucketClock(capacity, refillRatePerSec, time.Now)
}

// NewBucketClock produces a new bucket limiter with a custom clock. Useful for testing.
func NewBucketClock(capacity, refillRatePerSec int64, clock Clock) *Bucket {
	return &Bucket{
		clock:      clock,
		capacity:   capacity,
		refillRate: refillRatePerSec,
	}
}

// Bucket implements a token bucket limiter.
type Bucket struct {
	clock Clock

	// capacity is the total token capacity of this bucket
	capacity int64

	// refillRate holds how many tokens we refill per second
	refillRate int64

	// mu syncs bucket access
	mu sync.Mutex

	// availableTokens is the total number of tokens currently available
	availableTokens int64

	// lastTick is the last time we adjusted the available token count
	lastTick time.Time
}

func (b *Bucket) adjustTokens() {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := b.clock()
	defer func() {
		b.lastTick = now
	}()

	if b.lastTick.IsZero() {
		// first adjustment/tick ever - set availableTokens to capacity
		b.availableTokens = b.capacity
		return
	}

	b.availableTokens += int64(now.Sub(b.lastTick).Seconds() * float64(b.refillRate))
	if b.availableTokens > b.capacity {
		b.availableTokens = b.capacity
	}
}

// TakeAvailable attempts to remove req tokens from the bucket. If there are fewer tokens available
// all remaining tokens are removed and returned.
func (b *Bucket) TakeAvailable(req int64) int64 {
	b.adjustTokens()

	b.mu.Lock()
	defer b.mu.Unlock()

	grant := req
	if grant > b.availableTokens {
		grant = b.availableTokens
	}
	b.availableTokens -= grant

	return grant
}

type writer struct {
	w      io.Writer
	bucket *Bucket
}

func (w *writer) Write(buf []byte) (n int, err error) {
	grant := w.bucket.TakeAvailable(int64(len(buf)))
	n, err = w.w.Write(buf[:grant])
	if err != nil {
		return
	}

	// We act as though we had written the whole buffer. This is what actually implements
	// the byte drop imposed by the bucket limiter. if we returned the correct number of bytes
	// here the caller might err with ErrShortWrite or simply try again.
	n = len(buf)

	return
}

// Writer produces a new rate limited dropping writer.
func Writer(dst io.Writer, b *Bucket) io.Writer {
	return &writer{w: dst, bucket: b}
}
