// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"reflect"
	"sync"
	"time"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

const (
	// proxyPortRange is the port range in which we'll try to find
	// ports for proxying localhost-only services.
	proxyPortRangeLo uint32 = 50000
	proxyPortRangeHi uint32 = 60000
)

// NewManager creates a new port manager
func NewManager(exposed ExposedPortsInterface, served ServedPortsObserver, config ConfigInterace, internalPorts ...uint32) *Manager {
	state := make(map[uint32]*managedPort)
	internal := make(map[uint32]struct{})
	for _, p := range internalPorts {
		internal[p] = struct{}{}
	}

	return &Manager{
		E: exposed,
		S: served,
		C: config,

		internal:    internal,
		proxies:     make(map[uint32]*localhostProxy),
		autoExposed: make(map[uint32]uint32),

		state:         state,
		subscriptions: make(map[*Subscription]struct{}),
		proxyStarter:  startLocalhostProxy,
	}
}

type localhostProxy struct {
	io.Closer
	proxyPort uint32
}

// Manager brings together served and exposed ports. It keeps track of which port is exposed, which one is served,
// auto-exposes ports and proxies ports served on localhost only.
type Manager struct {
	E ExposedPortsInterface
	S ServedPortsObserver
	C ConfigInterace

	internal     map[uint32]struct{}
	proxies      map[uint32]*localhostProxy
	proxyStarter func(LocalhostPort uint32, GlobalPort uint32) (proxy io.Closer, err error)
	autoExposed  map[uint32]uint32

	configs *Configs
	exposed []ExposedPort
	served  []ServedPort

	state map[uint32]*managedPort
	mu    sync.RWMutex

	subscriptions map[*Subscription]struct{}
	closed        bool
}

type managedPort struct {
	Served     bool
	Exposed    bool
	Visibility api.PortVisibility
	URL        string
	OnExposed  api.OnPortExposedAction

	LocalhostPort uint32
	GlobalPort    uint32
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
func (pm *Manager) Run(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	defer log.Debug("portManager shutdown")

	ctx, cancel := context.WithCancel(ctx)
	defer func() {
		// We copy the subscriptions to a list prior to closing them, to prevent a data race
		// between the map iteration and entry removal when closing the subscription.
		pm.mu.Lock()
		pm.closed = true
		subs := make([]*Subscription, 0, len(pm.subscriptions))
		for s := range pm.subscriptions {
			subs = append(subs, s)
		}
		pm.mu.Unlock()

		for _, s := range subs {
			s.Close()
		}
	}()
	defer cancel()

	go pm.E.Run(ctx)
	exposedUpdates, exposedErrors := pm.E.Observe(ctx)
	servedUpdates, servedErrors := pm.S.Observe(ctx)
	configUpdates, configErrors := pm.C.Observe(ctx)
	for {
		var (
			exposed    []ExposedPort
			served     []ServedPort
			configured *Configs
		)
		select {
		case exposed = <-exposedUpdates:
			if exposed == nil {
				log.Error("exposed ports observer stopped")
				return
			}
		case served = <-servedUpdates:
			if served == nil {
				log.Error("served ports observer stopped")
				return
			}
		case configured = <-configUpdates:
			if configured == nil {
				log.Error("configured ports observer stopped")
				return
			}

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
		case err := <-configErrors:
			if err == nil {
				log.Error("port configs observer stopped")
				return
			}
			log.WithError(err).Warn("error while observing served port configs")
		}

		if exposed == nil && served == nil && configured == nil {
			// we received just an error, but no update
			continue
		}
		pm.updateState(ctx, exposed, served, configured)
	}
}

// Status provides the current port status
func (pm *Manager) Status() []*api.PortsStatus {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return pm.getStatus()
}

func (pm *Manager) updateState(ctx context.Context, exposed []ExposedPort, served []ServedPort, configured *Configs) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if exposed != nil && !reflect.DeepEqual(pm.exposed, exposed) {
		pm.exposed = exposed
	}

	if served != nil {
		var servedKeys []uint32 // to preserve insertion order
		servedMap := make(map[uint32]ServedPort)
		for _, port := range served {
			current, exists := servedMap[port.Port]
			if !exists {
				servedKeys = append(servedKeys, port.Port)
			}
			if !exists || (!port.BoundToLocalhost && current.BoundToLocalhost) {
				servedMap[port.Port] = port
			}
		}
		var newServed []ServedPort
		for _, key := range servedKeys {
			newServed = append(newServed, servedMap[key])
		}
		if !reflect.DeepEqual(pm.served, newServed) {
			pm.served = newServed
			pm.updateProxies()
		}
	}

	if configured != nil {
		pm.configs = configured
	}

	newState := pm.nextState(ctx)
	stateChanged := !reflect.DeepEqual(newState, pm.state)
	pm.state = newState

	if !stateChanged {
		return
	}

	status := pm.getStatus()
	log.WithField("ports", fmt.Sprintf("%+v", status)).Debug("ports changed")
	for sub := range pm.subscriptions {
		select {
		case sub.updates <- status:
		case <-time.After(5 * time.Second):
			log.Error("ports subscription droped out")
			sub.Close()
		}
	}
}

