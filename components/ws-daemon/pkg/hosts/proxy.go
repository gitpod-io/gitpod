// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package hosts

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// ProxyingController starts a TCP proxy for each host source instead of
// updating the hosts directly. This is handy when the resolver on the host
// caches the resolved address (much like systemd-resolved does).
type ProxyingController struct {
	DirectController

	mappedSources map[string]HostSource
	p             map[string]*tcpProxy
}

// NewProxyingController creates a new proxying hosts controller
func NewProxyingController(name, hostsFile string, sources map[string]HostSource) (*ProxyingController, error) {
	g, err := NewDirectController(name, hostsFile)
	if err != nil {
		return nil, err
	}

	res := &ProxyingController{
		DirectController: *g,
		mappedSources:    sources,
		p:                make(map[string]*tcpProxy),
	}
	for port := range sources {
		res.p[port] = &tcpProxy{Name: port}
	}
	return res, nil
}

// Start runs the hosts controller - this function does not return until the controller
// is stopped. It's intended to be called as a Go routine.
func (g *ProxyingController) Start() {
	hostsFileUpdates := make(chan hostUpdate)
	go g.updateHostsFile(hostsFileUpdates)
	proxyUpdates := make(chan proxyHostUpdate)
	go g.updateProxy(proxyUpdates)

	for port, proxy := range g.p {
		go func(port string, proxy *tcpProxy) {
			err := proxy.Listen(port)
			if err != nil {
				log.WithField("port", port).WithError(err).Error("cannot start TCP proxy")
			}
		}(port, proxy)
	}

	for port, src := range g.mappedSources {
		go func(port string, src HostSource) {
			defer src.Stop()
			defer log.WithField("name", src.Name()).Info("hosts source shutting down")

			for {
				select {
				case inc := <-src.Source():
					if inc == nil {
						return
					}

					proxyUpdates <- proxyHostUpdate{
						Name:  src.Name(),
						Hosts: inc,
						Port:  port,
					}

					hostsFileEntries := make([]Host, len(inc))
					for i := range inc {
						hostsFileEntries[i] = Host{
							Addr: "127.0.0.1",
							Name: inc[i].Name,
						}
					}
					hostsFileUpdates <- hostUpdate{src.Name(), hostsFileEntries}
				case <-g.stop:
					return
				}
			}
		}(port, src)

		err := src.Start()
		if err != nil {
			log.WithField("name", src.Name()).WithError(err).Error("cannot start host source")
		} else {
			log.WithField("name", src.Name()).Info("start hosts source")
		}
	}
}

type proxyHostUpdate struct {
	Name  string
	Hosts []Host
	Port  string
}

func (g *ProxyingController) updateProxy(inc <-chan proxyHostUpdate) {
	defer func() {
		for _, p := range g.p {
			p.Close()
		}
		log.Info("proxy shutting down")
	}()

	for {
		var update proxyHostUpdate
		select {
		case <-g.stop:
			return
		case update = <-inc:
		}

		err := func() (err error) {
			p, ok := g.p[update.Port]
			if !ok {
				return fmt.Errorf("no proxy for port %s", update.Port)
			}

			targets := make([]string, len(update.Hosts))
			for i, h := range update.Hosts {
				targets[i] = h.Addr
			}
			p.UpdateTargets(targets)
			log.WithField("port", update.Port).WithField("targets", targets).Info("updated proxy targets")

			return
		}()

		if err != nil {
			log.WithError(err).WithField("source", update.Name).Error("proxy update failed")
		}
	}
}
