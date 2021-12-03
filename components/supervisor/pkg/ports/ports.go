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
	"sort"
	"sync"
	"time"

	"golang.org/x/net/nettest"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

// NewManager creates a new port manager
func NewManager(exposed ExposedPortsInterface, served ServedPortsObserver, config ConfigInterace, tunneled TunneledPortsInterface, slirp SlirpClient, internalPorts ...uint32) *Manager {
	state := make(map[uint32]*managedPort)
	internal := make(map[uint32]struct{})
	for _, p := range internalPorts {
		internal[p] = struct{}{}
	}

	if slirp != nil {
		for _, p := range internalPorts {
			err := slirp.Expose(p)
			if err != nil {
				log.WithError(err).WithField("port", p).Error("cannot expose port")
			}
		}
	}

	return &Manager{
		E:     exposed,
		S:     served,
		C:     config,
		T:     tunneled,
		Slirp: slirp,

		forceUpdates: make(chan struct{}, 1),

		internal:     internal,
		proxies:      make(map[uint32]*localhostProxy),
		autoExposed:  make(map[uint32]*autoExposure),
		autoTunneled: make(map[uint32]struct{}),

		state:         state,
		subscriptions: make(map[*Subscription]struct{}),
		proxyStarter:  startLocalhostProxy,

		autoTunnelEnabled: true,
	}
}

type localhostProxy struct {
	io.Closer
	proxyPort uint32
}

type autoExposure struct {
	state  api.PortAutoExposure
	ctx    context.Context
	public bool
}

// Manager brings together served and exposed ports. It keeps track of which port is exposed, which one is served,
// auto-exposes ports and proxies ports served on localhost only.
type Manager struct {
	E     ExposedPortsInterface
	S     ServedPortsObserver
	C     ConfigInterace
	T     TunneledPortsInterface
	Slirp SlirpClient

	forceUpdates chan struct{}

	internal     map[uint32]struct{}
	proxies      map[uint32]*localhostProxy
	proxyStarter func(port uint32) (proxy io.Closer, err error)
	autoExposed  map[uint32]*autoExposure

	autoTunneled      map[uint32]struct{}
	autoTunnelEnabled bool

	configs  *Configs
	exposed  []ExposedPort
	served   []ServedPort
	tunneled []PortTunnelState

	state map[uint32]*managedPort
	mu    sync.RWMutex

	subscriptions map[*Subscription]struct{}
	closed        bool
}

type managedPort struct {
	Served       bool
	Exposed      bool
	Visibility   api.PortVisibility
	URL          string
	OnExposed    api.OnPortExposedAction
	AutoExposure api.PortAutoExposure

	LocalhostPort uint32

	Tunneled           bool
	TunneledTargetPort uint32
	TunneledVisibility api.TunnelVisiblity
	TunneledClients    map[string]uint32
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
			_ = s.Close()
		}
	}()
	defer cancel()

	// set a health check for exposed port trough the proxies
	go func() {
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()

		for {
			<-tick.C

			pm.mu.RLock()
			servedGlobal := make(map[uint32]struct{})
			for _, p := range pm.served {
				if !p.BoundToLocalhost {
					servedGlobal[p.Port] = struct{}{}
				}
			}
			pm.mu.RUnlock()

			for localPort, proxy := range pm.proxies {
				_, openedGlobal := servedGlobal[localPort]
				openedLocal := isLocalPortOpen(int(localPort))
				if !openedLocal && openedGlobal {
					pm.mu.Lock()
					delete(pm.proxies, localPort)
					pm.mu.Unlock()

					err := proxy.Close()
					if err != nil {
						log.WithError(err).WithField("localPort", localPort).Warn("cannot stop localhost proxy")
					} else {
						log.WithField("localPort", localPort).Info("localhost proxy has been stopped")
					}
				}
			}
		}
	}()

	go pm.E.Run(ctx)
	exposedUpdates, exposedErrors := pm.E.Observe(ctx)
	servedUpdates, servedErrors := pm.S.Observe(ctx)
	configUpdates, configErrors := pm.C.Observe(ctx)
	tunneledUpdates, tunneledErrors := pm.T.Observe(ctx)
	for {
		var (
			exposed     []ExposedPort
			served      []ServedPort
			configured  *Configs
			tunneled    []PortTunnelState
			forceUpdate bool
		)
		select {
		case <-pm.forceUpdates:
			forceUpdate = true
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
		case tunneled = <-tunneledUpdates:
			if tunneled == nil {
				log.Error("tunneled ports observer stopped")
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
		case err := <-tunneledErrors:
			if err == nil {
				log.Error("tunneled ports observer stopped")
				return
			}
			log.WithError(err).Warn("error while observing tunneled ports")
		}

		if exposed == nil && served == nil && configured == nil && tunneled == nil && !forceUpdate {
			// we received just an error, but no update
			continue
		}
		pm.updateState(ctx, exposed, served, configured, tunneled)
	}
}