func (pm *Manager) nextState(ctx context.Context) map[uint32]*managedPort {
	state := make(map[uint32]*managedPort)

	// 1. first capture exposed since they don't depend on configured or served ports
	for _, exposed := range pm.exposed {
		port := exposed.LocalPort
		if pm.boundInternally(port) {
			continue
		}

		config, _, _ := pm.configs.Get(port)
		Visibility := api.PortVisibility_private
		if exposed.Public {
			Visibility = api.PortVisibility_public
		}
		state[port] = &managedPort{
			LocalhostPort: port,
			GlobalPort:    exposed.GlobalPort,
			Exposed:       true,
			Visibility:    Visibility,
			URL:           exposed.URL,
			OnExposed:     getOnExposedAction(config, port),
		}
	}

	// 2. second capture configured since we don't want to auto expose already exposed ports
	if pm.configs != nil {
		pm.configs.ForEach(func(port uint32, config *gitpod.PortConfig) {
			if pm.boundInternally(port) {
				return
			}

			mp, exists := state[port]
			if !exists {
				mp = &managedPort{}
				state[port] = mp
			}
			mp.LocalhostPort = port

			if mp.Exposed {
				return
			}
			mp.OnExposed = getOnExposedAction(config, port)

			_, autoExposed := pm.autoExposed[port]
			if autoExposed {
				return
			}
			mp.GlobalPort = port
			mp.Visibility = api.PortVisibility_public
			if config.Visibility == "private" {
				mp.Visibility = api.PortVisibility_private
			}
			public := mp.Visibility == api.PortVisibility_public
			pm.autoExpose(ctx, mp, public)
		})
	}

	// 3. at last capture served ports since
	// we don't want to auto expose already exposed ports on the same port
	// and need configured to decide about default visiblity properly
	for _, served := range pm.served {
		port := served.Port
		if pm.boundInternally(port) {
			continue
		}

		mp, exists := state[port]
		if !exists {
			mp = &managedPort{}
			state[port] = mp
		}

		mp.LocalhostPort = port
		mp.Served = true

		exposedGlobalPort, autoExposed := pm.autoExposed[port]
		if !autoExposed && mp.Exposed {
			exposedGlobalPort = mp.GlobalPort
		}

		if served.BoundToLocalhost {
			proxy, exists := pm.proxies[port]
			if exists {
				mp.GlobalPort = proxy.proxyPort
			} else {
				mp.GlobalPort = 0
			}
		} else {
			// we don't need a proxy - the port is globally bound
			mp.GlobalPort = port
		}

		if mp.GlobalPort == 0 || ((mp.Exposed || autoExposed) && mp.GlobalPort == exposedGlobalPort) {
			continue
		}

		var public bool
		config, kind, exists := pm.configs.Get(mp.LocalhostPort)
		configured := exists && kind == PortConfigKind
		if mp.Exposed || configured {
			public = mp.Visibility == api.PortVisibility_public
		} else {
			public = exists && config.Visibility != "private"
		}

		pm.autoExpose(ctx, mp, public)
	}
	return state
}

