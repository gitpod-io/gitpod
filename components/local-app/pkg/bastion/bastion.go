// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package bastion

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	app "github.com/gitpod-io/gitpod/local-app/api"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/google/uuid"
	"github.com/kevinburke/ssh_config"
	"github.com/prometheus/common/log"
	"golang.org/x/crypto/ssh"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	"github.com/sirupsen/logrus"
)

var (
	// ErrClosed when the port management is stopped
	ErrClosed = errors.New("closed")
	// ErrTooManySubscriptions when max allowed subscriptions exceed
	ErrTooManySubscriptions = errors.New("too many subscriptions")
)

// StatusSubscription is a StatusSubscription to status updates
type StatusSubscription struct {
	instanceID string
	updates    chan []*app.TunnelStatus
	Close      func() error
}

func (s *StatusSubscription) Updates() <-chan []*app.TunnelStatus {
	return s.updates
}

type TunnelClient struct {
	ID   string // we cannot use conn session ID, since proto fails to serialize it
	Conn ssh.Conn
}

type TunnelListener struct {
	RemotePort uint32
	LocalAddr  string
	LocalPort  uint32
	Visibility supervisor.TunnelVisiblity
	Ctx        context.Context
	Cancel     func()
}

type Workspace struct {
	InstanceID  string
	WorkspaceID string
	Phase       string
	OwnerToken  string
	URL         string

	supervisorListener *TunnelListener
	supervisorClient   *grpc.ClientConn

	tunnelListenersMu sync.RWMutex
	tunnelListeners   map[uint32]*TunnelListener

	localSSHListener *TunnelListener

	ctx    context.Context
	cancel context.CancelFunc

	tunnelClient          chan chan *TunnelClient
	tunnelClientConnected bool
	portsTunneled         bool
}

func (ws *Workspace) Status() []*app.TunnelStatus {
	ws.tunnelListenersMu.RLock()
	defer ws.tunnelListenersMu.RUnlock()
	res := make([]*app.TunnelStatus, 0, len(ws.tunnelListeners))
	for _, listener := range ws.tunnelListeners {
		res = append(res, &app.TunnelStatus{
			RemotePort: listener.RemotePort,
			LocalPort:  listener.LocalPort,
			Visibility: listener.Visibility,
		})
	}
	return res
}

type Callbacks interface {
	InstanceUpdate(*Workspace)
}

type CompositeCallbacks []Callbacks

func (cb CompositeCallbacks) InstanceUpdate(w *Workspace) {
	for _, c := range cb {
		c.InstanceUpdate(w)
	}
}

type SSHConfigWritingCallback struct {
	Path string

	workspaces map[string]*Workspace
}

func (s *SSHConfigWritingCallback) InstanceUpdate(w *Workspace) {
	if s.workspaces == nil {
		s.workspaces = make(map[string]*Workspace)
	}
	if w.localSSHListener == nil || w.Phase == "stopping" {
		delete(s.workspaces, w.WorkspaceID)
	} else {
		s.workspaces[w.WorkspaceID] = w
	}

	var cfg ssh_config.Config
	for _, ws := range s.workspaces {
		// TODO(cw): don't ignore error
		p, _ := ssh_config.NewPattern(ws.WorkspaceID)

		host, port, _ := net.SplitHostPort(ws.localSSHListener.LocalAddr)
		cfg.Hosts = append(cfg.Hosts, &ssh_config.Host{
			Patterns: []*ssh_config.Pattern{p},
			Nodes: []ssh_config.Node{
				&ssh_config.KV{Key: "HostName", Value: host},
				&ssh_config.KV{Key: "User", Value: "gitpod"},
				&ssh_config.KV{Key: "Port", Value: port},
			},
		})
	}

	err := ioutil.WriteFile(s.Path, []byte(cfg.String()), 0644)
	if err != nil {
		logrus.WithError(err).WithField("path", s.Path).Error("cannot write ssh config file")
		return
	}
}

func New(client gitpod.APIInterface, cb Callbacks) *Bastion {
	ctx, cancel := context.WithCancel(context.Background())
	return &Bastion{
		Client:        client,
		Callbacks:     cb,
		workspaces:    make(map[string]*Workspace),
		ctx:           ctx,
		stop:          cancel,
		updates:       make(chan *gitpod.WorkspaceInstance, 10),
		subscriptions: make(map[*StatusSubscription]struct{}, 10),
	}
}