// Status provides the current port status
func (pm *Manager) Status() []*api.PortsStatus {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return pm.getStatus()
}

func (pm *Manager) updateState(ctx context.Context, exposed []ExposedPort, served []ServedPort, configured *Configs, tunneled []PortTunnelState) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if exposed != nil && !reflect.DeepEqual(pm.exposed, exposed) {
		pm.exposed = exposed
	}

	if tunneled != nil && !reflect.DeepEqual(pm.tunneled, tunneled) {
		pm.tunneled = tunneled
	}

	if served != nil {
		servedMap := make(map[uint32]ServedPort)
		for _, port := range served {
			current, exists := servedMap[port.Port]
			if !exists || (!port.BoundToLocalhost && current.BoundToLocalhost) {
				servedMap[port.Port] = port
			}
		}

		var servedKeys []uint32
		for k := range servedMap {
			servedKeys = append(servedKeys, k)
		}
		sort.Slice(servedKeys, func(i, j int) bool {
			return servedKeys[i] < servedKeys[j]
		})

		var newServed []ServedPort
		for _, key := range servedKeys {
			newServed = append(newServed, servedMap[key])
		}

		if !reflect.DeepEqual(pm.served, newServed) {
			log.WithField("served", newServed).Debug("updating served ports")
			pm.served = newServed
			pm.updateProxies()
			pm.updateSlirp()
			pm.autoTunnel(ctx)
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
			_ = sub.Close()
		}
	}
}

func (pm *Manager) nextState(ctx context.Context) map[uint32]*managedPort {
	state := make(map[uint32]*managedPort)

	// 1. first capture exposed and tunneled since they don't depend on configured or served ports
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
			Exposed:       true,
			Visibility:    Visibility,
			URL:           exposed.URL,
			OnExposed:     getOnExposedAction(config, port),
		}
	}

	for _, tunneled := range pm.tunneled {
		port := tunneled.Desc.LocalPort
		if pm.boundInternally(port) {
			continue
		}

		mp, exists := state[port]
		if !exists {
			mp = &managedPort{}
			state[port] = mp
		}
		mp.LocalhostPort = port
		mp.Tunneled = true
		mp.TunneledTargetPort = tunneled.Desc.TargetPort
		mp.TunneledVisibility = tunneled.Desc.Visibility
		mp.TunneledClients = tunneled.Clients
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

			autoExpose, autoExposed := pm.autoExposed[port]
			if autoExposed {
				mp.AutoExposure = autoExpose.state
			}
			if mp.Exposed {
				return
			}
			mp.OnExposed = getOnExposedAction(config, port)

			if autoExposed {
				return
			}

			mp.Visibility = api.PortVisibility_private
			if config.Visibility == "public" {
				mp.Visibility = api.PortVisibility_public
			}
			public := mp.Visibility == api.PortVisibility_public
			mp.AutoExposure = pm.autoExpose(ctx, mp.LocalhostPort, public).state
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

		autoExposure, autoExposed := pm.autoExposed[port]
		if autoExposed {
			mp.AutoExposure = autoExposure.state
			continue
		}

		var public bool
		config, kind, exists := pm.configs.Get(mp.LocalhostPort)
		configured := exists && kind == PortConfigKind
		if mp.Exposed || configured {
			public = mp.Visibility == api.PortVisibility_public
		} else {
			public = exists && config.Visibility == "public"
		}

		if mp.Exposed && ((mp.Visibility == api.PortVisibility_public && public) || (mp.Visibility == api.PortVisibility_private && !public)) {
			continue
		}

		mp.AutoExposure = pm.autoExpose(ctx, mp.LocalhostPort, public).state
	}

	var ports []uint32
	for port := range state {
		ports = append(ports, port)
	}

	sort.Slice(ports, func(i, j int) bool {
		return ports[i] < ports[j]
	})

	newState := make(map[uint32]*managedPort)
	for _, mp := range ports {
		newState[mp] = state[mp]
	}

	return newState
}

