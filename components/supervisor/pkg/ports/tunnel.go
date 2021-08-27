// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"context"
	"fmt"
	"io"
	"net"
	"sort"
	"strconv"
	"sync"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

type PortTunnelDescription struct {
	LocalPort  uint32
	TargetPort uint32
	Visibility api.TunnelVisiblity
}

type PortTunnelState struct {
	Desc    PortTunnelDescription
	Clients map[string]uint32
}

type PortTunnel struct {
	State PortTunnelState
	Conns map[string]map[net.Conn]struct{}
}

type TunnelOptions struct {
	SkipIfExists bool
}

// TunneledPortsInterface observes the tunneled ports.
type TunneledPortsInterface interface {
	// Observe starts observing the tunneled ports until the context is canceled.
	// The list of tunneled ports is always the complete picture, i.e. if a single port changes,
	// the whole list is returned.
	// When the observer stops operating (because the context as canceled or an irrecoverable
	// error occured), the observer will close both channels.
	Observe(ctx context.Context) (<-chan []PortTunnelState, <-chan error)

	// Tunnel notifies clients to install listeners on remote machines.
	// After that such clients should call EstablishTunnel to forward incoming connections.
	Tunnel(ctx context.Context, options *TunnelOptions, descs ...*PortTunnelDescription) ([]uint32, error)

	// CloseTunnel closes tunnels.
	CloseTunnel(ctx context.Context, localPorts ...uint32) ([]uint32, error)

	// EstablishTunnel actually establishes the tunnel for an incoming connection on a remote machine.
	EstablishTunnel(ctx context.Context, clientID string, localPort uint32, targetPort uint32) (net.Conn, error)
}

// TunneledPortsService observes the tunneled ports.
type TunneledPortsService struct {
	mu      *sync.RWMutex
	cond    *sync.Cond
	tunnels map[uint32]*PortTunnel
}

// NewTunneledPortsService creates a new instance
func NewTunneledPortsService(debugEnable bool) *TunneledPortsService {
	var mu sync.RWMutex
	return &TunneledPortsService{
		mu:      &mu,
		cond:    sync.NewCond(&mu),
		tunnels: make(map[uint32]*PortTunnel),
	}
}

type tunnelConn struct {
	net.Conn
	once       sync.Once
	closeErr   error
	onDidClose func()
}

func (c *tunnelConn) Close() error {
	c.once.Do(func() {
		c.closeErr = c.Conn.Close()
		c.onDidClose()
	})
	return c.closeErr
}

// Observe starts observing the tunneled ports until the context is canceled.
func (p *TunneledPortsService) Observe(ctx context.Context) (<-chan []PortTunnelState, <-chan error) {
	var (
		errchan = make(chan error, 1)
		reschan = make(chan []PortTunnelState)
	)

	go func() {
		defer close(errchan)
		defer close(reschan)

		p.cond.L.Lock()
		defer p.cond.L.Unlock()
		for {
			var i int
			res := make([]PortTunnelState, len(p.tunnels))
			for _, port := range p.tunnels {
				res[i] = port.State
				i++
			}
			reschan <- res

			p.cond.Wait()
			if ctx.Err() != nil {
				return
			}
		}
	}()

	return reschan, errchan
}

func (desc *PortTunnelDescription) validate() (err error) {
	if desc.LocalPort <= 0 || desc.LocalPort > 0xFFFF {
		return xerrors.Errorf("bad local port: %d", desc.LocalPort)
	}
	if desc.TargetPort < 0 || desc.TargetPort > 0xFFFF {
		return xerrors.Errorf("bad target port: %d", desc.TargetPort)
	}
	return nil
}

// Tunnel opens new tunnels.
func (p *TunneledPortsService) Tunnel(ctx context.Context, options *TunnelOptions, descs ...*PortTunnelDescription) (tunneled []uint32, err error) {
	var shouldNotify bool
	p.cond.L.Lock()
	defer p.cond.L.Unlock()
	for _, desc := range descs {
		descErr := desc.validate()
		if descErr != nil {
			if err == nil {
				err = descErr
			} else {
				err = xerrors.Errorf("%s\n%s", err, descErr)
			}
			continue
		}
		tunnel, tunnelExists := p.tunnels[desc.LocalPort]
		if !tunnelExists {
			tunnel = &PortTunnel{
				State: PortTunnelState{
					Clients: make(map[string]uint32),
				},
				Conns: make(map[string]map[net.Conn]struct{}),
			}
			p.tunnels[desc.LocalPort] = tunnel
		} else if options.SkipIfExists {
			continue
		}
		tunnel.State.Desc = *desc
		shouldNotify = true
		tunneled = append(tunneled, desc.LocalPort)
	}
	if shouldNotify {
		p.cond.Broadcast()
	}
	return tunneled, err
}

