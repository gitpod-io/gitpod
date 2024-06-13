// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package serverapi

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	backoff "github.com/cenkalti/backoff/v4"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type APIInterface interface {
	GetToken(ctx context.Context, query *gitpod.GetTokenSearchOptions) (res *gitpod.Token, err error)
	OpenPort(ctx context.Context, port *gitpod.WorkspaceInstancePort) (res *gitpod.WorkspaceInstancePort, err error)
	UpdateGitStatus(ctx context.Context, status *gitpod.WorkspaceInstanceRepoStatus) (err error)
	WorkspaceUpdates(ctx context.Context) (<-chan *gitpod.WorkspaceInstance, error)

	// Metrics
	RegisterMetrics(registry *prometheus.Registry) error
}

const (
	// KindGitpod marks tokens that provide access to the Gitpod server API.
	KindGitpod = "gitpod"
)

var errNotConnected = errors.New("not connected to server/public api")

type ServiceConfig struct {
	Host              string
	Endpoint          string
	InstanceID        string
	WorkspaceID       string
	OwnerID           string
	SupervisorVersion string
	ConfigcatEnabled  bool
}

type Service struct {
	cfg   *ServiceConfig
	token string

	// publicAPIConn public API publicAPIConn
	publicAPIConn *grpc.ClientConn

	// subs is the subscribers of workspaceUpdates
	subs     map[chan *gitpod.WorkspaceInstance]struct{}
	subMutex sync.Mutex

	apiMetrics *ClientMetrics
}

var _ APIInterface = (*Service)(nil)

func NewServerApiService(ctx context.Context, cfg *ServiceConfig, tknsrv api.TokenServiceServer) *Service {
	tknres, err := tknsrv.GetToken(context.Background(), &api.GetTokenRequest{
		Kind: KindGitpod,
		Host: cfg.Host,
		Scope: []string{
			"function:getToken",
			"function:openPort",
			"function:trackEvent",
			"function:getWorkspace",
		},
	})
	if err != nil {
		log.WithError(err).Error("cannot get token for Gitpod API")
		return nil
	}

	service := &Service{
		token:      tknres.Token,
		cfg:        cfg,
		apiMetrics: NewClientMetrics(),
		subs:       make(map[chan *gitpod.WorkspaceInstance]struct{}),
	}

	// public api
	service.tryConnToPublicAPI(ctx)

	// start to listen on real instance updates
	go service.onWorkspaceUpdates(ctx)

	return service
}

func (s *Service) tryConnToPublicAPI(ctx context.Context) {
	endpoint := fmt.Sprintf("api.%s:443", s.cfg.Host)
	log.WithField("endpoint", endpoint).Info("connecting to PublicAPI...")
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS12})),
		grpc.WithStreamInterceptor(grpc_middleware.ChainStreamClient([]grpc.StreamClientInterceptor{
			func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
				withAuth := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+s.token)
				return streamer(withAuth, desc, cc, method, opts...)
			},
		}...)),
		grpc.WithUnaryInterceptor(grpc_middleware.ChainUnaryClient([]grpc.UnaryClientInterceptor{
			func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
				withAuth := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+s.token)
				return invoker(withAuth, method, req, reply, cc, opts...)
			},
		}...)),
	}
	if conn, err := grpc.Dial(endpoint, opts...); err != nil {
		log.WithError(err).Errorf("failed to dial public api %s", endpoint)
	} else {
		s.publicAPIConn = conn
		go func() {
			<-ctx.Done()
			s.publicAPIConn.Close()
		}()
	}
}

func (s *Service) GetToken(ctx context.Context, query *gitpod.GetTokenSearchOptions) (res *gitpod.Token, err error) {
	if s == nil {
		return nil, errNotConnected
	}
	startTime := time.Now()
	defer func() {
		s.apiMetrics.ProcessMetrics("GetToken", err, startTime)
	}()

	service := v1.NewUserServiceClient(s.publicAPIConn)
	resp, err := service.GetGitToken(ctx, &v1.GetGitTokenRequest{
		Host: query.Host,
	})
	if err != nil {
		log.WithField("method", "GetGitToken").WithError(err).Error("failed to call PublicAPI")
		return nil, err
	}
	return &gitpod.Token{
		ExpiryDate:   resp.Token.ExpiryDate,
		IDToken:      resp.Token.IdToken,
		RefreshToken: resp.Token.RefreshToken,
		Scopes:       resp.Token.Scopes,
		UpdateDate:   resp.Token.UpdateDate,
		Username:     resp.Token.Username,
		Value:        resp.Token.Value,
	}, nil
}

