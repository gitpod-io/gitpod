// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

// PortConfigProvider provides information about a port
type PortConfigProvider interface {
	// IsPublic returns true if the port is to be exposed publically
	IsPublic(localPort uint32) (bool, error)
}

// FixedPortConfigProvider provides fixed configuration for ports
type FixedPortConfigProvider struct {
	Config map[uint32]bool
}

// IsPublic returns true if the port is to be exposed publically
func (f *FixedPortConfigProvider) IsPublic(localPort uint32) (bool, error) {
	return f.Config[localPort], nil
}

const (
	// proxyPortRange is the port range in which we'll try to find
	// ports for proxying localhost-only services.
	proxyPortRangeLo uint32 = 50000
	proxyPortRangeHi uint32 = 60000
)

// NewManager creates a new port manager
func NewManager(exposed ExposedPortsInterface, served ServedPortsObserver, portConfig PortConfigProvider, internalPorts ...uint32) *Manager {
	state := make(map[uint32]*managedPort)
	for _, p := range internalPorts {
		state[p] = &managedPort{Internal: true}
	}

	return &Manager{
		E:          exposed,
		S:          served,
		PortConfig: portConfig,

		state:         state,
		subscriptions: make(map[*Subscription]struct{}),
		proxyStarter:  startLocalhostProxy,
	}
}

// Manager brings together served and exposed ports. It keeps track of which port is exposed, which one is served,
// auto-exposes ports and proxies ports served on localhost only.
type Manager struct {
	E          ExposedPortsInterface
	S          ServedPortsObserver
	PortConfig PortConfigProvider

	state         map[uint32]*managedPort
	subscriptions map[*Subscription]struct{}
	mu            sync.RWMutex
	proxyStarter  func(dst *managedPort, openPorts map[uint32]struct{}) (err error)

	testingStatusChanged func()
}

type managedPort struct {
	Internal   bool
	Served     bool
	IsOurProxy bool
	Exposed    bool
	Public     bool
	URL        string

	LocalhostPort uint32
	GlobalPort    uint32
	Proxy         io.Closer
}

// Subscription is a Subscription to status updates
type Subscription struct {
	updates chan []*api.PortsStatus
	Close   func() error
}

// Updates returns the updates channel
func (s *Subscription) Updates() <-chan []*api.PortsStatus {
	return s.updates
}

// Run starts the port manager which keeps running until one of its observers stops.
func (pm *Manager) Run() {
	ctx, cancel := context.WithCancel(context.Background())
	defer func() {
		// We copy the subscriptions to a list prior to closing them, to prevent a data race
		// between the map iteration and entry removal when closing the subscription.
		pm.mu.RLock()
		subs := make([]*Subscription, 0, len(pm.subscriptions))
		for s := range pm.subscriptions {
			subs = append(subs, s)
		}
		pm.mu.RUnlock()

		for _, s := range subs {
			s.Close()
		}
	}()
	defer cancel()

	exposedUpdates, exposedErrors := pm.E.Observe(ctx)
	servedUpdates, servedErrors := pm.S.Observe(ctx)
	for {
		select {
		case e := <-exposedUpdates:
			if e == nil {
				log.Error("exposed ports observer stopped")
				return
			}
			pm.updateStateWithExposedPorts(e)
		case s := <-servedUpdates:
			if s == nil {
				log.Error("served ports observer stopped")
				return
			}
			pm.updateStateWithServedPorts(s)
		case err := <-exposedErrors:
			if err == nil {
				log.Error("exposed ports observer stopped")
				return
			}
			log.WithError(err).Warn("error while observing exposed ports")
		case err := <-servedErrors:
			if err == nil {
				log.Error("served ports observer stopped")
				return
			}
			log.WithError(err).Warn("error while observing served ports")
		}
	}
}

// Status provides the current port status
func (pm *Manager) Status() []*api.PortsStatus {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return pm.getStatus()
}

func (pm *Manager) updateStateWithServedPorts(listeningPorts []ServedPort) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	openPorts := make(map[uint32]struct{}, len(listeningPorts))
	for _, p := range listeningPorts {
		openPorts[p.Port] = struct{}{}
	}

	// remove closed ports. Do this before openining new ones to not interfere
	// with the proxies we might start, and accidentially delete them from the state
	// because we're operating with an old list of open ports.
	var changes bool
	for p, mp := range pm.state {
		if mp.Internal {
			continue
		}
		if _, ok := openPorts[p]; ok {
			continue
		}

		if mp.Proxy != nil {
			err := mp.Proxy.Close()
			if err != nil {
				log.WithError(err).WithField("port", p).Warn("cannot stop localhost proxy")
			}
		}
		mp.Served = false

		if !mp.Served && !mp.Exposed && !mp.Internal {
			delete(pm.state, p)
		}

		changes = true
	}

	// add new ports
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, p := range listeningPorts {
		mp, ok := pm.state[p.Port]
		if ok && (mp.Served || mp.Internal) {
			continue
		}

		if mp == nil {
			mp = &managedPort{
				LocalhostPort: p.Port,
			}
		}
		mp.Served = true

		if p.BoundToLocalhost {
			err := pm.proxyStarter(mp, openPorts)
			if err != nil {
				log.WithError(err).WithField("port", p.Port).Warn("cannot start localhost proxy")
			}

			// we just opened a proxy on the GlobalPort. We need to record this in the state to filter them the next time 'round.
			pm.state[mp.GlobalPort] = &managedPort{IsOurProxy: true, GlobalPort: mp.GlobalPort, LocalhostPort: mp.LocalhostPort}
		} else {
			// we don't need a proxy - the port is globally bound
			mp.GlobalPort = p.Port
		}

		if !mp.Exposed && !mp.Internal && !mp.IsOurProxy {
			public, err := pm.PortConfig.IsPublic(mp.LocalhostPort)
			if err != nil {
				log.WithError(err).WithField("port", *mp).Warn("cannot determine if port is public - assuming it's not")
			}

			err = pm.E.Expose(ctx, mp.LocalhostPort, mp.GlobalPort, public)
			if err != nil {
				log.WithError(err).WithField("port", *mp).Warn("cannot auto-expose port")
			}
		}

		pm.state[p.Port] = mp
		changes = true
	}

	if !changes {
		return
	}
	pm.publishStatus()
}