type Bastion struct {
	id      string
	updates chan *gitpod.WorkspaceInstance

	Client    gitpod.APIInterface
	Callbacks Callbacks

	workspacesMu sync.RWMutex
	workspaces   map[string]*Workspace

	ctx  context.Context
	stop context.CancelFunc

	subscriptionsMu sync.RWMutex
	subscriptions   map[*StatusSubscription]struct{}
}

func (b *Bastion) Run() error {
	updates, err := b.Client.InstanceUpdates(b.ctx, "")
	if err != nil {
		return err
	}

	defer func() {
		// We copy the subscriptions to a list prior to closing them, to prevent a data race
		// between the map iteration and entry removal when closing the subscription.
		b.subscriptionsMu.Lock()
		subs := make([]*StatusSubscription, 0, len(b.subscriptions))
		for s := range b.subscriptions {
			subs = append(subs, s)
		}
		b.subscriptionsMu.Unlock()

		for _, s := range subs {
			s.Close()
		}
	}()

	go func() {
		for u := range b.updates {
			b.handleUpdate(u)
		}
	}()
	b.FullUpdate()

	for u := range updates {
		b.updates <- u
	}
	return nil
}

func (b *Bastion) FullUpdate() {
	wss, err := b.Client.GetWorkspaces(b.ctx, &gitpod.GetWorkspacesOptions{Limit: float64(100)})
	if err != nil {
		logrus.WithError(err).Warn("cannot get workspaces")
	} else {
		for _, ws := range wss {
			if ws.LatestInstance == nil {
				continue
			}
			b.updates <- ws.LatestInstance
		}
	}
}

func (b *Bastion) handleUpdate(u *gitpod.WorkspaceInstance) {
	b.workspacesMu.Lock()
	defer b.workspacesMu.Unlock()

	ws, ok := b.workspaces[u.ID]
	if !ok {
		if u.Status.Phase == "stopping" || u.Status.Phase == "stopped" {
			return
		}
		ctx, cancel := context.WithCancel(b.ctx)
		ws = &Workspace{
			InstanceID:  u.ID,
			WorkspaceID: u.WorkspaceID,

			ctx:    ctx,
			cancel: cancel,

			tunnelClient:    make(chan chan *TunnelClient, 1),
			tunnelListeners: make(map[uint32]*TunnelListener),
		}
	}
	ws.Phase = u.Status.Phase
	ws.URL = u.IdeURL
	ws.OwnerToken = u.Status.OwnerToken
	if ws.OwnerToken == "" && ws.Phase == "running" {
		// updates don't carry the owner token
		go b.FullUpdate()
	}

	switch ws.Phase {
	case "running":
		if ws.OwnerToken != "" && !ws.tunnelClientConnected {
			err := b.connectTunnelClient(ws.ctx, ws)
			if err != nil {
				logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Error("tunnel client failed to connect")
			}
		}
		if ws.supervisorListener == nil && ws.tunnelClientConnected {
			var err error
			ws.supervisorListener, err = b.establishTunnel(ws.ctx, ws, "supervisor", 22999, 0, supervisor.TunnelVisiblity_host)
			if err != nil {
				logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Error("cannot establish supervisor tunnel")
			}
		}

		if ws.supervisorClient == nil && ws.supervisorListener != nil {
			var err error
			ws.supervisorClient, err = grpc.Dial(ws.supervisorListener.LocalAddr, grpc.WithInsecure())
			if err != nil {
				logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Print("error connecting to supervisor")
			} else {
				go func() {
					<-ws.ctx.Done()
					ws.supervisorClient.Close()
				}()
			}
		}

		if ws.supervisorClient != nil && !ws.portsTunneled {
			ws.portsTunneled = true
			go b.tunnelPorts(ws)
		}

		if ws.localSSHListener == nil && ws.supervisorClient != nil {
			var err error
			ws.localSSHListener, err = b.establishSSHTunnel(ws)
			if err != nil {
				logrus.WithError(err).Error("cannot establish SSH tunnel")
			}
		}

	case "stopping", "stopped":
		ws.cancel()
		delete(b.workspaces, u.ID)
		b.Callbacks.InstanceUpdate(ws)
		return
	}

	b.workspaces[u.ID] = ws
	b.Callbacks.InstanceUpdate(ws)
}