// clients should guard a call with check whether such port is already exposed or auto exposed
func (pm *Manager) autoExpose(ctx context.Context, mp *managedPort, public bool) {
	exposing := pm.E.Expose(ctx, mp.LocalhostPort, mp.GlobalPort, public)
	go func() {
		err := <-exposing
		if err != nil {
			if err != context.Canceled {
				log.WithError(err).WithField("port", *mp).Warn("cannot auto-expose port")
			}
			return
		}
		log.WithField("port", *mp).Info("auto-exposed port")
	}()
	pm.autoExposed[mp.LocalhostPort] = mp.GlobalPort
	log.WithField("port", *mp).Info("auto-exposing port")
}

func (pm *Manager) updateProxies() {
	opened := make(map[uint32]struct{}, len(pm.served))
	for _, p := range pm.served {
		opened[p.Port] = struct{}{}
	}

	for localPort, proxy := range pm.proxies {
		globalPort := proxy.proxyPort
		_, openedLocal := opened[localPort]
		_, openedGlobal := opened[globalPort]

		if !openedLocal && openedGlobal {
			delete(pm.proxies, localPort)

			err := proxy.Close()
			if err != nil {
				log.WithError(err).WithField("globalPort", globalPort).WithField("localPort", localPort).Warn("cannot stop localhost proxy")
			} else {
				log.WithField("globalPort", globalPort).WithField("localPort", localPort).Info("localhost proxy has been stopped")
			}
		}

		if !openedGlobal {
			delete(pm.internal, globalPort)
		}
	}

	for _, served := range pm.served {
		localPort := served.Port
		_, exists := pm.proxies[localPort]
		if exists || !served.BoundToLocalhost {
			continue
		}

		var globalPort uint32
		for port := proxyPortRangeHi; port >= proxyPortRangeLo; port-- {
			if _, used := opened[port]; used {
				continue
			}
			if _, used := pm.internal[port]; used {
				continue
			}

			globalPort = port
			break
		}
		if globalPort == 0 {
			log.WithField("port", localPort).Error("cannot find a free proxy port")
			continue
		}

		proxy, err := pm.proxyStarter(localPort, globalPort)
		if err != nil {
			log.WithError(err).WithField("globalPort", globalPort).WithField("localPort", localPort).Warn("cannot start localhost proxy")
			continue
		}
		log.WithField("globalPort", globalPort).WithField("localPort", localPort).Info("localhost proxy has been started")

		pm.internal[globalPort] = struct{}{}
		pm.proxies[localPort] = &localhostProxy{
			Closer:    proxy,
			proxyPort: globalPort,
		}
	}
}

func getOnExposedAction(config *gitpod.PortConfig, port uint32) api.OnPortExposedAction {
	if config == nil {
		// anything above 32767 seems odd (e.g. used by language servers)
		unusualRange := !(0 < port && port < 32767)
		wellKnown := port <= 10000
		if unusualRange || !wellKnown {
			return api.OnPortExposedAction_ignore
		}
		return api.OnPortExposedAction_notify_private
	}
	if config.OnOpen == "ignore" {
		return api.OnPortExposedAction_ignore
	}
	if config.OnOpen == "open-browser" {
		return api.OnPortExposedAction_open_browser
	}
	if config.OnOpen == "open-preview" {
		return api.OnPortExposedAction_open_preview
	}
	return api.OnPortExposedAction_notify
}

func (pm *Manager) boundInternally(port uint32) bool {
	_, exists := pm.internal[port]
	return exists
}