func (s *Service) UpdateGitStatus(ctx context.Context, status *gitpod.WorkspaceInstanceRepoStatus) (err error) {
	if s == nil {
		return errNotConnected
	}
	startTime := time.Now()
	defer func() {
		s.apiMetrics.ProcessMetrics("UpdateGitStatus", err, startTime)
	}()
	workspaceID := s.cfg.WorkspaceID
	service := v1.NewIDEClientServiceClient(s.publicAPIConn)
	payload := &v1.UpdateGitStatusRequest{
		WorkspaceId: workspaceID,
	}
	if status != nil {
		payload.Status = capGitStatusLength(&v1.GitStatus{
			Branch:               status.Branch,
			LatestCommit:         status.LatestCommit,
			TotalUncommitedFiles: int32(status.TotalUncommitedFiles),
			TotalUnpushedCommits: int32(status.TotalUnpushedCommits),
			TotalUntrackedFiles:  int32(status.TotalUntrackedFiles),
			UncommitedFiles:      status.UncommitedFiles,
			UnpushedCommits:      status.UnpushedCommits,
			UntrackedFiles:       status.UntrackedFiles,
		})
	}
	_, err = service.UpdateGitStatus(ctx, payload)
	return
}

func (s *Service) OpenPort(ctx context.Context, port *gitpod.WorkspaceInstancePort) (res *gitpod.WorkspaceInstancePort, err error) {
	if s == nil {
		return nil, errNotConnected
	}
	startTime := time.Now()
	defer func() {
		s.apiMetrics.ProcessMetrics("OpenPort", err, startTime)
	}()
	workspaceID := s.cfg.WorkspaceID
	service := v1.NewWorkspacesServiceClient(s.publicAPIConn)

	payload := &v1.UpdatePortRequest{
		WorkspaceId: workspaceID,
		Port: &v1.PortSpec{
			Port: uint64(port.Port),
		},
	}
	if port.Visibility == gitpod.PortVisibilityPublic {
		payload.Port.Policy = v1.PortPolicy_PORT_POLICY_PUBLIC
	} else {
		payload.Port.Policy = v1.PortPolicy_PORT_POLICY_PRIVATE
	}
	if port.Protocol == gitpod.PortProtocolHTTPS {
		payload.Port.Protocol = v1.PortProtocol_PORT_PROTOCOL_HTTPS
	} else {
		payload.Port.Protocol = v1.PortProtocol_PORT_PROTOCOL_HTTP
	}
	_, err = service.UpdatePort(ctx, payload)
	if err != nil {
		log.WithField("method", "UpdatePort").WithError(err).Error("failed to call PublicAPI")
		return nil, err
	}
	// server don't respond anything
	// see https://github.com/gitpod-io/gitpod/blob/2967579c330de67090d975661a6e3e1cd970ab68/components/server/src/workspace/gitpod-server-impl.ts#L1521
	return port, nil
}

// onWorkspaceUpdates listen to server and public API workspaceUpdates and publish to subscribers once Service created.
func (s *Service) onWorkspaceUpdates(ctx context.Context) {
	errChan := make(chan error)
	processUpdate := func() context.CancelFunc {
		childCtx, cancel := context.WithCancel(ctx)
		go s.publicAPIWorkspaceUpdate(childCtx, errChan)
		return cancel
	}
	go func() {
		cancel := processUpdate()
		defer func() {
			cancel()
		}()
		// force reconnect after 7m to avoid unexpected 10m reconnection (internal error)
		ticker := time.NewTicker(7 * time.Minute)
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				cancel()
				cancel = processUpdate()
			case err := <-errChan:
				if errors.Is(err, context.Canceled) || errors.Is(err, io.EOF) {
					continue
				}
				code := status.Code(err)
				if code == codes.PermissionDenied {
					log.WithError(err).Fatalf("failed to on instance update: have no permission")
				}
				log.WithField("method", "WorkspaceUpdates").WithError(err).Error("failed to listen")
				cancel()
				time.Sleep(time.Second * 2)
				cancel = processUpdate()
			}
		}
	}()
}

func (s *Service) WorkspaceUpdates(ctx context.Context) (<-chan *gitpod.WorkspaceInstance, error) {
	if s == nil {
		return nil, errNotConnected
	}
	ch := make(chan *gitpod.WorkspaceInstance)
	s.subMutex.Lock()
	s.subs[ch] = struct{}{}
	s.subMutex.Unlock()

	go func() {
		defer func() {
			close(ch)
		}()
		<-ctx.Done()
		s.subMutex.Lock()
		delete(s.subs, ch)
		s.subMutex.Unlock()
	}()
	return ch, nil
}

