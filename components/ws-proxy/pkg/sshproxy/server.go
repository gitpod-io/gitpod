// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package sshproxy

import (
	"context"
	"crypto/subtle"
	"net"
	"regexp"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	tracker "github.com/gitpod-io/gitpod/ws-proxy/pkg/analytics"
	p "github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"github.com/gitpod-io/golang-crypto/ssh"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
)

const GitpodUsername = "gitpod"

// This is copy from proxy/workspacerouter.go
const workspaceIDRegex = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11})"

var (
	SSHConnectionCount = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "gitpod_ws_proxy_ssh_connection_count",
		Help: "Current number of SSH connection",
	})

	SSHAttemptTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "gitpod_ws_proxy_ssh_attempt_total",
		Help: "Total number of SSH attempt",
	}, []string{"status", "error_type"})
)

var (
	ErrWorkspaceNotFound  = NewSSHErrorWithReject("WS_NOTFOUND", "not found workspace")
	ErrWorkspaceIDInvalid = NewSSHErrorWithReject("WS_ID_INVALID", "workspace id invalid")
	ErrUsernameFormat     = NewSSHErrorWithReject("USER_FORMAT", "username format is not correct")
	ErrMissPrivateKey     = NewSSHErrorWithReject("MISS_KEY", "missing privateKey")
	ErrConnFailed         = NewSSHError("CONN_FAILED", "cannot to connect with workspace")
	ErrCreateSSHKey       = NewSSHError("CREATE_KEY_FAILED", "cannot create private pair in workspace")

	ErrAuthFailed = NewSSHError("AUTH_FAILED", "auth failed")
	// ErrAuthFailedWithReject is same with ErrAuthFailed, it will just disconnect immediately to avoid pointless retries
	ErrAuthFailedWithReject = NewSSHErrorWithReject("AUTH_FAILED", "auth failed")
)

type SSHError struct {
	shortName   string
	description string
	err         error
}

func (e SSHError) Error() string {
	return e.description
}

func (e SSHError) ShortName() string {
	return e.shortName
}
func (e SSHError) Unwrap() error {
	return e.err
}

func NewSSHError(shortName string, description string) SSHError {
	return SSHError{shortName: shortName, description: description}
}

func NewSSHErrorWithReject(shortName string, description string) SSHError {
	return SSHError{shortName: shortName, description: description, err: ssh.ErrDenied}
}

type Session struct {
	Conn *ssh.ServerConn

	WorkspaceID string
	InstanceID  string
	OwnerUserId string

	PublicKey           ssh.PublicKey
	WorkspacePrivateKey ssh.Signer
}

type Server struct {
	Heartbeater Heartbeat

	sshConfig             *ssh.ServerConfig
	workspaceInfoProvider p.WorkspaceInfoProvider
}

func init() {
	metrics.Registry.MustRegister(
		SSHConnectionCount,
		SSHAttemptTotal,
	)
}

// New creates a new SSH proxy server

func New(signers []ssh.Signer, workspaceInfoProvider p.WorkspaceInfoProvider, heartbeat Heartbeat) *Server {
	server := &Server{
		workspaceInfoProvider: workspaceInfoProvider,
		Heartbeater:           &noHeartbeat{},
	}
	if heartbeat != nil {
		server.Heartbeater = heartbeat
	}

	server.sshConfig = &ssh.ServerConfig{
		ServerVersion: "SSH-2.0-GITPOD-GATEWAY",
		NoClientAuth:  true,
		NoClientAuthCallback: func(conn ssh.ConnMetadata) (*ssh.Permissions, error) {
			args := strings.Split(conn.User(), "#")
			workspaceId := args[0]
			var debugWorkspace string
			if strings.HasPrefix(workspaceId, "debug-") {
				debugWorkspace = "true"
				workspaceId = strings.TrimPrefix(workspaceId, "debug-")
			}
			wsInfo, err := server.GetWorkspaceInfo(workspaceId)
			if err != nil {
				return nil, err
			}
			// NoClientAuthCallback only support workspaceId#ownerToken
			if len(args) != 2 {
				return nil, ssh.ErrNoAuth
			}
			if wsInfo.Auth.OwnerToken != args[1] {
				return nil, ErrAuthFailedWithReject
			}
			server.TrackSSHConnection(wsInfo, "auth", nil)
			return &ssh.Permissions{
				Extensions: map[string]string{
					"workspaceId":    workspaceId,
					"debugWorkspace": debugWorkspace,
				},
			}, nil
		},
		PasswordCallback: func(conn ssh.ConnMetadata, password []byte) (perm *ssh.Permissions, err error) {
			workspaceId, ownerToken := conn.User(), string(password)
			var debugWorkspace string
			if strings.HasPrefix(workspaceId, "debug-") {
				debugWorkspace = "true"
				workspaceId = strings.TrimPrefix(workspaceId, "debug-")
			}
			wsInfo, err := server.GetWorkspaceInfo(workspaceId)
			if err != nil {
				return nil, err
			}
			defer func() {
				server.TrackSSHConnection(wsInfo, "auth", err)
			}()
			if wsInfo.Auth.OwnerToken != ownerToken {
				return nil, ErrAuthFailed
			}
			return &ssh.Permissions{
				Extensions: map[string]string{
					"workspaceId":    workspaceId,
					"debugWorkspace": debugWorkspace,
				},
			}, nil
		},
		PublicKeyCallback: func(conn ssh.ConnMetadata, pk ssh.PublicKey) (perm *ssh.Permissions, err error) {
			workspaceId := conn.User()
			var debugWorkspace string
			if strings.HasPrefix(workspaceId, "debug-") {
				debugWorkspace = "true"
				workspaceId = strings.TrimPrefix(workspaceId, "debug-")
			}
			wsInfo, err := server.GetWorkspaceInfo(workspaceId)
			if err != nil {
				return nil, err
			}
			defer func() {
				server.TrackSSHConnection(wsInfo, "auth", err)
			}()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			ok, _ := server.VerifyPublicKey(ctx, wsInfo, pk)
			if !ok {
				return nil, ErrAuthFailed
			}
			return &ssh.Permissions{
				Extensions: map[string]string{
					"workspaceId":    workspaceId,
					"debugWorkspace": debugWorkspace,
				},
			}, nil
		},
	}
	for _, s := range signers {
		server.sshConfig.AddHostKey(s)
	}
	return server
}

