// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package doh

import (
	"math/rand"
)

type Make func(s string) *Upstream

type Pool struct {
	pool chan *Upstream
	make Make
}

// NewPool creates a new pool of Upstreams.
func NewPool(max int, makefn Make) *Pool {
	return &Pool{
		pool: make(chan *Upstream, max),
		make: makefn,
	}
}

// func (p *Pool) Prefill() {
// 	for cap(p.pool) > 0 {
// 		select {
// 		case p.pool <- p.make(""):
// 			continue
// 		default:
// 			goto END
// 		}
// 	}
// END:
// 	return
// }

// Borrow a Upstream from the pool.
func (p *Pool) Borrow(s string) *Upstream {
	var c *Upstream
	select {
	case c = <-p.pool:
	default:
		c = p.make(s)
	}
	return c
}

// Return returns a Upstream to the pool.
func (p *Pool) Return(c *Upstream) {
	select {
	case p.pool <- c:
	default:
		// let it go, let it go...
	}
}

// func (p *Pool) Fill(s string) {
// 	if cap(p.pool) > 0 {
// 		select {
// 		case p.pool <- p.make(s):
// 		default:
// 			goto END
// 		}
// 	}
// END:
// 	return
// }

// func fingerprint(s string) uint64 {
// 	h := fnv.New64a()
// 	h.Write([]byte(s))
// 	return h.Sum64()
// }

func GetUpstream(query string) *Upstream {
	// todo > make configurable
	// if len(query) == 0 {
	return upstreams[rand.Intn(len(upstreams))]
	// }
	// return upstreams[fingerprint(query)%uint64(len(upstreams))]
}
