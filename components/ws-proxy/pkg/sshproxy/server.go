// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package sshproxy

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	tracker "github.com/gitpod-io/gitpod/ws-proxy/pkg/analytics"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/common"
	"github.com/gitpod-io/golang-crypto/ssh"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"sigs.k8s.io/controller-runtime/pkg/metrics"
)

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

	SSHTunnelOpenedTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "gitpod_ws_proxy_ssh_tunnel_opened_total",
		Help: "Total number of SSH tunnels opened by the ws-proxy",
	}, []string{})

	SSHTunnelClosedTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "gitpod_ws_proxy_ssh_tunnel_closed_total",
		Help: "Total number of SSH tunnels closed by the ws-proxy",
	}, []string{"code"})
)

var (
	ErrWorkspaceNotFound   = NewSSHErrorWithReject("WS_NOTFOUND", "not found workspace")
	ErrWorkspaceNotRunning = NewSSHErrorWithReject("WS_NOT_RUNNING", "workspace not running")
	ErrWorkspaceIDInvalid  = NewSSHErrorWithReject("WS_ID_INVALID", "workspace id invalid")
	ErrUsernameFormat      = NewSSHErrorWithReject("USER_FORMAT", "username format is not correct")
	ErrMissPrivateKey      = NewSSHErrorWithReject("MISS_KEY", "missing privateKey")
	ErrConnFailed          = NewSSHError("CONN_FAILED", "cannot to connect with workspace")
	ErrCreateSSHKey        = NewSSHError("CREATE_KEY_FAILED", "cannot create private pair in workspace")

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

	HostKeys              []ssh.Signer
	sshConfig             *ssh.ServerConfig
	workspaceInfoProvider common.WorkspaceInfoProvider
	caKey                 ssh.Signer
}

func init() {
	metrics.Registry.MustRegister(
		SSHConnectionCount,
		SSHAttemptTotal,
		SSHTunnelClosedTotal,
		SSHTunnelOpenedTotal,
	)
}

// New creates a new SSH proxy server