func (pm *Manager) updateStateWithExposedPorts(ports []ExposedPort) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	var changes bool
	defer func() {
		if !changes {
			return
		}
		pm.publishStatus()
	}()

	// TODO(cw): check if a port got unexposed

	for _, p := range ports {
		mp, exists := pm.state[p.LocalPort]
		if !exists {
			mp = &managedPort{
				Exposed:       true,
				GlobalPort:    p.GlobalPort,
				LocalhostPort: p.LocalPort,
				URL:           p.URL,
				Public:        p.Public,
			}
			pm.state[p.LocalPort] = mp
			changes = true
			continue
		}

		if mp.Exposed != true {
			mp.Exposed = true
			changes = true
		}
		if mp.Public != p.Public {
			mp.Public = p.Public
			changes = true
		}
		if mp.URL != p.URL {
			mp.URL = p.URL
			changes = true
		}
	}
}

// Subscribe subscribes for status updates
func (pm *Manager) Subscribe() *Subscription {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if len(pm.subscriptions) > maxSubscriptions {
		return nil
	}

	sub := &Subscription{updates: make(chan []*api.PortsStatus, 5)}
	var once sync.Once
	sub.Close = func() error {
		pm.mu.Lock()
		defer pm.mu.Unlock()

		once.Do(func() { close(sub.updates) })
		delete(pm.subscriptions, sub)

		return nil
	}
	pm.subscriptions[sub] = struct{}{}

	return sub
}

// publishStatus pushes status updates to all subscribers.
// Callers are expected to hold mu.
func (pm *Manager) publishStatus() {
	if pm.testingStatusChanged != nil {
		pm.testingStatusChanged()
	}

	log.WithField("ports", fmt.Sprintf("%+v", pm.state)).Debug("ports changed")

	status := pm.getStatus()
	for sub := range pm.subscriptions {
		select {
		case sub.updates <- status:
		default:
			log.Warn("cannot to push ports update to a subscriber")
		}
	}
}

// getStatus produces an API compatible port status list.
// Callers are expected to hold mu.
func (pm *Manager) getStatus() []*api.PortsStatus {
	res := make([]*api.PortsStatus, 0, len(pm.state))
	for _, p := range pm.state {
		if p.Internal || p.IsOurProxy {
			continue
		}

		ps := &api.PortsStatus{
			GlobalPort: p.GlobalPort,
			LocalPort:  p.LocalhostPort,
			Served:     p.Served,
		}
		if p.Exposed {
			ps.Exposed = &api.PortsStatus_ExposedPortInfo{
				Public: p.Public,
				Url:    p.URL,
			}
		}
		res = append(res, ps)
	}
	return res
}

func startLocalhostProxy(dst *managedPort, openPorts map[uint32]struct{}) (err error) {
	var proxyPort uint32
	for prt := proxyPortRangeHi; prt >= proxyPortRangeLo; prt-- {
		if _, used := openPorts[prt]; used {
			continue
		}

		proxyPort = prt
		break
	}
	if proxyPort == 0 {
		return xerrors.Errorf("cannot find a free proxy port")
	}

	host := fmt.Sprintf("localhost:%d", dst.LocalhostPort)
	dsturl, err := url.Parse("http://" + host)
	if err != nil {
		return xerrors.Errorf("cannot produce proxy destination URL: %w", err)
	}
	proxy := httputil.NewSingleHostReverseProxy(dsturl)
	od := proxy.Director
	proxy.Director = func(req *http.Request) {
		req.Host = host
		od(req)
	}
	proxyAddr := fmt.Sprintf(":%d", proxyPort)
	lis, err := net.Listen("tcp", proxyAddr)
	if err != nil {
		return xerrors.Errorf("cannot listen on proxy port %d: %w", proxyPort, err)
	}

	srv := &http.Server{
		Addr:    proxyAddr,
		Handler: proxy,
	}
	go func() {
		err := srv.Serve(lis)
		if err != nil {
			log.WithError(err).WithField("local-port", dst.LocalhostPort).Error("localhost proxy failed")
		}
	}()

	dst.Proxy = srv
	dst.GlobalPort = proxyPort
	return nil
}
