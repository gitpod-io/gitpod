// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resources

import (
	"golang.org/x/xerrors"
	"sync"
	"time"
)

type expiringEntry struct {
	C interface{}
	I time.Time
}

type expiringCache struct {
	content map[string]*expiringEntry
	mu      sync.RWMutex

	close  chan struct{}
	closed bool
}

func newExpiringCache(ttl time.Duration) *expiringCache {
	r := &expiringCache{
		content: make(map[string]*expiringEntry),
		close:   make(chan struct{}),
	}
	go r.gc(ttl)
	return r
}

var (
	errClosed = xerrors.Errorf("cache is closed")
)

func (e *expiringCache) gc(ttl time.Duration) {
	t := time.NewTicker(ttl)
	defer t.Stop()

	for {
		e.mu.Lock()
		for k, c := range e.content {
			if time.Since(c.I) < ttl {
				continue
			}

			delete(e.content, k)
		}
		e.mu.Unlock()

		select {
		case <-t.C:
			continue
		case <-e.close:
			return
		}
	}
}

func (e *expiringCache) Set(key string, item interface{}) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return errClosed
	}

	e.content[key] = &expiringEntry{
		C: item,
		I: time.Now(),
	}
	return nil
}

func (e *expiringCache) Get(key string) (item interface{}, ok bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	i, ok := e.content[key]
	if !ok {
		return nil, false
	}

	return i.C, true
}

func (e *expiringCache) Close() {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return
	}

	close(e.close)
	e.closed = true
}