func New(signers []ssh.Signer, workspaceInfoProvider common.WorkspaceInfoProvider, heartbeat Heartbeat, caKey ssh.Signer) *Server {
	server := &Server{
		workspaceInfoProvider: workspaceInfoProvider,
		Heartbeater:           &noHeartbeat{},
		HostKeys:              signers,
		caKey:                 caKey,
	}
	if heartbeat != nil {
		server.Heartbeater = heartbeat
	}

	authWithWebsocketTunnel := func(conn ssh.ConnMetadata) (*ssh.Permissions, error) {
		wsConn, ok := conn.RawConn().(*gitpod.WebsocketConnection)
		if !ok {
			return nil, ErrAuthFailed
		}
		info, ok := wsConn.Ctx.Value(common.WorkspaceInfoIdentifier).(map[string]string)
		if !ok || info == nil {
			return nil, ErrAuthFailed
		}
		workspaceId := info[common.WorkspaceIDIdentifier]
		_, err := server.GetWorkspaceInfo(workspaceId)
		if err != nil {
			return nil, err
		}
		log.WithField(common.WorkspaceIDIdentifier, workspaceId).Info("success auth via websocket")
		return &ssh.Permissions{
			Extensions: map[string]string{
				"workspaceId":    workspaceId,
				"debugWorkspace": info[common.DebugWorkspaceIdentifier],
			},
		}, nil
	}

	server.sshConfig = &ssh.ServerConfig{
		ServerVersion: "SSH-2.0-GITPOD-GATEWAY",
		NoClientAuth:  true,
		NoClientAuthCallback: func(conn ssh.ConnMetadata) (*ssh.Permissions, error) {
			if perm, err := authWithWebsocketTunnel(conn); err == nil {
				return perm, nil
			}
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
			if perm, err := authWithWebsocketTunnel(conn); err == nil {
				return perm, nil
			}
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
		if errors.Is(err, io.EOF) {
			return
		}
		ReportSSHAttemptMetrics(err)
		log.WithError(err).Error("failed to create new server connection")
		return
	}
	defer clientConn.Close()

	if clientConn.Permissions == nil || clientConn.Permissions.Extensions == nil || clientConn.Permissions.Extensions["workspaceId"] == "" {
		return
	}
	workspaceId := clientConn.Permissions.Extensions["workspaceId"]
	debugWorkspace := clientConn.Permissions.Extensions["debugWorkspace"] == "true"
	wsInfo, err := s.GetWorkspaceInfo(workspaceId)
	if err != nil {
		ReportSSHAttemptMetrics(err)
		log.WithField("workspaceId", workspaceId).WithError(err).Error("failed to get workspace info")
		return
	}
	log := log.WithField("instanceId", wsInfo.InstanceID).WithField("isMk2", wsInfo.IsManagedByMk2)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	supervisorPort := "22999"
	if debugWorkspace {
		supervisorPort = "24999"
	}

	var key ssh.Signer
	//nolint:ineffassign
	userName := "gitpod"

	session := &Session{
		Conn:        clientConn,
		WorkspaceID: workspaceId,
		InstanceID:  wsInfo.InstanceID,
		OwnerUserId: wsInfo.OwnerUserId,
	}

	if !wsInfo.IsManagedByMk2 {
		if s.caKey == nil || !wsInfo.IsEnabledSSHCA {
			err = xerrors.Errorf("workspace not managed by mk2, but didn't have SSH CA enabled")
			s.TrackSSHConnection(wsInfo, "connect", ErrCreateSSHKey)
			ReportSSHAttemptMetrics(ErrCreateSSHKey)
			log.WithError(err).Error("failed to generate ssh cert")
			cancel()
			return
		}
		// obtain the SSH username from workspacekit.
		workspacekitPort := "22998"
		userName, err = workspaceSSHUsername(ctx, wsInfo.IPAddress, workspacekitPort)
		if err != nil {
			userName = "root"
			log.WithError(err).Warn("failed to retrieve the SSH username. Using root.")
		}
	}

	if s.caKey != nil && wsInfo.IsEnabledSSHCA {
		key, err = s.GenerateSSHCert(ctx, userName)
		if err != nil {
			s.TrackSSHConnection(wsInfo, "connect", ErrCreateSSHKey)
			ReportSSHAttemptMetrics(ErrCreateSSHKey)
			log.WithError(err).Error("failed to generate ssh cert")
			cancel()
			return
		}
		session.WorkspacePrivateKey = key
	} else {
		key, userName, err = s.GetWorkspaceSSHKey(ctx, wsInfo.IPAddress, supervisorPort)
		if err != nil {
			cancel()
			s.TrackSSHConnection(wsInfo, "connect", ErrCreateSSHKey)
			ReportSSHAttemptMetrics(ErrCreateSSHKey)
			log.WithError(err).Error("failed to create private pair in workspace")
			return
		}

		session.WorkspacePrivateKey = key
	}

	cancel()

	sshPort := "23001"
	if debugWorkspace {
		sshPort = "25001"
	}
	remoteAddr := wsInfo.IPAddress + ":" + sshPort
	conn, err := net.Dial("tcp", remoteAddr)
	if err != nil {
		s.TrackSSHConnection(wsInfo, "connect", ErrConnFailed)
		ReportSSHAttemptMetrics(ErrConnFailed)
		log.WithField("workspaceIP", wsInfo.IPAddress).WithError(err).Error("dial failed")
		return
	}
	defer conn.Close()

	workspaceConn, workspaceChans, workspaceReqs, err := ssh.NewClientConn(conn, remoteAddr, &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            userName,
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
		log.WithField("workspaceIP", wsInfo.IPAddress).WithError(err).Error("connect failed")
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

func (s *Server) GetWorkspaceInfo(workspaceId string) (*common.WorkspaceInfo, error) {
	wsInfo := s.workspaceInfoProvider.WorkspaceInfo(workspaceId)
	if wsInfo == nil {
		if matched, _ := regexp.Match(workspaceIDRegex, []byte(workspaceId)); matched {
			return nil, ErrWorkspaceNotFound
		}
		return nil, ErrWorkspaceIDInvalid
	}
	if !wsInfo.IsRunning {
		return nil, ErrWorkspaceNotRunning
	}
	return wsInfo, nil
}

func (s *Server) TrackSSHConnection(wsInfo *common.WorkspaceInfo, phase string, err error) {
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

func (s *Server) VerifyPublicKey(ctx context.Context, wsInfo *common.WorkspaceInfo, pk ssh.PublicKey) (bool, error) {
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

func (s *Server) GetWorkspaceSSHKey(ctx context.Context, workspaceIP string, supervisorPort string) (ssh.Signer, string, error) {
	supervisorConn, err := grpc.Dial(workspaceIP+":"+supervisorPort, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, "", xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorConn.Close()
	keyInfo, err := supervisor.NewControlServiceClient(supervisorConn).CreateSSHKeyPair(ctx, &supervisor.CreateSSHKeyPairRequest{})
	if err != nil {
		return nil, "", xerrors.Errorf("failed getting ssh key pair info from supervisor: %w", err)
	}
	key, err := ssh.ParsePrivateKey([]byte(keyInfo.PrivateKey))
	if err != nil {
		return nil, "", xerrors.Errorf("failed parse private key: %w", err)
	}
	userName := keyInfo.UserName
	if userName == "" {
		userName = "gitpod"
	}
	return key, userName, nil
}

func (s *Server) GenerateSSHCert(ctx context.Context, userName string) (ssh.Signer, error) {
	// prepare certificate for signing
	nonce := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, xerrors.Errorf("failed to generate signed SSH key: error generating random nonce: %w", err)
	}

	pk, pv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	b, err := ssh.NewPublicKey(pk)
	if err != nil {
		return nil, err
	}

	priv, err := ssh.NewSignerFromSigner(pv)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	certificate := &ssh.Certificate{
		Serial:          0,
		Key:             b,
		KeyId:           "ws-proxy",
		ValidPrincipals: []string{userName},
		ValidAfter:      uint64(now.Add(-10 * time.Minute).In(time.UTC).Unix()),
		ValidBefore:     uint64(now.Add(10 * time.Minute).In(time.UTC).Unix()),
		CertType:        ssh.UserCert,
		Permissions: ssh.Permissions{
			Extensions: map[string]string{
				"permit-pty":              "",
				"permit-user-rc":          "",
				"permit-X11-forwarding":   "",
				"permit-port-forwarding":  "",
				"permit-agent-forwarding": "",
			},
		},
		Nonce:        nonce,
		SignatureKey: s.caKey.PublicKey(),
	}
	err = certificate.SignCert(rand.Reader, s.caKey)
	if err != nil {
		return nil, err
	}
	certSigner, err := ssh.NewCertSigner(certificate, priv)
	if err != nil {
		return nil, err
	}
	return certSigner, nil
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

func workspaceSSHUsername(ctx context.Context, workspaceIP string, workspacekitPort string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("http://%v:%v/ssh/username", workspaceIP, workspacekitPort), nil)
	if err != nil {
		return "", err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	result, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf(fmt.Sprintf("unexpected status: %v (%v)", string(result), resp.StatusCode))
	}

	return string(result), nil
}