func ReportSSHAttemptMetrics(err error) {
	if err == nil {
		SSHAttemptTotal.WithLabelValues("success", "").Inc()
		return
	}
	errorType := "OTHERS"
	if serverAuthErr, ok := err.(*ssh.ServerAuthError); ok && len(serverAuthErr.Errors) > 0 {
		if authErr, ok := serverAuthErr.Errors[len(serverAuthErr.Errors)-1].(SSHError); ok {
			errorType = authErr.ShortName()
		}
	} else if authErr, ok := err.(SSHError); ok {
		errorType = authErr.ShortName()
	}
	SSHAttemptTotal.WithLabelValues("failed", errorType).Inc()
}

func (s *Server) RequestForward(reqs <-chan *ssh.Request, targetConn ssh.Conn) {
	for req := range reqs {
		result, payload, err := targetConn.SendRequest(req.Type, req.WantReply, req.Payload)
		if err != nil {
			continue
		}
		_ = req.Reply(result, payload)
	}
}

func (s *Server) HandleConn(c net.Conn) {
	clientConn, clientChans, clientReqs, err := ssh.NewServerConn(c, s.sshConfig)
	if err != nil {
		c.Close()
		ReportSSHAttemptMetrics(err)
		return
	}
	defer clientConn.Close()

	if clientConn.Permissions == nil || clientConn.Permissions.Extensions == nil || clientConn.Permissions.Extensions["workspaceId"] == "" {
		return
	}
	workspaceId := clientConn.Permissions.Extensions["workspaceId"]
	debugWorkspace := clientConn.Permissions.Extensions["debugWorkspace"] == "true"
	wsInfo := s.workspaceInfoProvider.WorkspaceInfo(workspaceId)
	if wsInfo == nil {
		ReportSSHAttemptMetrics(ErrWorkspaceNotFound)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	supervisorPort := "22999"
	if debugWorkspace {
		supervisorPort = "24999"
	}
	key, err := s.GetWorkspaceSSHKey(ctx, wsInfo.IPAddress, supervisorPort)
	if err != nil {
		cancel()
		s.TrackSSHConnection(wsInfo, "connect", ErrCreateSSHKey)
		ReportSSHAttemptMetrics(ErrCreateSSHKey)
		log.WithField("instanceId", wsInfo.InstanceID).WithError(err).Error("failed to create private pair in workspace")
		return
	}
	cancel()

	session := &Session{
		Conn:                clientConn,
		WorkspaceID:         workspaceId,
		InstanceID:          wsInfo.InstanceID,
		OwnerUserId:         wsInfo.OwnerUserId,
		WorkspacePrivateKey: key,
	}
	sshPort := "23001"
	if debugWorkspace {
		sshPort = "25001"
	}
	remoteAddr := wsInfo.IPAddress + ":" + sshPort
	conn, err := net.Dial("tcp", remoteAddr)
	if err != nil {
		s.TrackSSHConnection(wsInfo, "connect", ErrConnFailed)
		ReportSSHAttemptMetrics(ErrConnFailed)
		log.WithField("instanceId", wsInfo.InstanceID).WithField("workspaceIP", wsInfo.IPAddress).WithError(err).Error("dail failed")
		return
	}
	defer conn.Close()

	workspaceConn, workspaceChans, workspaceReqs, err := ssh.NewClientConn(conn, remoteAddr, &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            GitpodUsername,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeysCallback(func() (signers []ssh.Signer, err error) {
				return []ssh.Signer{key}, nil
			}),
		},
		Timeout: 10 * time.Second,
	})
	if err != nil {
		s.TrackSSHConnection(wsInfo, "connect", ErrConnFailed)
		ReportSSHAttemptMetrics(ErrConnFailed)
		log.WithField("instanceId", wsInfo.InstanceID).WithField("workspaceIP", wsInfo.IPAddress).WithError(err).Error("connect failed")
		return
	}
	s.Heartbeater.SendHeartbeat(wsInfo.InstanceID, false, true)
	ctx, cancel = context.WithCancel(context.Background())

	s.TrackSSHConnection(wsInfo, "connect", nil)
	SSHConnectionCount.Inc()
	ReportSSHAttemptMetrics(nil)

	forwardRequests := func(reqs <-chan *ssh.Request, targetConn ssh.Conn) {
		for req := range reqs {
			result, payload, err := targetConn.SendRequest(req.Type, req.WantReply, req.Payload)
			if err != nil {
				continue
			}
			_ = req.Reply(result, payload)
		}
	}
	// client -> workspace global request forward
	go forwardRequests(clientReqs, workspaceConn)
	// workspce -> client global request forward
	go forwardRequests(workspaceReqs, clientConn)

	go func() {
		for newChannel := range workspaceChans {
			go s.ChannelForward(ctx, session, clientConn, newChannel)
		}
	}()

	go func() {
		for newChannel := range clientChans {
			go s.ChannelForward(ctx, session, workspaceConn, newChannel)
		}
	}()

	go func() {
		clientConn.Wait()
		cancel()
	}()
	go func() {
		workspaceConn.Wait()
		cancel()
	}()
	<-ctx.Done()
	SSHConnectionCount.Dec()
	workspaceConn.Close()
	clientConn.Close()
	cancel()
}

