// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package serverapi

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"time"

	backoff "github.com/cenkalti/backoff/v4"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
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
	InstanceUpdates(ctx context.Context) (<-chan *gitpod.WorkspaceInstance, error)

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
}

type Service struct {
	cfg         *ServiceConfig
	experiments experiments.Client

	token string

	// gitpodService server API
	gitpodService gitpod.APIInterface
	// publicAPIConn public API publicAPIConn
	publicAPIConn    *grpc.ClientConn
	publicApiMetrics *grpc_prometheus.ClientMetrics

	// usingPublicAPI is using atomic type to avoid reconnect when configcat value change
	usingPublicAPI atomic.Bool
	// onUsingPublicAPI which will only used in instanceUpdate config change notify
	onUsingPublicAPI chan struct{}

	// subs is the subscribers of instanceUpdates
	subs     map[chan *gitpod.WorkspaceInstance]struct{}
	subMutex sync.Mutex
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
	// server api
	gitpodService, err := gitpod.ConnectToServer(cfg.Endpoint, gitpod.ConnectToServerOpts{
		Token: tknres.Token,
		Log:   log.Log,
		ExtraHeaders: map[string]string{
			"User-Agent":              "gitpod/supervisor",
			"X-Workspace-Instance-Id": cfg.InstanceID,
			"X-Client-Version":        cfg.SupervisorVersion,
		},
	})
	if err != nil {
		log.WithError(err).Error("cannot connect to Gitpod API")
		return nil
	}

	service := &Service{
		token:            tknres.Token,
		gitpodService:    gitpodService,
		cfg:              cfg,
		experiments:      experiments.NewClient(),
		publicApiMetrics: grpc_prometheus.NewClientMetrics(),
		onUsingPublicAPI: make(chan struct{}),
		subs:             make(map[chan *gitpod.WorkspaceInstance]struct{}),
	}

	service.publicApiMetrics.EnableClientHandlingTimeHistogram(
		// it should be aligned with https://github.com/gitpod-io/gitpod/blob/84ed1a0672d91446ba33cb7b504cfada769271a8/install/installer/pkg/components/ide-metrics/configmap.go#L315
		grpc_prometheus.WithHistogramBuckets([]float64{0.1, 0.2, 0.5, 1, 2, 5, 10}),
	)

	// public api
	service.tryConnToPublicAPI()

	service.usingPublicAPI.Store(experiments.SupervisorUsePublicAPI(ctx, service.experiments, experiments.Attributes{
		UserID: cfg.OwnerID,
	}))
	// start to listen on real instance updates
	go service.onInstanceUpdates(ctx)
	go service.observeConfigcatValue(ctx)

	return service
}

func (s *Service) tryConnToPublicAPI() {
	endpoint := fmt.Sprintf("api.%s:443", s.cfg.Host)
	log.WithField("endpoint", endpoint).Info("connecting to PublicAPI...")
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS13})),
		grpc.WithStreamInterceptor(grpc_middleware.ChainStreamClient([]grpc.StreamClientInterceptor{
			func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
				withAuth := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+s.token)
				return streamer(withAuth, desc, cc, method, opts...)
			},
		}...)),
		grpc.WithUnaryInterceptor(grpc_middleware.ChainUnaryClient([]grpc.UnaryClientInterceptor{
			s.publicApiMetrics.UnaryClientInterceptor(),
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
	}
}

func (s *Service) observeConfigcatValue(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 10)
	for {
		select {
		case <-ctx.Done():
			ticker.Stop()
			return
		case <-ticker.C:
			usePublicAPI := experiments.SupervisorUsePublicAPI(ctx, s.experiments, experiments.Attributes{
				UserID: s.cfg.OwnerID,
			})
			if prev := s.usingPublicAPI.Swap(usePublicAPI); prev != usePublicAPI {
				if usePublicAPI {
					log.Info("switch to use PublicAPI")
				} else {
					log.Info("switch to use ServerAPI")
				}
				select {
				case s.onUsingPublicAPI <- struct{}{}:
				default:
				}
			}
		}
	}
}

func (s *Service) usePublicAPI(ctx context.Context) bool {
	if s.publicAPIConn == nil {
		return false
	}
	return s.usingPublicAPI.Load()
}