// CloseTunnel closes tunnels.
func (p *TunneledPortsService) CloseTunnel(ctx context.Context, localPorts ...uint32) (closedPorts []uint32, err error) {
	var closed []*PortTunnel
	p.cond.L.Lock()
	for _, localPort := range localPorts {
		tunnel, existsTunnel := p.tunnels[localPort]
		if !existsTunnel {
			continue
		}
		delete(p.tunnels, localPort)
		closed = append(closed, tunnel)
		closedPorts = append(closedPorts, localPort)
	}
	if len(closed) > 0 {
		p.cond.Broadcast()
	}
	p.cond.L.Unlock()
	for _, tunnel := range closed {
		for _, conns := range tunnel.Conns {
			for conn := range conns {
				closeErr := conn.Close()
				if closeErr == nil {
					continue
				}
				if err == nil {
					err = closeErr
				} else {
					err = xerrors.Errorf("%s\n%s", err, closeErr)
				}
			}
		}
	}
	return closedPorts, err
}

// EstablishTunnel actually establishes the tunnel
func (p *TunneledPortsService) EstablishTunnel(ctx context.Context, clientID string, localPort uint32, targetPort uint32) (net.Conn, error) {
	p.cond.L.Lock()
	defer p.cond.L.Unlock()

	tunnel, tunnelExists := p.tunnels[localPort]
	if tunnelExists {
		expectedTargetPort, clientExists := tunnel.State.Clients[clientID]
		if clientExists && expectedTargetPort != targetPort {
			return nil, xerrors.Errorf("client '%s': %d:%d is already tunneling", clientID, localPort, targetPort)
		}
	} else {
		return nil, xerrors.Errorf("client '%s': '%d' tunnel does not exist", clientID, localPort)
	}

	addr := net.JoinHostPort("localhost", strconv.FormatInt(int64(localPort), 10))
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return nil, err
	}
	var result net.Conn
	result = &tunnelConn{
		Conn: conn,
		onDidClose: func() {
			p.cond.L.Lock()
			defer p.cond.L.Unlock()
			_, existsTunnel := p.tunnels[localPort]
			if !existsTunnel {
				return
			}
			delete(tunnel.Conns[clientID], result)
			if len(tunnel.Conns[clientID]) == 0 {
				delete(tunnel.State.Clients, clientID)
			}
			p.cond.Broadcast()
		},
	}
	if tunnel.Conns[clientID] == nil {
		tunnel.Conns[clientID] = make(map[net.Conn]struct{})
	}
	tunnel.Conns[clientID][result] = struct{}{}
	tunnel.State.Clients[clientID] = targetPort
	p.cond.Broadcast()
	return result, nil
}

// Snapshot writes a snapshot to w.
func (p *TunneledPortsService) Snapshot(w io.Writer) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	localPorts := make([]uint32, 0, len(p.tunnels))
	for k := range p.tunnels {
		localPorts = append(localPorts, k)
	}
	sort.Slice(localPorts, func(i, j int) bool { return localPorts[i] < localPorts[j] })

	for _, localPort := range localPorts {
		tunnel := p.tunnels[localPort]
		fmt.Fprintf(w, "Local Port: %d\n", tunnel.State.Desc.LocalPort)
		fmt.Fprintf(w, "Target Port: %d\n", tunnel.State.Desc.TargetPort)
		visibilty := api.TunnelVisiblity_name[int32(tunnel.State.Desc.Visibility)]
		fmt.Fprintf(w, "Visibility: %s\n", visibilty)
		for clientID, remotePort := range tunnel.State.Clients {
			fmt.Fprintf(w, "Client: %s\n", clientID)
			fmt.Fprintf(w, "  Remote Port: %d\n", remotePort)
			fmt.Fprintf(w, "  Tunnel Count: %d\n", len(tunnel.Conns[clientID]))
		}
		fmt.Fprintf(w, "\n")
	}
}