func (b *Bastion) connectTunnelClient(ctx context.Context, ws *Workspace) error {
	if ws.URL == "" {
		return fmt.Errorf("IDE URL is empty")
	}
	if ws.OwnerToken == "" {
		return fmt.Errorf("owner token is empty")
	}
	if ws.tunnelClientConnected {
		return fmt.Errorf("tunnel: ssh client is already connected")
	}
	ws.tunnelClientConnected = true

	tunnelURL := ws.URL
	tunnelURL = strings.ReplaceAll(tunnelURL, "https://", "wss://")
	tunnelURL = strings.ReplaceAll(tunnelURL, "http://", "ws://")
	tunnelURL += "/_supervisor/tunnel"
	h := make(http.Header)
	h.Set("x-gitpod-owner-token", ws.OwnerToken)
	webSocket := gitpod.NewReconnectingWebsocket(tunnelURL, h, logrus.WithField("workspace", ws.WorkspaceID))
	go webSocket.Dial()
	go func() {
		var (
			client *TunnelClient
			err    error
		)
		defer func() {
			ws.tunnelClientConnected = false
			webSocket.Close()
			if err != nil {
				logrus.WithField("workspace", ws.WorkspaceID).WithError(err).Error("tunnel: failed to connect ssh client")
			}
			if client != nil {
				logrus.WithField("workspace", ws.WorkspaceID).WithField("id", client.ID).Warn("tunnel: ssh client is permanently closed")
			}
		}()
		client, closed, err := newTunnelClient(ctx, ws, webSocket)
		for {
			if err != nil {
				return
			}
			select {
			case <-ctx.Done():
				return
			case clientCh := <-ws.tunnelClient:
				clientCh <- client
			case <-closed:
				client, closed, err = newTunnelClient(ctx, ws, webSocket)
			}
		}
	}()
	return nil
}

func newTunnelClient(ctx context.Context, ws *Workspace, reconnecting *gitpod.ReconnectingWebsocket) (client *TunnelClient, closed chan struct{}, err error) {
	logrus.WithField("workspace", ws.WorkspaceID).Info("tunnel: trying to connect ssh client...")
	err = reconnecting.EnsureConnection(func(conn *gitpod.WebsocketConnection) (bool, error) {
		id, err := uuid.NewRandom()
		if err != nil {
			return false, err
		}

		sshConn, chans, reqs, err := ssh.NewClientConn(conn, "", &ssh.ClientConfig{
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		})
		if err != nil {
			logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Warn("tunnel: failed to connect ssh client, trying again...")
			return true, err
		}
		logrus.WithField("workspace", ws.WorkspaceID).WithField("id", id).Info("tunnel: ssh client connected")
		go func() {
			conn.Wait()
			sshConn.Close()
		}()
		go ssh.DiscardRequests(reqs)
		go func() {
			for newCh := range chans {
				// TODO(ak) reverse tunneling
				newCh.Reject(ssh.UnknownChannelType, "tunnel: reverse is not supported yet")
			}
		}()
		closed = make(chan struct{}, 1)
		go func() {
			err := sshConn.Wait()
			logrus.WithError(err).WithField("workspace", ws.WorkspaceID).WithField("id", id).Warn("tunnel: ssh client closed")
			close(closed)
		}()
		client = &TunnelClient{
			ID:   id.String(),
			Conn: sshConn,
		}
		return false, nil
	})
	return client, closed, err
}

