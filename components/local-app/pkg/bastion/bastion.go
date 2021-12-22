// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package bastion

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
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

	"github.com/google/uuid"
	"github.com/kevinburke/ssh_config"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/ssh"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	app "github.com/gitpod-io/gitpod/local-app/api"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
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

	tunnelMu        sync.RWMutex
	tunnelListeners map[uint32]*TunnelListener
	tunnelEnabled   bool
	cancelTunnel    context.CancelFunc

	localSSHListener *TunnelListener
	SSHPrivateFN     string
	SSHPublicKey     string

	ctx    context.Context
	cancel context.CancelFunc

	tunnelClient          chan chan *TunnelClient
	tunnelClientConnected bool
}

func (ws *Workspace) Status() []*app.TunnelStatus {
	ws.tunnelMu.RLock()
	defer ws.tunnelMu.RUnlock()
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
	} else if _, exists := s.workspaces[w.WorkspaceID]; !exists {
		s.workspaces[w.WorkspaceID] = w
	}

	var cfg ssh_config.Config
	for _, ws := range s.workspaces {
		p, err := ssh_config.NewPattern(ws.WorkspaceID)
		if err != nil {
			logrus.WithError(err).Warn("cannot produce ssh_config entry")
			continue
		}

		host, port, _ := net.SplitHostPort(ws.localSSHListener.LocalAddr)
		cfg.Hosts = append(cfg.Hosts, &ssh_config.Host{
			Patterns: []*ssh_config.Pattern{p},
			Nodes: []ssh_config.Node{
				&ssh_config.KV{Key: "HostName", Value: host},
				&ssh_config.KV{Key: "User", Value: "gitpod"},
				&ssh_config.KV{Key: "Port", Value: port},
				&ssh_config.KV{Key: "IdentityFile", Value: ws.SSHPrivateFN},
				&ssh_config.KV{Key: "IdentitiesOnly", Value: "yes"},
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
		updates:       make(chan *WorkspaceUpdateRequest, 10),
		subscriptions: make(map[*StatusSubscription]struct{}, 10),
	}
}

type WorkspaceUpdateRequest struct {
	instance *gitpod.WorkspaceInstance
	done     chan *Workspace
}

type Bastion struct {
	id      string
	updates chan *WorkspaceUpdateRequest

	Client    gitpod.APIInterface
	Callbacks Callbacks

	workspacesMu sync.RWMutex
	workspaces   map[string]*Workspace

	ctx  context.Context
	stop context.CancelFunc

	subscriptionsMu sync.RWMutex
	subscriptions   map[*StatusSubscription]struct{}

	EnableAutoTunnel bool
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
		b.updates <- &WorkspaceUpdateRequest{
			instance: u,
		}
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
			b.updates <- &WorkspaceUpdateRequest{
				instance: ws.LatestInstance,
			}
		}
	}
}

func (b *Bastion) Update(workspaceID string) *Workspace {
	ws, err := b.Client.GetWorkspace(b.ctx, workspaceID)
	if err != nil {
		logrus.WithError(err).WithField("WorkspaceID", workspaceID).Error("cannot get workspace")
		return nil
	}
	if ws.LatestInstance == nil {
		return nil
	}
	done := make(chan *Workspace)
	b.updates <- &WorkspaceUpdateRequest{
		instance: ws.LatestInstance,
		done:     done,
	}
	return <-done
}