func (s *Service) publicAPIWorkspaceUpdate(ctx context.Context, errChan chan error) {
	workspaceID := s.cfg.WorkspaceID
	resp, err := backoff.RetryWithData(func() (v1.WorkspacesService_StreamWorkspaceStatusClient, error) {
		startTime := time.Now()
		var err error
		defer func() {
			if err != nil {
				s.apiMetrics.ProcessMetrics("WorkspaceUpdates", err, startTime)
			}
		}()
		service := v1.NewWorkspacesServiceClient(s.publicAPIConn)
		resp, err := service.StreamWorkspaceStatus(ctx, &v1.StreamWorkspaceStatusRequest{
			WorkspaceId: workspaceID,
		})
		if err != nil {
			log.WithError(err).Info("backoff failed to get workspace service client of PublicAPI, try again")
		}
		return resp, err
	}, backoff.WithContext(ConnBackoff, ctx))
	if err != nil {
		// we don't care about ctx canceled
		if ctx.Err() != nil {
			return
		}
		log.WithField("method", "StreamWorkspaceStatus").WithError(err).Error("failed to call PublicAPI")
		errChan <- err
		return
	}
	startTime := time.Now()
	defer func() {
		s.apiMetrics.ProcessMetrics("WorkspaceUpdates", err, startTime)
	}()
	var data *v1.StreamWorkspaceStatusResponse
	for {
		data, err = resp.Recv()
		if err != nil {
			code := status.Code(err)
			if err != io.EOF && ctx.Err() == nil && code != codes.Canceled {
				log.WithField("method", "StreamWorkspaceStatus").WithError(err).Error("failed to receive status update")
			}
			if ctx.Err() != nil || code == codes.Canceled {
				return
			}
			errChan <- err
			return
		}
		s.subMutex.Lock()
		for sub := range s.subs {
			sub <- workspaceStatusToWorkspaceInstance(data.Result)
		}
		s.subMutex.Unlock()
	}
}

var ConnBackoff = &backoff.ExponentialBackOff{
	InitialInterval:     2 * time.Second,
	RandomizationFactor: 0.5,
	Multiplier:          1.5,
	MaxInterval:         30 * time.Second,
	MaxElapsedTime:      0,
	Stop:                backoff.Stop,
	Clock:               backoff.SystemClock,
}

func (s *Service) RegisterMetrics(registry *prometheus.Registry) error {
	if s == nil {
		return errNotConnected
	}
	return registry.Register(s.apiMetrics)
}

func workspaceStatusToWorkspaceInstance(status *v1.WorkspaceStatus) *gitpod.WorkspaceInstance {
	instance := &gitpod.WorkspaceInstance{
		CreationTime: status.Instance.CreatedAt.String(),
		ID:           status.Instance.InstanceId,
		Status: &gitpod.WorkspaceInstanceStatus{
			ExposedPorts: []*gitpod.WorkspaceInstancePort{},
			Message:      status.Instance.Status.Message,
			// OwnerToken:   "", not used so ignore
			Phase:   status.Instance.Status.Phase.String(),
			Timeout: status.Instance.Status.Conditions.Timeout,
			Version: int(status.Instance.Status.StatusVersion),
		},
		WorkspaceID: status.Instance.WorkspaceId,
	}
	for _, port := range status.Instance.Status.Ports {
		info := &gitpod.WorkspaceInstancePort{
			Port: float64(port.Port),
			URL:  port.Url,
		}
		if port.Policy == v1.PortPolicy_PORT_POLICY_PUBLIC {
			info.Visibility = gitpod.PortVisibilityPublic
		} else {
			info.Visibility = gitpod.PortVisibilityPrivate
		}
		if port.Protocol == v1.PortProtocol_PORT_PROTOCOL_HTTPS {
			info.Protocol = gitpod.PortProtocolHTTPS
		} else {
			info.Protocol = gitpod.PortProtocolHTTP
		}
		instance.Status.ExposedPorts = append(instance.Status.ExposedPorts, info)
	}
	return instance
}

const GIT_STATUS_API_LIMIT_BYTES = 4096

func capGitStatusLength(s *v1.GitStatus) *v1.GitStatus {
	const MARGIN = 200                                     // bytes (we account for differences in JSON formatting, as well JSON escape characters in the static part of the status)
	const API_BUDGET = GIT_STATUS_API_LIMIT_BYTES - MARGIN // bytes

	// calculate JSON length in bytes
	bytes, err := json.Marshal(s)
	if err != nil {
		log.WithError(err).Warn("cannot marshal GitStatus to calculate byte length")
		s.UncommitedFiles = nil
		s.UnpushedCommits = nil
		s.UntrackedFiles = nil
		return s
	}
	if len(bytes) < API_BUDGET {
		return s
	}

	// roughly estimate how many bytes we have left for the path arrays (containing long strings)
	budget := API_BUDGET - len(s.Branch) - len(s.LatestCommit)
	bytesUsed := 0
	const PLACEHOLDER = "..."
	capArrayAtByteLimit := func(arr []string) []string {
		result := make([]string, 0, len(arr))
		for _, s := range arr {
			bytesRequired := len(s) + 4 // 4 bytes for the JSON encoding
			if bytesUsed+bytesRequired+len(PLACEHOLDER) > budget {
				result = append(result, PLACEHOLDER)
				bytesUsed += len(PLACEHOLDER) + 4
				break
			}
			result = append(result, s)
			bytesUsed += bytesRequired
		}
		return result
	}
	s.UncommitedFiles = capArrayAtByteLimit(s.UncommitedFiles)
	s.UnpushedCommits = capArrayAtByteLimit(s.UnpushedCommits)
	s.UntrackedFiles = capArrayAtByteLimit(s.UntrackedFiles)

	return s
}
