// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"reflect"
	"sort"
	"sync"
	"time"

	"golang.org/x/net/nettest"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/nftables"
	"github.com/google/nftables/expr"
)

var workspaceIPAdress string
var ifaceName string

func init() {
	ifaceName, workspaceIPAdress = defaultRoutableIP()
}

// NewManager creates a new port manager
func NewManager(exposed ExposedPortsInterface, served ServedPortsObserver, config ConfigInterace, tunneled TunneledPortsInterface, internalPorts ...uint32) *Manager {
	state := make(map[uint32]*managedPort)
	internal := make(map[uint32]struct{})
	for _, p := range internalPorts {
		internal[p] = struct{}{}
	}

	return &Manager{
		E: exposed,
		S: served,
		C: config,
		T: tunneled,

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
	state    api.PortAutoExposure
	ctx      context.Context
	public   bool
	protocol string
}

// Manager brings together served and exposed ports. It keeps track of which port is exposed, which one is served,
// auto-exposes ports and proxies ports served on localhost only.
type Manager struct {
	E ExposedPortsInterface
	S ServedPortsObserver
	C ConfigInterace
	T TunneledPortsInterface

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
	Protocol     api.PortProtocol
	Description  string
	Name         string
	URL          string
	OnExposed    api.OnPortExposedAction // deprecated
	OnOpen       api.PortsStatus_OnOpenAction
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
				if ctx.Err() == nil {
					log.Error("exposed ports observer stopped unexpectedly")
				}
				return
			}
		case served = <-servedUpdates:
			if served == nil {
				if ctx.Err() == nil {
					log.Error("served ports observer stopped unexpectedly")
				}
				return
			}
		case configured = <-configUpdates:
			if configured == nil {
				if ctx.Err() == nil {
					log.Error("configured ports observer stopped unexpectedly")
				}
				return
			}
		case tunneled = <-tunneledUpdates:
			if tunneled == nil {
				if ctx.Err() == nil {
					log.Error("tunneled ports observer stopped unexpectedly")
				}
				return
			}

		case err := <-exposedErrors:
			if err == nil {
				if ctx.Err() == nil {
					log.Error("exposed ports observer stopped unexpectedly")
				}
				return
			}
			log.WithError(err).Warn("error while observing exposed ports")
		case err := <-servedErrors:
			if err == nil {
				if ctx.Err() == nil {
					log.Error("served ports observer stopped unexpectedly")
				}
				return
			}
			log.WithError(err).Warn("error while observing served ports")
		case err := <-configErrors:
			if err == nil {
				if ctx.Err() == nil {
					log.Error("port configs observer stopped unexpectedly")
				}
				return
			}
			log.WithError(err).Warn("error while observing served port configs")
		case err := <-tunneledErrors:
			if err == nil {
				if ctx.Err() == nil {
					log.Error("tunneled ports observer stopped unexpectedly")
				}
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
			if _, existProxy := pm.proxies[port.Port]; existProxy && port.Address.String() == workspaceIPAdress {
				// Ignore entries that are bound to the workspace ip address
				// as they are created by the internal reverse proxy
				continue
			}

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
			pm.autoTunnel(ctx)
		}
	}

	if configured != nil {
		pm.configs = configured
	}

	newState := pm.nextState(ctx)
	stateChanged := !reflect.DeepEqual(newState, pm.state)
	pm.state = newState

	if !stateChanged && configured == nil {
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

	genManagedPort := func(port uint32) *managedPort {
		if mp, exists := state[port]; exists {
			return mp
		}
		config, _, exists := pm.configs.Get(port)
		var portConfig *gitpod.PortConfig
		if exists && config != nil {
			portConfig = &config.PortConfig
		}
		mp := &managedPort{
			LocalhostPort: port,
			OnExposed:     getOnExposedAction(portConfig, port),
			OnOpen:        getOnOpenAction(portConfig, port),
		}
		if exists {
			mp.Name = config.Name
			mp.Description = config.Description
		}
		state[port] = mp
		return mp
	}

	// 1. first capture exposed and tunneled since they don't depend on configured or served ports
	for _, exposed := range pm.exposed {
		port := exposed.LocalPort
		if pm.boundInternally(port) {
			continue
		}
		Visibility := api.PortVisibility_private
		if exposed.Public {
			Visibility = api.PortVisibility_public
		}
		portProtocol := api.PortProtocol_http
		if exposed.Protocol == gitpod.PortProtocolHTTPS {
			portProtocol = api.PortProtocol_https
		}
		mp := genManagedPort(port)
		mp.Exposed = true
		mp.Protocol = portProtocol
		mp.Visibility = Visibility
		mp.URL = exposed.URL
	}

	for _, tunneled := range pm.tunneled {
		port := tunneled.Desc.LocalPort
		if pm.boundInternally(port) {
			continue
		}
		mp := genManagedPort(port)
		mp.Tunneled = true
		mp.TunneledTargetPort = tunneled.Desc.TargetPort
		mp.TunneledVisibility = tunneled.Desc.Visibility
		mp.TunneledClients = tunneled.Clients
	}

	// 2. second capture configured since we don't want to auto expose already exposed ports
	if pm.configs != nil {
		pm.configs.ForEach(func(port uint32, config *SortConfig) {
			if pm.boundInternally(port) {
				return
			}
			mp := genManagedPort(port)
			autoExpose, autoExposed := pm.autoExposed[port]
			if autoExposed {
				mp.AutoExposure = autoExpose.state
			}
			if mp.Exposed || autoExposed {
				return
			}

			mp.Visibility = api.PortVisibility_private
			if config.Visibility == "public" {
				mp.Visibility = api.PortVisibility_public
			}
			public := mp.Visibility == api.PortVisibility_public
			mp.AutoExposure = pm.autoExpose(ctx, mp.LocalhostPort, public, config.Protocol).state
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
		mp := genManagedPort(port)
		mp.Served = true

		autoExposure, autoExposed := pm.autoExposed[port]
		if autoExposed {
			mp.AutoExposure = autoExposure.state
			continue
		}

		var public bool
		protocol := "http"
		config, kind, exists := pm.configs.Get(mp.LocalhostPort)

		getProtocol := func(p api.PortProtocol) string {
			switch p {
			case api.PortProtocol_https:
				return "https"
			default:
				return "http"
			}
		}

		configured := exists && kind == PortConfigKind
		if mp.Exposed || configured {
			public = mp.Visibility == api.PortVisibility_public
			protocol = getProtocol(mp.Protocol)
		} else if exists {
			public = config.Visibility == "public"
			protocol = config.Protocol
		}

		if mp.Exposed && ((mp.Visibility == api.PortVisibility_public && public) || (mp.Visibility == api.PortVisibility_private && !public)) && protocol != "https" {
			continue
		}

		mp.AutoExposure = pm.autoExpose(ctx, mp.LocalhostPort, public, protocol).state
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
func (pm *Manager) autoExpose(ctx context.Context, localPort uint32, public bool, protocol string) *autoExposure {
	exposing := pm.E.Expose(ctx, localPort, public, protocol)
	autoExpose := &autoExposure{
		state:    api.PortAutoExposure_trying,
		ctx:      ctx,
		public:   public,
		protocol: protocol,
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
	pm.autoExpose(autoExpose.ctx, localPort, autoExpose.public, autoExpose.protocol)
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

func (pm *Manager) updateProxies() {
	servedPortMap := map[uint32]bool{}
	for _, s := range pm.served {
		servedPortMap[s.Port] = s.BoundToLocalhost
	}

	for port, proxy := range pm.proxies {
		if boundToLocalhost, exists := servedPortMap[port]; !exists || !boundToLocalhost {
			delete(pm.proxies, port)
			err := proxy.Close()
			if err != nil {
				log.WithError(err).WithField("localPort", port).Warn("cannot stop localhost proxy")
			} else {
				log.WithField("localPort", port).Info("localhost proxy has been stopped")
			}
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

// deprecated
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

func getOnOpenAction(config *gitpod.PortConfig, port uint32) api.PortsStatus_OnOpenAction {
	if config == nil {
		// anything above 32767 seems odd (e.g. used by language servers)
		unusualRange := !(0 < port && port < 32767)
		wellKnown := port <= 10000
		if unusualRange || !wellKnown {
			return api.PortsStatus_ignore
		}
		return api.PortsStatus_notify_private
	}
	if config.OnOpen == "ignore" {
		return api.PortsStatus_ignore
	}
	if config.OnOpen == "open-browser" {
		return api.PortsStatus_open_browser
	}
	if config.OnOpen == "open-preview" {
		return api.PortsStatus_open_preview
	}
	return api.PortsStatus_notify
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
	err := <-pm.E.Expose(ctx, port, public, config.Protocol)
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
	sort.SliceStable(res, func(i, j int) bool {
		// Max number of port 65536
		score1 := NON_CONFIGED_BASIC_SCORE + res[i].LocalPort
		score2 := NON_CONFIGED_BASIC_SCORE + res[j].LocalPort
		if c, _, ok := pm.configs.Get(res[i].LocalPort); ok {
			score1 = c.Sort
		}
		if c, _, ok := pm.configs.Get(res[j].LocalPort); ok {
			score2 = c.Sort
		}
		if score1 != score2 {
			return score1 < score2
		}
		// Ranged ports
		return res[i].LocalPort < res[j].LocalPort
	})
	return res
}

func (pm *Manager) getPortStatus(port uint32) *api.PortsStatus {
	mp := pm.state[port]
	ps := &api.PortsStatus{
		LocalPort:   mp.LocalhostPort,
		Served:      mp.Served,
		Description: mp.Description,
		Name:        mp.Name,
		OnOpen:      mp.OnOpen,
	}
	if mp.Exposed && mp.URL != "" {
		ps.Exposed = &api.ExposedPortInfo{
			Visibility: mp.Visibility,
			Protocol:   mp.Protocol,
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

type nftPortForwarder struct {
	nc    *nftables.Conn
	table *nftables.Table
	port  uint16
}

func NewNftPortForwarder(port uint16) *nftPortForwarder {
	return &nftPortForwarder{
		port: port,
		nc:   &nftables.Conn{},
	}
}

func (n *nftPortForwarder) Run() error {
	table := n.nc.AddTable(&nftables.Table{
		Family: nftables.TableFamilyIPv4,
		Name:   fmt.Sprintf("pf-%d", n.port),
	})

	prerouting := n.nc.AddChain(&nftables.Chain{
		Name:     fmt.Sprintf("pf-%d", n.port),
		Hooknum:  nftables.ChainHookPrerouting,
		Priority: nftables.ChainPriorityNATDest,
		Table:    table,
		Type:     nftables.ChainTypeNAT,
	})

	chains, _ := n.nc.ListChains()
	for _, c := range chains {
		fmt.Println(c.Name, c.Hooknum)
	}

	localIp := net.IPNet{
		IP:   net.IPv4(127, 0, 0, 1),
		Mask: net.IPv4Mask(255, 0, 0, 0),
	}

	// iifname $containerIf tcp dport $port dnat to $localhost:tcp dport
	n.nc.AddRule(&nftables.Rule{
		Table: table,
		Chain: prerouting,
		Exprs: []expr.Any{
			&expr.Meta{Key: expr.MetaKeyIIFNAME, Register: 1},
			&expr.Cmp{
				Op:       expr.CmpOpEq,
				Register: 1,
				Data:     []byte(ifaceName + "\x00"),
			},

			&expr.Meta{Key: expr.MetaKeyL4PROTO, Register: 1},
			&expr.Cmp{
				Op:       expr.CmpOpEq,
				Register: 1,
				Data:     []byte{unix.IPPROTO_TCP},
			},
			&expr.Payload{
				DestRegister: 1,
				Base:         expr.PayloadBaseTransportHeader,
				Offset:       2,
				Len:          2,
			},

			&expr.Cmp{
				Op:       expr.CmpOpEq,
				Register: 1,
				Data:     []byte{byte(n.port >> 8), byte(n.port & 0xff)},
			},

			&expr.Immediate{
				Register: 2,
				Data:     localIp.IP.To4(),
			},
			&expr.NAT{
				Type:        expr.NATTypeDestNAT,
				Family:      unix.NFPROTO_IPV4,
				RegAddrMin:  2,
				RegProtoMin: 1,
			},
		},
	})
	n.table = table
	if err := n.nc.Flush(); err != nil {
		return xerrors.Errorf("failed to apply nftables: %v", err)
	}
	return nil
}

func (n *nftPortForwarder) Close() error {
	if n.table != nil {
		n.nc.DelTable(n.table)
		if err := n.nc.Flush(); err != nil {
			return xerrors.Errorf("failed to apply nftables: %v", err)
		}
	}
	return nil
}

func startLocalhostProxy(port uint32) (io.Closer, error) {
	r := NewNftPortForwarder(uint16(port))
	if err := r.Run(); err != nil {
		return nil, err
	}
	return r, nil
}

func defaultRoutableIP() (string, string) {
	iface, err := nettest.RoutedInterface("ip", net.FlagUp|net.FlagBroadcast)
	if err != nil {
		return "", ""
	}

	iface, err = net.InterfaceByName(iface.Name)
	if err != nil {
		return "", ""
	}

	addresses, err := iface.Addrs()
	if err != nil {
		return "", ""
	}

	return iface.Name, addresses[0].(*net.IPNet).IP.String()
}