// clients should guard a call with check whether such port is already exposed or auto exposed
func (pm *Manager) autoExpose(ctx context.Context, localPort uint32, public bool) *autoExposure {
	exposing := pm.E.Expose(ctx, localPort, public)
	autoExpose := &autoExposure{
		state:  api.PortAutoExposure_trying,
		ctx:    ctx,
		public: public,
	}
	go func() {
		err := <-exposing
		if err != nil {
			if err != context.Canceled {
				autoExpose.state = api.PortAutoExposure_failed
				log.WithError(err).WithField("localPort", localPort).Warn("cannot auto-expose port")
			}
			return
		}
		autoExpose.state = api.PortAutoExposure_succeeded
		log.WithField("localPort", localPort).Info("auto-exposed port")

		// wait 1 minute and check if we got the update from the server with exposure information
		select {
		case <-time.After(1 * time.Minute):
			{
				for _, exp := range pm.exposed {
					if exp.LocalPort == localPort {
						// we got the update from server, everything is fine
						return
					}
				}
				// we haven't seen the exposed update from server
				log.WithField("localPort", localPort).Warn("we haven't seen an instance update with port exposure info after 1 minute")
				err = pm.E.TriggerUpdate(ctx)
				if err != nil {
					log.WithError(err).WithField("localPort", localPort).Error("cannot trigger a workspace instance update")
				}
			}
		case <-ctx.Done():
		}
	}()
	pm.autoExposed[localPort] = autoExpose
	log.WithField("localPort", localPort).Info("auto-exposing port")
	return autoExpose
}

// RetryAutoExpose retries auto exposing the give port
func (pm *Manager) RetryAutoExpose(ctx context.Context, localPort uint32) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	autoExpose, autoExposed := pm.autoExposed[localPort]
	if !autoExposed || autoExpose.state != api.PortAutoExposure_failed || autoExpose.ctx.Err() != nil {
		return
	}
	pm.autoExpose(autoExpose.ctx, localPort, autoExpose.public)
	pm.forceUpdate()
}

func (pm *Manager) forceUpdate() {
	if len(pm.forceUpdates) == 0 {
		pm.forceUpdates <- struct{}{}
	}
}

func (pm *Manager) autoTunnel(ctx context.Context) {
	if !pm.autoTunnelEnabled {
		var localPorts []uint32
		for localPort := range pm.autoTunneled {
			localPorts = append(localPorts, localPort)
		}
		// CloseTunnel ensures that everything is closed
		pm.autoTunneled = make(map[uint32]struct{})
		_, err := pm.T.CloseTunnel(ctx, localPorts...)
		if err != nil {
			log.WithError(err).Error("cannot close auto tunneled ports")
		}
		return
	}
	var descs []*PortTunnelDescription
	for _, served := range pm.served {
		if pm.boundInternally(served.Port) {
			continue
		}

		_, autoTunneled := pm.autoTunneled[served.Port]
		if !autoTunneled {
			descs = append(descs, &PortTunnelDescription{
				LocalPort:  served.Port,
				TargetPort: served.Port,
				Visibility: api.TunnelVisiblity_host,
			})
		}
	}
	autoTunneled, err := pm.T.Tunnel(ctx, &TunnelOptions{
		SkipIfExists: true,
	}, descs...)
	if err != nil {
		log.WithError(err).Error("cannot auto tunnel ports")
	}
	for _, localPort := range autoTunneled {
		pm.autoTunneled[localPort] = struct{}{}
	}
}

func (pm *Manager) updateSlirp() {
	if pm.Slirp == nil {
		return
	}

	for _, served := range pm.served {
		err := pm.Slirp.Expose(served.Port)
		if err != nil {
			log.WithError(err).Debug("cannot expose port for slirp")
		}
	}
}

