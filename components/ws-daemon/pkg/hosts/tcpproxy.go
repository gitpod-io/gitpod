// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package hosts

import (
	"math/rand"
	"net"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/tcpproxy"
)

// tcpProxy can proxy TCP connections to a remote target randomly choosen from a list of candidates
type tcpProxy struct {
	Name string

	targets  map[string]tcpproxy.Target
	mu       sync.RWMutex
	listener net.Listener
}

// Listen starts this proxy on a particular port
func (p *tcpProxy) Listen(port string) (err error) {
	p.listener, err = net.Listen("tcp", port)
	if err != nil {
		return
	}

	var c net.Conn
	for {
		c, err = p.listener.Accept()
		if err != nil {
			return
		}

		go p.serveConn(c)
	}
}

func (p *tcpProxy) serveConn(c net.Conn) {
	t := p.findTarget()
	if t == nil {
		log.WithField("proxy", p.Name).WithField("conn", c.RemoteAddr().String()).Errorf("no target available")
		c.Close()
		return
	}

	t.HandleConn(c)
}

func (p *tcpProxy) findTarget() tcpproxy.Target {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(p.targets) == 0 {
		return nil
	}

	var keys = make([]string, len(p.targets))
	var i = 0
	for k := range p.targets {
		keys[i] = k
		i++
	}
	return p.targets[keys[rand.Intn(len(p.targets))]]
}

// UpdateTargets updates the list of available target candidates
func (p *tcpProxy) UpdateTargets(targets []string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	goner := make(map[string]struct{}, len(p.targets))
	for k := range p.targets {
		goner[k] = struct{}{}
	}

	if p.targets == nil {
		p.targets = make(map[string]tcpproxy.Target)
	}
	for _, t := range targets {
		if _, ok := p.targets[t]; ok {
			delete(goner, t)
			continue
		}

		p.targets[t] = &tcpproxy.DialProxy{
			Addr:        t,
			DialTimeout: 1 * time.Minute, // the docs are a lie: DialTimeout defaults to "disabled" (cmp. https://github.com/inetaf/tcpproxy/issues/28)
			OnDialError: func(src net.Conn, err error) {
				destAddr := t
				log.WithField("src-addr", src.RemoteAddr().String()).WithField("dest-addr", destAddr).WithError(err).Error("cannot dial target")
				src.Close()

				// TODO: auto-remove target after some TTL was exceeded
			},
		}
		log.WithField("dest-addr", t).Debug("added target")
	}

	for t := range goner {
		delete(p.targets, t)
		log.WithField("dest-addr", t).Debug("removed target")
	}
}

// Close stops this proxy
func (p *tcpProxy) Close() error {
	if p.listener != nil {
		return p.listener.Close()
	}

	return nil
}