func (b *Bastion) establishTunnel(ctx context.Context, ws *Workspace, logprefix string, remotePort int, targetPort int, visibility supervisor.TunnelVisiblity) (*TunnelListener, error) {
	if !ws.tunnelClientConnected {
		return nil, fmt.Errorf("tunnel client is not connected")
	}
	if visibility == supervisor.TunnelVisiblity_none {
		return nil, fmt.Errorf("tunnel visibility is none")
	}

	targetHost := "127.0.0.1"
	if visibility == supervisor.TunnelVisiblity_network {
		targetHost = "0.0.0.0"
	}

	netListener, err := net.Listen("tcp", targetHost+":"+strconv.Itoa(targetPort))
	var localPort int
	if err == nil {
		localPort = netListener.(*net.TCPListener).Addr().(*net.TCPAddr).Port
	} else {
		netListener, err = net.Listen("tcp", targetHost+":0")
		if err != nil {
			return nil, err
		}
		localPort = netListener.(*net.TCPListener).Addr().(*net.TCPAddr).Port
	}
	logrus.WithField("workspace", ws.WorkspaceID).Info(logprefix + ": listening on " + netListener.Addr().String() + "...")
	listenerCtx, cancel := context.WithCancel(ctx)
	go func() {
		<-listenerCtx.Done()
		netListener.Close()
		logrus.WithField("workspace", ws.WorkspaceID).Info(logprefix + ": closed")
	}()
	go func() {
		for {
			conn, err := netListener.Accept()
			if listenerCtx.Err() != nil {
				return
			}
			if err != nil {
				logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Warn(logprefix + ": failed to accept connection")
				continue
			}
			logrus.WithField("workspace", ws.WorkspaceID).Debug(logprefix + ": accepted new connection")
			go func() {
				defer logrus.WithField("workspace", ws.WorkspaceID).Debug(logprefix + ": connection closed")
				defer conn.Close()

				clientCh := make(chan *TunnelClient, 1)
				select {
				case <-listenerCtx.Done():
					return
				case ws.tunnelClient <- clientCh:
				}
				client := <-clientCh

				payload, err := proto.Marshal(&supervisor.TunnelPortRequest{
					ClientId:   client.ID,
					Port:       uint32(remotePort),
					TargetPort: uint32(localPort),
				})
				if err != nil {
					logrus.WithError(err).WithField("workspace", ws.WorkspaceID).WithField("id", client.ID).Error(logprefix + ": failed to marshal tunnel payload")
					return
				}
				sshChan, reqs, err := client.Conn.OpenChannel("tunnel", payload)
				if err != nil {
					logrus.WithError(err).WithField("workspace", ws.WorkspaceID).WithField("id", client.ID).Warn(logprefix + ": failed to establish tunnel")
					return
				}
				defer sshChan.Close()
				go ssh.DiscardRequests(reqs)

				ctx, cancel := context.WithCancel(listenerCtx)
				go func() {
					_, _ = io.Copy(sshChan, conn)
					cancel()
				}()
				go func() {
					_, _ = io.Copy(conn, sshChan)
					cancel()
				}()
				<-ctx.Done()
			}()
		}
	}()
	return &TunnelListener{
		RemotePort: uint32(remotePort),
		LocalAddr:  netListener.Addr().String(),
		LocalPort:  uint32(localPort),
		Visibility: visibility,
		Ctx:        listenerCtx,
		Cancel:     cancel,
	}, nil
}

func (b *Bastion) establishSSHTunnel(ws *Workspace) (listener *TunnelListener, err error) {
	key, err := readPublicSSHKey()
	if err != nil {
		// TODO(cw): surface to the user and ask them to run ssh-keygen
		logrus.WithError(err).Warn("no id_rsa.pub file found - will not be able to login via SSH")
	}
	err = installSSHAuthorizedKey(ws, key)
	if err != nil {
		// TODO(cw): surface to the user and ask them install the key manually
		logrus.WithError(err).Warn("cannot install authorized key")
	}
	listener, err = b.establishTunnel(ws.ctx, ws, "ssh", 23001, 0, supervisor.TunnelVisiblity_host)
	return listener, err
}

func readPublicSSHKey() (key string, err error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	res, err := ioutil.ReadFile(filepath.Join(home, ".ssh", "id_rsa.pub"))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(res)), nil
}

func installSSHAuthorizedKey(ws *Workspace, key string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	term := supervisor.NewTerminalServiceClient(ws.supervisorClient)
	tres, err := term.Open(ctx, &supervisor.OpenTerminalRequest{Workdir: "/", Shell: "/bin/sh"})
	if err != nil {
		return err
	}
	//nolint:errcheck
	defer term.Shutdown(ctx, &supervisor.ShutdownTerminalRequest{Alias: tres.Terminal.Alias})

	_, err = term.Write(ctx, &supervisor.WriteTerminalRequest{
		Alias: tres.Terminal.Alias,
		Stdin: []byte(fmt.Sprintf("mkdir -p ~/.ssh; echo %s >> ~/.ssh/authorized_keys\n", key)),
	})
	if err != nil {
		return err
	}

	// give the command some time to execute
	// TODO(cw): synchronize this properly
	time.Sleep(500 * time.Millisecond)

	return nil
}

