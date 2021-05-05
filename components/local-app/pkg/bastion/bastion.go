// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package bastion

import (
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/kevinburke/ssh_config"
	"google.golang.org/grpc"

	chisel "github.com/jpillora/chisel/client"
	"github.com/sirupsen/logrus"
)

type Workspace struct {
	WorkspaceID string
	Phase       string
	OwnerToken  string
	URL         string

	LocalSupervisorPort int
	LocalSSHPort        int

	ctx    context.Context
	cancel context.CancelFunc
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
	if w.LocalSSHPort == 0 || w.Phase == "stopping" {
		delete(s.workspaces, w.WorkspaceID)
	} else {
		s.workspaces[w.WorkspaceID] = w
	}

	var cfg ssh_config.Config
	for _, ws := range s.workspaces {
		// TODO(cw): don't ignore error
		p, _ := ssh_config.NewPattern(ws.WorkspaceID)

		cfg.Hosts = append(cfg.Hosts, &ssh_config.Host{
			Patterns: []*ssh_config.Pattern{p},
			Nodes: []ssh_config.Node{
				&ssh_config.KV{Key: "HostName", Value: "127.0.0.1"},
				&ssh_config.KV{Key: "User", Value: "gitpod"},
				&ssh_config.KV{Key: "Port", Value: strconv.Itoa(ws.LocalSSHPort)},
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
		Client:     client,
		Callbacks:  cb,
		workspaces: make(map[string]*Workspace),
		ctx:        ctx,
		stop:       cancel,
	}
}

type Bastion struct {
	Client    gitpod.APIInterface
	Callbacks Callbacks

	workspaces map[string]*Workspace

	ctx  context.Context
	stop context.CancelFunc
}

func (b *Bastion) Run() error {
	updates, err := b.Client.InstanceUpdates(b.ctx, "")
	if err != nil {
		return err
	}

	uchan := make(chan *gitpod.WorkspaceInstance, 10)
	go b.acceptUpdates(uchan)
	b.fullUpdate(uchan)

	for u := range updates {
		uchan <- u
	}
	return nil
}

func (b *Bastion) fullUpdate(uchan chan<- *gitpod.WorkspaceInstance) {
	wss, err := b.Client.GetWorkspaces(b.ctx, &gitpod.GetWorkspacesOptions{Limit: float64(100)})
	if err != nil {
		logrus.WithError(err).Warn("cannot get workspaces")
	} else {
		for _, ws := range wss {
			if ws.LatestInstance == nil {
				continue
			}
			uchan <- ws.LatestInstance
		}
	}
}

func (b *Bastion) acceptUpdates(updates chan *gitpod.WorkspaceInstance) {
	for u := range updates {
		ws, ok := b.workspaces[u.ID]
		if !ok && u.Status.Phase != "stopping" {
			ctx, cancel := context.WithCancel(b.ctx)
			ws = &Workspace{
				WorkspaceID: u.WorkspaceID,

				ctx:    ctx,
				cancel: cancel,
			}
		}
		ws.Phase = u.Status.Phase
		ws.URL = u.IdeURL
		ws.OwnerToken = u.Status.OwnerToken
		if ws.OwnerToken == "" && ws.Phase == "running" {
			// updates don't carry the owner token
			go b.fullUpdate(updates)
		}

		switch ws.Phase {
		case "running":
			if ws.LocalSupervisorPort == 0 && ws.OwnerToken != "" {
				var err error
				ws.LocalSupervisorPort, err = b.establishChiselTunnel(ws, "supervisor", 22999)
				if err != nil {
					logrus.WithError(err).Error("cannot establish supervisor tunnel")
				}

				logrus.WithField("workspace", ws.WorkspaceID).WithField("supervisor port", ws.LocalSupervisorPort).Info("established supervisor channel")
			}

			if ws.LocalSSHPort == 0 && ws.LocalSupervisorPort != 0 {
				var err error
				ws.LocalSSHPort, err = b.establishSSHTunnel(ws)
				if err != nil {
					logrus.WithError(err).Error("cannot establish SSH tunnel")
				}
			}

		case "stopping":
			ws.cancel()
			delete(b.workspaces, ws.WorkspaceID)
			b.Callbacks.InstanceUpdate(ws)
			return
		}

		b.workspaces[u.ID] = ws
		b.Callbacks.InstanceUpdate(ws)
	}
}

func (b *Bastion) establishChiselTunnel(ws *Workspace, logprefix string, remotePort int) (localPort int, err error) {
	if ws.URL == "" {
		return 0, fmt.Errorf("IDE URL is empty")
	}
	if ws.OwnerToken == "" {
		return 0, fmt.Errorf("owner token is empty")
	}

	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}
	localPort = l.(*net.TCPListener).Addr().(*net.TCPAddr).Port
	l.Close()

	h := make(http.Header)
	h.Set("x-gitpod-owner-token", ws.OwnerToken)
	cl, err := chisel.NewClient(&chisel.Config{
		KeepAlive: 10 * time.Second,
		Headers:   h,
		Server:    ws.URL + "/_supervisor",
		Remotes:   []string{fmt.Sprintf("%d:%d", localPort, remotePort)},
	})
	cl.Logger = cl.Logger.Fork(logprefix)
	if err != nil {
		return 0, err
	}
	err = cl.Start(ws.ctx)
	if err != nil {
		return 0, err
	}
	go func() {
		for ws.ctx.Err() == nil {
			_ = cl.Wait()
			time.Sleep(100 * time.Millisecond)
			logrus.Debugf("reconnecting %s", logprefix)
			_ = cl.Start(ws.ctx)
		}
	}()
	return
}

func (b *Bastion) establishSSHTunnel(ws *Workspace) (localPort int, err error) {
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

	return b.establishChiselTunnel(ws, "ssh", 23001)
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
	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", ws.LocalSupervisorPort), grpc.WithInsecure())
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	term := supervisor.NewTerminalServiceClient(conn)
	tres, err := term.Open(ctx, &supervisor.OpenTerminalRequest{Workdir: "/", Shell: "/bin/sh"})
	if err != nil {
		return err
	}
	//nolint:errcheck
	term.Shutdown(ctx, &supervisor.ShutdownTerminalRequest{Alias: tres.Terminal.Alias})

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