func (s *Service) GetToken(ctx context.Context, query *gitpod.GetTokenSearchOptions) (res *gitpod.Token, err error) {
	if s == nil {
		return nil, errNotConnected
	}
	if !s.usePublicAPI(ctx) {
		return s.gitpodService.GetToken(ctx, query)
	}

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

func (s *Service) OpenPort(ctx context.Context, port *gitpod.WorkspaceInstancePort) (res *gitpod.WorkspaceInstancePort, err error) {
	if s == nil {
		return nil, errNotConnected
	}
	workspaceID := s.cfg.WorkspaceID
	if !s.usePublicAPI(ctx) {
		return s.gitpodService.OpenPort(ctx, workspaceID, port)
	}
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
	_, err = service.UpdatePort(ctx, payload)
	if err != nil {
		log.WithField("method", "UpdatePort").WithError(err).Error("failed to call PublicAPI")
		return nil, err
	}
	// server don't respond anything
	// see https://github.com/gitpod-io/gitpod/blob/2967579c330de67090d975661a6e3e1cd970ab68/components/server/src/workspace/gitpod-server-impl.ts#L1521
	return port, nil
}

// onInstanceUpdates listen to server and public API instanceUpdates and publish to subscribers once Service created.
func (s *Service) onInstanceUpdates(ctx context.Context) {
	errChan := make(chan error)
	processUpdate := func(usePublicAPI bool) context.CancelFunc {
		childCtx, cancel := context.WithCancel(ctx)
		if usePublicAPI {
			go s.publicAPIInstanceUpdate(childCtx, errChan)
		} else {
			go s.serverInstanceUpdate(childCtx, errChan)
		}
		return cancel
	}
	go func() {
		cancel := processUpdate(s.usePublicAPI(ctx))
		defer func() {
			cancel()
		}()
		for {
			select {
			case <-ctx.Done():
				return
			case <-s.onUsingPublicAPI:
				cancel()
				cancel = processUpdate(s.usePublicAPI(ctx))
			case err := <-errChan:
				if errors.Is(err, context.Canceled) || errors.Is(err, io.EOF) {
					continue
				}
				if status.Code(err) != codes.Unavailable {
					log.WithField("method", "InstanceUpdates").WithError(err).Error("failed to listen")
				}
				cancel()
				time.Sleep(time.Second * 2)
				cancel = processUpdate(s.usePublicAPI(ctx))
			}
		}
	}()
}

func (s *Service) InstanceUpdates(ctx context.Context) (<-chan *gitpod.WorkspaceInstance, error) {
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

func (s *Service) publicAPIInstanceUpdate(ctx context.Context, errChan chan error) {
	workspaceID := s.cfg.WorkspaceID
	resp, err := backoff.RetryWithData(func() (v1.WorkspacesService_StreamWorkspaceStatusClient, error) {
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
	log.WithField("method", "StreamWorkspaceStatus").Info("start to listen on publicAPI instanceUpdates")
	for {
		resp, err := resp.Recv()
		if err != nil {
			code := status.Code(err)
			if err != io.EOF && ctx.Err() == nil && code != codes.Unavailable && code != codes.Canceled {
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
			sub <- workspaceStatusToWorkspaceInstance(resp.Result)
		}
		s.subMutex.Unlock()
	}
}

func (s *Service) serverInstanceUpdate(ctx context.Context, errChan chan error) {
	instanceID := s.cfg.InstanceID
	ch, err := backoff.RetryWithData(func() (<-chan *gitpod.WorkspaceInstance, error) {
		ch, err := s.gitpodService.InstanceUpdates(ctx, instanceID)
		if err != nil {
			log.WithError(err).Info("backoff failed to listen to serverAPI instanceUpdates, try again")
		}
		return ch, err
	}, backoff.WithContext(ConnBackoff, ctx))
	if err != nil {
		// we don't care about ctx canceled
		if ctx.Err() != nil {
			return
		}
		log.WithField("method", "InstanceUpdates").WithError(err).Error("failed to call serverAPI")
		errChan <- err
		return
	}
	log.WithField("method", "InstanceUpdates").WithField("instanceID", instanceID).Info("start to listen on serverAPI instanceUpdates")
	for update := range ch {
		s.subMutex.Lock()
		for sub := range s.subs {
			sub <- update
		}
		s.subMutex.Unlock()
	}
	if ctx.Err() != nil {
		return
	}
	errChan <- io.EOF
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
	return registry.Register(s.publicApiMetrics)
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
		instance.Status.ExposedPorts = append(instance.Status.ExposedPorts, info)
	}
	return instance
}
