package sshproxy

import (
	"bytes"
	"fmt"
	"net"
	"net/url"
	"text/template"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"golang.org/x/crypto/ssh"
)

// NewProxy creates a new SSH proxy
func NewProxy(ip proxy.WorkspaceInfoProvider, podConfig *proxy.WorkspacePodConfig, hostKey ssh.Signer) *Proxy {
	var res Proxy
	res.InfoProvider = ip
	res.SSHConfig = &ssh.ServerConfig{
		PasswordCallback: res.passwordAuthCallback,
	}
	res.SSHConfig.AddHostKey(hostKey)
	res.PodConfig = podConfig
	return &res
}

// Proxy can proxy SSH sessions
type Proxy struct {
	SSHConfig    *ssh.ServerConfig
	InfoProvider proxy.WorkspaceInfoProvider
	PodConfig    *proxy.WorkspacePodConfig
}

// Serve serves SSH on the listener
func (p *Proxy) Serve(l net.Listener) {
	for {
		conn, err := l.Accept()
		if err != nil {
			log.WithError(err).Warn("SSH accept failed")
			continue
		}
		go p.handleConn(conn)
	}
}

func (p *Proxy) handleConn(conn net.Conn) {
	defer conn.Close()
	sshConn, chans, reqs, err := ssh.NewServerConn(conn, p.SSHConfig)
	if err != nil {
		log.WithError(err).Warn("handshake failed: ", err)
		return
	}
	go ssh.DiscardRequests(reqs)

	for ch := range chans {
		if ch.ChannelType() != "session" {
			ch.Reject(ssh.UnknownChannelType, "unsupported channel type")
			log.WithFields(log.OWI("", sshConn.User(), "")).Warnf("channel rejected, unsupported type: %v", ch.ChannelType())
			continue
		}
		go p.handleChannel(sshConn, ch)
	}
}

func (p *Proxy) handleChannel(conn *ssh.ServerConn, newChan ssh.NewChannel) {
	workspaceID := conn.User()
	log := log.WithFields(log.OWI("", workspaceID, ""))
	addr, err := buildWorkspacePodURL(p.PodConfig.PortServiceTemplate, workspaceID, fmt.Sprint(p.PodConfig.SSHPort))
	if err != nil {
		newChan.Reject(ssh.ConnectionFailed, err.Error())
		return
	}

	client, err := ssh.Dial("tcp", addr, &ssh.ClientConfig{
		User: "gitpod",
		Auth: []ssh.AuthMethod{
			ssh.Password("gitpod"),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	})
	if err != nil {
		newChan.Reject(ssh.ConnectionFailed, err.Error())
		return
	}
	defer client.Close()
	log.Debug("client dialed")

	workspace, err := client.NewSession()
	if err != nil {
		newChan.Reject(ssh.ConnectionFailed, err.Error())
		return
	}
	log.Debug("new client session")

	incoming, reqs, err := newChan.Accept()
	if err != nil {
		log.Println("newChan.Accept failed:", err)
		return
	}
	log.Debug("channel accepted")

	for req := range reqs {
		log.WithFields(map[string]interface{}{"type": req.Type, "wantreply": req.WantReply, "payload": req.Payload}).Debug("request")

		if req.Type != "shell" {
			ok, err := workspace.SendRequest(req.Type, req.WantReply, req.Payload)
			if err != nil {
				log.WithError(err).Warn("request failed")
			}
			if req.WantReply {
				req.Reply(ok, nil)
			}
			continue
		}

		go func(req *ssh.Request) {
			workspace.Stderr = incoming.Stderr()
			workspace.Stdout = incoming
			workspace.Stdin = incoming

			err = workspace.Shell()
			if err != nil {
				log.WithError(err).Error("cannot start shell")
				req.Reply(false, []byte(err.Error()))
				return
			}

			workspace.Wait()
			log.Debug("workspace wait()")
			req.Reply(true, nil)

			incoming.Close()
		}(req)
	}
}

func (p *Proxy) passwordAuthCallback(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
	log.WithField("instanceId", conn.User()).Debug("attempting password login")
	nfo := p.InfoProvider.WorkspaceInfo(conn.User())
	if nfo == nil {
		return nil, fmt.Errorf("unknown workspace")
	}
	if nfo.Auth.OwnerToken != string(password) {
		return nil, fmt.Errorf("wrong password")
	}

	log.WithField("instanceId", conn.User()).Debug("password login successful")

	return &ssh.Permissions{}, nil
}

// TODO(cw): deduplicate from proxy
func buildWorkspacePodURL(tmpl string, workspaceID string, port string) (string, error) {
	tpl, err := template.New("host").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var out bytes.Buffer
	err = tpl.Execute(&out, map[string]string{
		"workspaceID": workspaceID,
		"port":        port,
	})
	if err != nil {
		return "", err
	}

	u, err := url.Parse(out.String())
	if err != nil {
		return "", err
	}

	return u.Host, nil
}