func (s *Server) GetWorkspaceInfo(workspaceId string) (*p.WorkspaceInfo, error) {
	wsInfo := s.workspaceInfoProvider.WorkspaceInfo(workspaceId)
	if wsInfo == nil {
		if matched, _ := regexp.Match(workspaceIDRegex, []byte(workspaceId)); matched {
			return nil, ErrWorkspaceNotFound
		}
		return nil, ErrWorkspaceIDInvalid
	}
	return wsInfo, nil
}

func (s *Server) TrackSSHConnection(wsInfo *p.WorkspaceInfo, phase string, err error) {
	// if we didn't find an associated user, we don't want to track
	if wsInfo == nil {
		return
	}
	propertics := make(map[string]interface{})
	propertics["workspaceId"] = wsInfo.WorkspaceID
	propertics["instanceId"] = wsInfo.InstanceID
	propertics["state"] = "success"
	propertics["phase"] = phase

	if err != nil {
		propertics["state"] = "failed"
		propertics["cause"] = err.Error()
	}

	tracker.Track(analytics.TrackMessage{
		Identity:   analytics.Identity{UserID: wsInfo.OwnerUserId},
		Event:      "ssh_connection",
		Properties: propertics,
	})
}

func (s *Server) VerifyPublicKey(ctx context.Context, wsInfo *p.WorkspaceInfo, pk ssh.PublicKey) (bool, error) {
	for _, keyStr := range wsInfo.SSHPublicKeys {
		key, _, _, _, err := ssh.ParseAuthorizedKey([]byte(keyStr))
		if err != nil {
			continue
		}
		keyData := key.Marshal()
		pkd := pk.Marshal()
		if len(keyData) == len(pkd) && subtle.ConstantTimeCompare(keyData, pkd) == 1 {
			return true, nil
		}
	}
	return false, nil
}

func (s *Server) GetWorkspaceSSHKey(ctx context.Context, workspaceIP string, supervisorPort string) (ssh.Signer, error) {
	supervisorConn, err := grpc.Dial(workspaceIP+":"+supervisorPort, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorConn.Close()
	keyInfo, err := supervisor.NewControlServiceClient(supervisorConn).CreateSSHKeyPair(ctx, &supervisor.CreateSSHKeyPairRequest{})
	if err != nil {
		return nil, xerrors.Errorf("failed getting ssh key pair info from supervisor: %w", err)
	}
	key, err := ssh.ParsePrivateKey([]byte(keyInfo.PrivateKey))
	if err != nil {
		return nil, xerrors.Errorf("failed parse private key: %w", err)
	}
	return key, nil
}

func (s *Server) Serve(l net.Listener) error {
	for {
		conn, err := l.Accept()
		if err != nil {
			return err
		}

		go s.HandleConn(conn)
	}
}