func (pm *Manager) updateProxies() {
	servedLocal := make(map[uint32]struct{})
	servedGlobal := make(map[uint32]struct{})
	for _, p := range pm.served {
		if p.BoundToLocalhost {
			servedLocal[p.Port] = struct{}{}
		} else {
			servedGlobal[p.Port] = struct{}{}
		}
	}

	for _, served := range pm.served {
		localPort := served.Port
		_, exists := pm.proxies[localPort]
		if exists || !served.BoundToLocalhost {
			continue
		}

		proxy, err := pm.proxyStarter(localPort)
		if err != nil {
			log.WithError(err).WithField("localPort", localPort).Warn("cannot start localhost proxy")
			continue
		}
		log.WithField("localPort", localPort).Info("localhost proxy has been started")

		pm.proxies[localPort] = &localhostProxy{
			Closer:    proxy,
			proxyPort: localPort,
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
func (pm *Manager) Expose(ctx context.Context, port uint32) error {
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

	public := exists && config.Visibility != "private"
	err := <-pm.E.Expose(ctx, port, public)
	if err != nil && err != context.Canceled {
		log.WithError(err).WithField("port", port).Error("cannot expose port")
	}
	return err
}

// Tunnel opens a new tunnel.
func (pm *Manager) Tunnel(ctx context.Context, desc *PortTunnelDescription) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if pm.boundInternally(desc.LocalPort) {
		return xerrors.New("cannot tunnel internal port")
	}

	tunneled, err := pm.T.Tunnel(ctx, &TunnelOptions{
		SkipIfExists: false,
	}, desc)
	for _, localPort := range tunneled {
		delete(pm.autoTunneled, localPort)
	}
	return err
}

// CloseTunnel closes the tunnel.
func (pm *Manager) CloseTunnel(ctx context.Context, port uint32) error {
	unlock := true
	pm.mu.RLock()
	defer func() {
		if unlock {
			pm.mu.RUnlock()
		}
	}()

	if pm.boundInternally(port) {
		return xerrors.New("cannot close internal port tunnel")
	}

	// we don't need the lock anymore. Let's unlock and make sure the defer doesn't try
	// the same thing again.
	pm.mu.RUnlock()
	unlock = false

	_, err := pm.T.CloseTunnel(ctx, port)
	return err
}

// EstablishTunnel actually establishes the tunnel
func (pm *Manager) EstablishTunnel(ctx context.Context, clientID string, localPort uint32, targetPort uint32) (net.Conn, error) {
	return pm.T.EstablishTunnel(ctx, clientID, localPort, targetPort)
}

// AutoTunnel controls enablement of auto tunneling
func (pm *Manager) AutoTunnel(ctx context.Context, enabled bool) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.autoTunnelEnabled = enabled
	pm.autoTunnel(ctx)
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
		LocalPort: mp.LocalhostPort,
		Served:    mp.Served,
	}
	if mp.Exposed && mp.URL != "" {
		ps.Exposed = &api.ExposedPortInfo{
			Visibility: mp.Visibility,
			Url:        mp.URL,
			OnExposed:  mp.OnExposed,
		}
	}
	ps.AutoExposure = mp.AutoExposure
	if mp.Tunneled {
		ps.Tunneled = &api.TunneledPortInfo{
			TargetPort: mp.TunneledTargetPort,
			Visibility: mp.TunneledVisibility,
			Clients:    mp.TunneledClients,
		}
	}
	return ps
}

var workspaceIPAdress string

func init() {
	workspaceIPAdress = defaultRoutableIP()
}
func startLocalhostProxy(port uint32) (io.Closer, error) {
	host := fmt.Sprintf("localhost:%d", port)

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
		log.WithError(err).WithField("local-port", port).WithField("url", req.URL.String()).Warn("localhost proxy request failed")
		rw.WriteHeader(http.StatusBadGateway)
	}

	proxyAddr := fmt.Sprintf("%v:%d", workspaceIPAdress, port)
	lis, err := net.Listen("tcp", proxyAddr)
	if err != nil {
		return nil, xerrors.Errorf("cannot listen on proxy port %d: %w", port, err)
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
		log.WithError(err).WithField("local-port", port).Error("localhost proxy failed")
	}()

	return srv, nil
}

func defaultRoutableIP() string {
	iface, err := nettest.RoutedInterface("ip", net.FlagUp|net.FlagBroadcast)
	if err != nil {
		return ""
	}

	iface, err = net.InterfaceByName(iface.Name)
	if err != nil {
		return ""
	}

	addresses, err := iface.Addrs()
	if err != nil {
		return ""
	}

	return addresses[0].(*net.IPNet).IP.String()
}

func isLocalPortOpen(port int) bool {
	timeout := 1 * time.Second
	target := fmt.Sprintf("127.0.0.1:%d", port)
	conn, err := net.DialTimeout("tcp", target, timeout)
	if err != nil {
		return false
	}

	if conn != nil {
		conn.Close()
		return true
	}

	return false
}