func (b *Bastion) handleUpdate(ur *WorkspaceUpdateRequest) {
	var ws *Workspace
	u := ur.instance
	defer func() {
		if ur.done != nil {
			ur.done <- ws
			close(ur.done)
		}
	}()

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
			tunnelEnabled:   true,
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
				logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Error("error connecting to supervisor")
			} else {
				go func() {
					<-ws.ctx.Done()
					ws.supervisorClient.Close()
				}()
			}
		}

		if ws.supervisorClient != nil && b.EnableAutoTunnel {
			go b.tunnelPorts(ws)
		}

		if ws.localSSHListener == nil && ws.supervisorClient != nil {
			func() {
				var err error
				ws.SSHPrivateFN, ws.SSHPublicKey, err = generateSSHKeys(ws.InstanceID)
				if err != nil {
					logrus.WithError(err).WithField("workspaceInstanceID", ws.InstanceID).Error("cannot produce SSH keypair")
					return
				}

				ws.localSSHListener, err = b.establishSSHTunnel(ws)
				if err != nil {
					logrus.WithError(err).Error("cannot establish SSH tunnel")
				}
			}()
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

func generateSSHKeys(instanceID string) (privateKeyFN string, publicKey string, err error) {
	privateKeyFN = filepath.Join(os.TempDir(), fmt.Sprintf("gitpod_%s_id_rsa", instanceID))
	useRrandomFile := func() {
		var tmpf *os.File
		tmpf, err = ioutil.TempFile("", "gitpod_*_id_rsa")
		if err != nil {
			return
		}
		tmpf.Close()
		privateKeyFN = tmpf.Name()
	}
	if stat, serr := os.Stat(privateKeyFN); serr == nil && stat.IsDir() {
		useRrandomFile()
	} else if serr == nil {
		var publicKeyRaw []byte
		publicKeyRaw, err = ioutil.ReadFile(privateKeyFN + ".pub")
		publicKey = string(publicKeyRaw)
		if err == nil {
			// we've loaded a pre-existing key - all is well
			return
		}

		logrus.WithError(err).WithField("instance", instanceID).WithField("privateKeyFN", privateKeyFN).Warn("cannot load public SSH key for this workspace")
		useRrandomFile()
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return
	}
	err = privateKey.Validate()
	if err != nil {
		return
	}

	privDER := x509.MarshalPKCS1PrivateKey(privateKey)
	privBlock := pem.Block{
		Type:    "RSA PRIVATE KEY",
		Headers: nil,
		Bytes:   privDER,
	}
	privatePEM := pem.EncodeToMemory(&privBlock)
	err = ioutil.WriteFile(privateKeyFN, privatePEM, 0600)
	if err != nil {
		return
	}

	publicRsaKey, err := ssh.NewPublicKey(&privateKey.PublicKey)
	if err != nil {
		return
	}
	publicKey = string(ssh.MarshalAuthorizedKey(publicRsaKey))
	_ = ioutil.WriteFile(privateKeyFN+".pub", []byte(publicKey), 0644)

	return
}

func (b *Bastion) connectTunnelClient(ctx context.Context, ws *Workspace) error {
	if ws.URL == "" {
		return xerrors.Errorf("IDE URL is empty")
	}
	if ws.OwnerToken == "" {
		return xerrors.Errorf("owner token is empty")
	}
	if ws.tunnelClientConnected {
		return xerrors.Errorf("tunnel: ssh client is already connected")
	}
	ws.tunnelClientConnected = true

	tunnelURL := ws.URL
	tunnelURL = strings.ReplaceAll(tunnelURL, "https://", "wss://")
	tunnelURL = strings.ReplaceAll(tunnelURL, "http://", "ws://")
	tunnelURL += "/_supervisor/tunnel"
	h := make(http.Header)
	h.Set("x-gitpod-owner-token", ws.OwnerToken)
	webSocket := gitpod.NewReconnectingWebsocket(tunnelURL, h, logrus.WithField("workspace", ws.WorkspaceID))
	go webSocket.Dial(ctx)
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
		return nil, xerrors.Errorf("tunnel client is not connected")
	}
	if visibility == supervisor.TunnelVisiblity_none {
		return nil, xerrors.Errorf("tunnel visibility is none")
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
	if ws.SSHPublicKey == "" {
		return nil, xerrors.Errorf("no public key generated")
	}

	err = installSSHAuthorizedKey(ws, ws.SSHPublicKey)
	if err != nil {
		return nil, xerrors.Errorf("cannot install authorized key: %w", err)
	}
	listener, err = b.establishTunnel(ws.ctx, ws, "ssh", 23001, 0, supervisor.TunnelVisiblity_host)
	return listener, err
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

	done := make(chan bool, 1)
	recv, err := term.Listen(ctx, &supervisor.ListenTerminalRequest{Alias: tres.Terminal.Alias})
	if err != nil {
		return err
	}

	go func() {
		defer close(done)
		for {
			resp, err := recv.Recv()
			if err != nil {
				return
			}
			if resp.Output == nil {
				continue
			}
			out, ok := resp.Output.(*supervisor.ListenTerminalResponse_Data)
			if !ok {
				continue
			}
			c := strings.TrimSpace(string(out.Data))
			if strings.HasPrefix(c, "write done") {
				done <- true
				return
			}
		}
	}()
	_, err = term.Write(ctx, &supervisor.WriteTerminalRequest{
		Alias: tres.Terminal.Alias,
		Stdin: []byte(fmt.Sprintf("mkdir -p ~/.ssh; echo %s >> ~/.ssh/authorized_keys; echo write done\r\n", strings.TrimSpace(key))),
	})
	if err != nil {
		return err
	}

	// give the command some time to execute
	select {
	case <-ctx.Done():
		return ctx.Err()
	case success := <-done:
		if !success {
			return xerrors.Errorf("unable to upload SSH key")
		}
	}

	return nil
}

func (b *Bastion) tunnelPorts(ws *Workspace) {
	ws.tunnelMu.Lock()
	if !ws.tunnelEnabled || ws.cancelTunnel != nil {
		ws.tunnelMu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(ws.ctx)
	ws.cancelTunnel = cancel
	ws.tunnelMu.Unlock()

	defer func() {
		ws.tunnelMu.Lock()
		defer ws.tunnelMu.Unlock()

		ws.cancelTunnel = nil
		logrus.WithField("workspace", ws.WorkspaceID).Info("ports tunneling finished")
	}()

	for {
		logrus.WithField("workspace", ws.WorkspaceID).Info("tunneling ports...")

		err := b.doTunnelPorts(ctx, ws)
		if ws.ctx.Err() != nil {
			return
		}
		if err != nil {
			logrus.WithError(err).WithField("workspace", ws.WorkspaceID).Warn("ports tunneling failed, retrying...")
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(1 * time.Second):
		}
	}
}

func (b *Bastion) doTunnelPorts(ctx context.Context, ws *Workspace) error {
	statusService := supervisor.NewStatusServiceClient(ws.supervisorClient)
	status, err := statusService.PortsStatus(ctx, &supervisor.PortsStatusRequest{
		Observe: true,
	})
	if err != nil {
		return err
	}
	defer b.notify(ws)
	defer func() {
		ws.tunnelMu.Lock()
		defer ws.tunnelMu.Unlock()
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
		ws.tunnelMu.Lock()
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
		ws.tunnelMu.Unlock()
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
			logrus.Error("ports subscription dropped out")
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

func (b *Bastion) AutoTunnel(instanceID string, enabled bool) {
	ws, ok := b.getWorkspace(instanceID)
	if !ok {
		return
	}
	ws.tunnelMu.Lock()
	defer ws.tunnelMu.Unlock()
	if ws.tunnelEnabled == enabled {
		return
	}
	ws.tunnelEnabled = enabled
	if enabled {
		if ws.cancelTunnel == nil && b.EnableAutoTunnel {
			b.Update(ws.WorkspaceID)
		}
	} else if ws.cancelTunnel != nil {
		ws.cancelTunnel()
	}
}