func (b *Bastion) tunnelPorts(ws *Workspace) {
	defer func() {
		ws.portsTunneled = false
		logrus.WithField("workspace", ws.WorkspaceID).Info("ports tunneling finished")
	}()
	for {
		logrus.WithField("workspace", ws.WorkspaceID).Info("tunneling ports...")
		err := b.doTunnelPorts(ws)
		if ws.ctx.Err() != nil {
			return
		}
		if err != nil {
			logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Warn("ports tunneling failed, retrying...")
		}
		select {
		case <-ws.ctx.Done():
			return
		case <-time.After(1 * time.Second):
		}
	}
}
func (b *Bastion) doTunnelPorts(ws *Workspace) error {
	statusService := supervisor.NewStatusServiceClient(ws.supervisorClient)
	status, err := statusService.PortsStatus(ws.ctx, &supervisor.PortsStatusRequest{
		Observe: true,
	})
	if err != nil {
		return err
	}
	defer b.notify(ws)
	defer func() {
		ws.tunnelListenersMu.Lock()
		defer ws.tunnelListenersMu.Unlock()
		for port, t := range ws.tunnelListeners {
			delete(ws.tunnelListeners, port)
			t.Cancel()
		}
	}()
	for {
		resp, err := status.Recv()
		if err != nil {
			return err
		}
		ws.tunnelListenersMu.Lock()
		currentTunneled := make(map[uint32]struct{})
		for _, port := range resp.Ports {
			visibility := supervisor.TunnelVisiblity_none
			if port.Tunneled != nil {
				visibility = port.Tunneled.Visibility
			}
			listener, alreadyTunneled := ws.tunnelListeners[port.LocalPort]
			if alreadyTunneled && listener.Visibility != visibility {
				listener.Cancel()
				delete(ws.tunnelListeners, port.LocalPort)
			}
			if visibility == supervisor.TunnelVisiblity_none {
				continue
			}
			currentTunneled[port.LocalPort] = struct{}{}
			_, alreadyTunneled = ws.tunnelListeners[port.LocalPort]
			if alreadyTunneled {
				continue
			}
			_, alreadyTunneled = port.Tunneled.Clients[b.id]
			if alreadyTunneled {
				continue
			}

			logprefix := "tunnel[" + supervisor.TunnelVisiblity_name[int32(port.Tunneled.Visibility)] + ":" + strconv.Itoa(int(port.LocalPort)) + "]"
			listener, err := b.establishTunnel(ws.ctx, ws, logprefix, int(port.LocalPort), int(port.Tunneled.TargetPort), port.Tunneled.Visibility)
			if err != nil {
				logrus.WithError(err).WithField("workspace", ws.WorkspaceID).WithField("port", port.LocalPort).Error("cannot establish port tunnel")
			} else {
				ws.tunnelListeners[port.LocalPort] = listener
			}
		}
		for port, listener := range ws.tunnelListeners {
			_, exists := currentTunneled[port]
			if !exists {
				delete(ws.tunnelListeners, port)
				listener.Cancel()
			}
		}
		ws.tunnelListenersMu.Unlock()
		b.notify(ws)
	}
}

func (b *Bastion) notify(ws *Workspace) {
	b.subscriptionsMu.RLock()
	defer b.subscriptionsMu.RUnlock()
	var subs []*StatusSubscription
	for sub := range b.subscriptions {
		if sub.instanceID == ws.InstanceID {
			subs = append(subs, sub)
		}
	}
	if len(subs) <= 0 {
		return
	}
	status := ws.Status()
	for _, sub := range subs {
		select {
		case sub.updates <- status:
		case <-time.After(5 * time.Second):
			log.Error("ports subscription dropped out")
			sub.Close()
		}
	}
}

func (b *Bastion) Status(instanceID string) []*app.TunnelStatus {
	ws, ok := b.getWorkspace(instanceID)
	if !ok {
		return nil
	}
	return ws.Status()
}

func (b *Bastion) getWorkspace(instanceID string) (*Workspace, bool) {
	b.workspacesMu.RLock()
	defer b.workspacesMu.RUnlock()
	ws, ok := b.workspaces[instanceID]
	return ws, ok
}

const maxStatusSubscriptions = 10

func (b *Bastion) Subscribe(instanceID string) (*StatusSubscription, error) {
	b.subscriptionsMu.Lock()
	defer b.subscriptionsMu.Unlock()

	if b.ctx.Err() != nil {
		return nil, ErrClosed
	}

	if len(b.subscriptions) > maxStatusSubscriptions {
		return nil, ErrTooManySubscriptions
	}

	sub := &StatusSubscription{updates: make(chan []*app.TunnelStatus, 5), instanceID: instanceID}
	var once sync.Once
	sub.Close = func() error {
		b.subscriptionsMu.Lock()
		defer b.subscriptionsMu.Unlock()

		once.Do(func() {
			close(sub.updates)
		})
		delete(b.subscriptions, sub)

		return nil
	}
	b.subscriptions[sub] = struct{}{}

	// makes sure that no updates can happen between clients receiving an initial status and subscribing
	sub.updates <- b.Status(instanceID)
	return sub, nil
}