// Expose exposes a port
func (pm *Manager) Expose(ctx context.Context, port uint32, targetPort uint32) error {
	unlock := true
	pm.mu.RLock()
	defer func() {
		if unlock {
			pm.mu.RUnlock()
		}
	}()

	mp, ok := pm.state[port]
	if ok {
		if mp.Exposed {
			return nil
		}
		if pm.boundInternally(port) {
			return xerrors.New("internal service cannot be exposed")
		}
	}

	config, kind, exists := pm.configs.Get(port)
	if exists && kind == PortConfigKind {
		// will be auto-exposed
		return nil
	}

	// we don't need the lock anymore. Let's unlock and make sure the defer doesn't try
	// the same thing again.
	pm.mu.RUnlock()
	unlock = false

	global := targetPort
	if global == 0 {
		global = port
	}
	public := exists && config.Visibility != "private"
	err := <-pm.E.Expose(ctx, port, global, public)
	if err != nil && err != context.Canceled {
		log.WithError(err).WithField("port", port).WithField("targetPort", targetPort).Error("cannot expose port")
	}
	return err
}

var (
	// ErrClosed when the port management is stopped
	ErrClosed = errors.New("closed")
	// ErrTooManySubscriptions when max allowed subscriptions exceed
	ErrTooManySubscriptions = errors.New("too many subscriptions")
)

// Subscribe subscribes for status updates
func (pm *Manager) Subscribe() (*Subscription, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.closed {
		return nil, ErrClosed
	}

	if len(pm.subscriptions) > maxSubscriptions {
		return nil, ErrTooManySubscriptions
	}

	sub := &Subscription{updates: make(chan []*api.PortsStatus, 5)}
	var once sync.Once
	sub.Close = func() error {
		pm.mu.Lock()
		defer pm.mu.Unlock()

		once.Do(func() {
			close(sub.updates)
		})
		delete(pm.subscriptions, sub)

		return nil
	}
	pm.subscriptions[sub] = struct{}{}

	// makes sure that no updates can happen between clients receiving an initial status and subscribing
	sub.updates <- pm.getStatus()
	return sub, nil
}

// getStatus produces an API compatible port status list.
// Callers are expected to hold mu.
func (pm *Manager) getStatus() []*api.PortsStatus {
	res := make([]*api.PortsStatus, 0, len(pm.state))
	for port := range pm.state {
		res = append(res, pm.getPortStatus(port))
	}
	return res
}

func (pm *Manager) getPortStatus(port uint32) *api.PortsStatus {
	mp := pm.state[port]
	ps := &api.PortsStatus{
		GlobalPort: mp.GlobalPort,
		LocalPort:  mp.LocalhostPort,
		Served:     mp.Served,
	}
	if mp.Exposed && mp.URL != "" {
		ps.Exposed = &api.ExposedPortInfo{
			Visibility: mp.Visibility,
			Url:        mp.URL,
			OnExposed:  mp.OnExposed,
		}
	}
	return ps
}

func startLocalhostProxy(localPort uint32, globalPort uint32) (io.Closer, error) {
	host := fmt.Sprintf("localhost:%d", localPort)
	dsturl, err := url.Parse("http://" + host)
	if err != nil {
		return nil, xerrors.Errorf("cannot produce proxy destination URL: %w", err)
	}
	proxy := httputil.NewSingleHostReverseProxy(dsturl)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		req.Host = host
		originalDirector(req)
	}
	proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, err error) {
		log.WithError(err).WithField("local-port", localPort).WithField("url", req.URL.String()).Warn("localhost proxy request failed")
		rw.WriteHeader(http.StatusBadGateway)
	}
	proxyAddr := fmt.Sprintf(":%d", globalPort)
	lis, err := net.Listen("tcp", proxyAddr)
	if err != nil {
		return nil, xerrors.Errorf("cannot listen on proxy port %d: %w", globalPort, err)
	}

	srv := &http.Server{
		Addr:    proxyAddr,
		Handler: proxy,
	}
	go func() {
		err := srv.Serve(lis)
		if err == http.ErrServerClosed {
			return
		}
		log.WithError(err).WithField("local-port", localPort).Error("localhost proxy failed")
	}()

	return srv, nil
}
