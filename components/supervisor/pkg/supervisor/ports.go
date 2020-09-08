package supervisor

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

const (
	portRefreshInterval = 2 * time.Second
	maxSubscriptions    = 10

	fnNetTCP  = "/proc/net/tcp"
	fnNetTCP6 = "/proc/net/tcp6"
)

var (
	// proxyPortRange is the port range in which we'll try to find
	// ports for proxying localhost-only services.
	proxyPortRange = struct {
		Low  uint32
		High uint32
	}{
		50000,
		60000,
	}
)

func newPortsManager(internalPorts ...uint32) *portsManager {
	state := make(map[uint32]*managedPort)
	for _, p := range internalPorts {
		state[p] = &managedPort{Internal: true}
	}

	return &portsManager{
		state:         state,
		subscriptions: make(map[*portsSubscription]struct{}),
		proxyStarter:  startLocalhostProxy,
	}
}

type portsManager struct {
	state         map[uint32]*managedPort
	subscriptions map[*portsSubscription]struct{}
	mu            sync.RWMutex
	proxyStarter  func(dst *managedPort, openPorts map[uint32]struct{}) (err error)
}

type managedPort struct {
	Internal bool
	Proxied  bool

	LocalhostPort uint32
	GlobalPort    uint32
	Proxy         io.Closer
}

// Run runs the port manager - this function does not return
func (pm *portsManager) Run(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()

	t := time.NewTicker(portRefreshInterval)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}

		var ports []netPort
		for _, fn := range []string{fnNetTCP, fnNetTCP6} {
			fc, err := os.Open(fn)
			if err != nil {
				log.WithError(err).WithField("fn", fn).Warn("cannot update used ports")
				continue
			}
			ps, err := readNetTCPFile(fc, true)
			fc.Close()

			if err != nil {
				log.WithError(err).WithField("fn", fn).Warn("cannot update used ports")
				continue
			}
			ports = append(ports, ps...)
		}

		pm.updateState(ports)
	}
}

func (pm *portsManager) Subscribe() *portsSubscription {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if len(pm.subscriptions) > maxSubscriptions {
		return nil
	}

	sub := &portsSubscription{updates: make(chan []*api.PortsStatus, 5)}
	sub.Close = func() error {
		pm.mu.Lock()
		defer pm.mu.Unlock()

		// We can safely close the channel here even though we're not the
		// producer writing to it, because we're holding mu.
		close(sub.updates)
		delete(pm.subscriptions, sub)

		return nil
	}
	pm.subscriptions[sub] = struct{}{}

	return sub
}

type portsSubscription struct {
	updates chan []*api.PortsStatus
	Close   func() error
}

func (sub *portsSubscription) Updates() <-chan []*api.PortsStatus {
	return sub.updates
}

func (pm *portsManager) ServedPorts() []*api.PortsStatus {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return pm.getStatus()
}

func (pm *portsManager) getStatus() []*api.PortsStatus {
	res := make([]*api.PortsStatus, 0, len(pm.state))
	for _, p := range pm.state {
		if p.Internal || p.Proxied {
			continue
		}

		res = append(res, &api.PortsStatus{
			GlobalPort: p.GlobalPort,
			LocalPort:  p.LocalhostPort,
		})
	}
	return res
}

func (pm *portsManager) updateState(listeningPorts []netPort) {
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

		delete(pm.state, p)
		changes = true
	}

	// add new ports
	for _, p := range listeningPorts {
		if _, exists := pm.state[p.Port]; exists {
			continue
		}

		mp := &managedPort{
			LocalhostPort: p.Port,
		}
		if p.Localhost {
			err := pm.proxyStarter(mp, openPorts)
			if err != nil {
				log.WithError(err).WithField("port", p.Port).Warn("cannot start localhost proxy")
			}

			// we just opened a proxy on the GlobalPort. We need to record this in the state to filter them the next time 'round.
			pm.state[mp.GlobalPort] = &managedPort{Proxied: true, GlobalPort: mp.GlobalPort, LocalhostPort: mp.LocalhostPort}
		} else {
			// we don't need a proxy - the port is globally bound
			mp.GlobalPort = p.Port
		}

		pm.state[p.Port] = mp
		changes = true
	}

	if !changes {
		return
	}
	status := pm.getStatus()
	for sub := range pm.subscriptions {
		select {
		case sub.updates <- status:
		default:
			log.Warn("cannot to push ports update to a subscriber")
		}
	}
}

func startLocalhostProxy(dst *managedPort, openPorts map[uint32]struct{}) (err error) {
	var proxyPort uint32
	for prt := proxyPortRange.High; prt >= proxyPortRange.Low; prt-- {
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

type netPort struct {
	Port      uint32
	Localhost bool
}

func readNetTCPFile(fc io.Reader, listeningOnly bool) (ports []netPort, err error) {
	scanner := bufio.NewScanner(fc)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 4 {
			continue
		}
		if listeningOnly && fields[3] != "0A" {
			continue
		}

		segs := strings.Split(fields[1], ":")
		if len(segs) < 2 {
			continue
		}
		addr, prt := segs[0], segs[1]

		globallyBound := addr == "00000000" || addr == "00000000000000000000000000000000"
		port, err := strconv.ParseUint(prt, 16, 32)
		if err != nil {
			log.WithError(err).WithField("port", prt).Warn("cannot parse port entry from /proc/net/tcp* file")
			continue
		}

		ports = append(ports, netPort{
			Localhost: !globallyBound,
			Port:      uint32(port),
		})
	}
	if err = scanner.Err(); err != nil {
		return nil, err
	}

	return
}
