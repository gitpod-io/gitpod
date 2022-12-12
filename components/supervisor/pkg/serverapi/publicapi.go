// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package serverapi

import (
	"context"
	"crypto/tls"
	"fmt"
	"reflect"
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
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
)

type APIInterface interface {
	GetOwnerID(ctx context.Context, workspaceID string) (ownerID string, err error)
	GetToken(ctx context.Context, query *gitpod.GetTokenSearchOptions) (res *gitpod.Token, err error)
	OpenPort(ctx context.Context, workspaceID string, port *gitpod.WorkspaceInstancePort) (res *gitpod.WorkspaceInstancePort, err error)
	InstanceUpdates(ctx context.Context, instanceID string, workspaceID string) (<-chan *gitpod.WorkspaceInstance, error)

	// Remove this and use segment client directly
	TrackEvent(ctx context.Context, event *gitpod.RemoteTrackMessage) (err error)

	// Metrics
	RegisterMetrics(registry *prometheus.Registry) error
}

const (
	// KindGitpod marks tokens that provide access to the Gitpod server API.
	KindGitpod = "gitpod"
)

type ServiceConfig struct {
	Host              string
	Endpoint          string
	InstanceID        string
	WorkspaceID       string
	SupervisorVersion string
}

type Service struct {
	cfg         *ServiceConfig
	experiments experiments.Client

	token   string
	ownerID string

	lastServerInstance *gitpod.WorkspaceInstance

	// gitpodService server API
	gitpodService gitpod.APIInterface
	// publicAPIConn public API publicAPIConn
	publicAPIConn    *grpc.ClientConn
	publicApiMetrics *grpc_prometheus.ClientMetrics

	previousUsingPublicAPI bool
}

var _ APIInterface = (*Service)(nil)

func NewServerApiService(ctx context.Context, cfg *ServiceConfig, tknsrv api.TokenServiceServer) APIInterface {
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
	}

	service.publicApiMetrics.EnableClientHandlingTimeHistogram(
		// it should be aligned with https://github.com/gitpod-io/gitpod/blob/84ed1a0672d91446ba33cb7b504cfada769271a8/install/installer/pkg/components/ide-metrics/configmap.go#L315
		grpc_prometheus.WithHistogramBuckets([]float64{0.1, 0.2, 0.5, 1, 2, 5, 10}),
	)

	// public api
	service.tryConnToPublicAPI()
	// listen to server instance update
	go service.listenInstanceUpdate(ctx, cfg.InstanceID)

	if wsInfo, err := gitpodService.GetWorkspace(ctx, cfg.WorkspaceID); err != nil {
		log.WithError(err).Error("cannot get workspace info")
	} else {
		service.ownerID = wsInfo.Workspace.OwnerID
	}
	return service
}

func (s *Service) tryConnToPublicAPI() {
	endpoint := fmt.Sprintf("api.%s:443", s.cfg.Host)
	log.WithField("endpoint", endpoint).Info("connecting to PublicAPI...")
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})),
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

func (s *Service) persistServerAPIChannelWhenStart(ctx context.Context) bool {
	if s.publicAPIConn == nil || s.ownerID == "" {
		return true
	}
	return experiments.SupervisorPersistServerAPIChannelWhenStart(ctx, s.experiments, experiments.Attributes{
		UserID: s.ownerID,
	})
}

func (s *Service) usePublicAPI(ctx context.Context) bool {
	if s.publicAPIConn == nil || s.ownerID == "" {
		return false
	}
	usePublicAPI := experiments.SupervisorUsePublicAPI(ctx, s.experiments, experiments.Attributes{
		UserID: s.ownerID,
	})
	if usePublicAPI != s.previousUsingPublicAPI {
		if usePublicAPI {
			log.Info("switch to use PublicAPI")
		} else {
			log.Info("switch to use ServerAPI")
		}
		s.previousUsingPublicAPI = usePublicAPI
	}
	return usePublicAPI
}

// GetToken implements protocol.APIInterface
func (s *Service) GetToken(ctx context.Context, query *gitpod.GetTokenSearchOptions) (res *gitpod.Token, err error) {
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

// OpenPort implements protocol.APIInterface
func (s *Service) OpenPort(ctx context.Context, workspaceID string, port *gitpod.WorkspaceInstancePort) (res *gitpod.WorkspaceInstancePort, err error) {
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

func (s *Service) listenInstanceUpdate(ctx context.Context, instanceID string) {
	for {
		uptChan, err := backoff.RetryWithData(
			func() (<-chan *gitpod.WorkspaceInstance, error) {
				return s.gitpodService.InstanceUpdates(ctx, instanceID)
			},
			backoff.NewExponentialBackOff(),
		)
		if err != nil {
			log.WithError(err).Error("failed to get workspace instance chan several retries")
			continue
		}
		for {
			select {
			case <-ctx.Done():
				return
			case instance := <-uptChan:
				s.lastServerInstance = instance
			}
		}
	}
}

func (s *Service) getWorkspaceInfo(ctx context.Context, instanceID, workspaceID string) (*gitpod.WorkspaceInstance, error) {
	getData := func() (*gitpod.WorkspaceInstance, error) {
		if !s.usePublicAPI(ctx) {
			return s.lastServerInstance, nil
		}
		service := v1.NewWorkspacesServiceClient(s.publicAPIConn)
		resp, err := service.GetWorkspace(ctx, &v1.GetWorkspaceRequest{
			WorkspaceId: workspaceID,
		})
		if err != nil {
			log.WithField("method", "GetWorkspace").WithError(err).Error("failed to call PublicAPI")
			return nil, err
		}
		instance := &gitpod.WorkspaceInstance{
			CreationTime: resp.Result.Status.Instance.CreatedAt.String(),
			ID:           resp.Result.Status.Instance.InstanceId,
			Status: &gitpod.WorkspaceInstanceStatus{
				ExposedPorts: []*gitpod.WorkspaceInstancePort{},
				Message:      resp.Result.Status.Instance.Status.Message,
				// OwnerToken:   "", not used so ignore
				Phase:   resp.Result.Status.Instance.Status.Phase.String(),
				Timeout: resp.Result.Status.Instance.Status.Conditions.Timeout,
				Version: int(resp.Result.Status.Instance.Status.StatusVersion),
			},
			WorkspaceID: resp.Result.WorkspaceId,
		}
		for _, port := range resp.Result.Status.Instance.Status.Ports {
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
		return instance, nil
	}
	exp := &backoff.ExponentialBackOff{
		InitialInterval:     2 * time.Second,
		RandomizationFactor: 0.5,
		Multiplier:          1.5,
		MaxInterval:         30 * time.Second,
		MaxElapsedTime:      0,
		Stop:                backoff.Stop,
		Clock:               backoff.SystemClock,
	}
	return backoff.RetryWithData(getData, exp)
}

// InstanceUpdates implements protocol.APIInterface
func (s *Service) InstanceUpdates(ctx context.Context, instanceID string, workspaceID string) (<-chan *gitpod.WorkspaceInstance, error) {
	if !s.usePublicAPI(ctx) && s.persistServerAPIChannelWhenStart(ctx) {
		return s.gitpodService.InstanceUpdates(ctx, instanceID)
	}
	updateChan := make(chan *gitpod.WorkspaceInstance)
	var latestInstance *gitpod.WorkspaceInstance
	go func() {
		for {
			if ctx.Err() != nil {
				close(updateChan)
				break
			}
			if instance, err := s.getWorkspaceInfo(ctx, instanceID, workspaceID); err == nil {
				if reflect.DeepEqual(latestInstance, instance) {
					continue
				}
				latestInstance = instance
				updateChan <- instance
			}
			time.Sleep(1 * time.Second)
		}
	}()
	return updateChan, nil
}

// GetOwnerID implements APIInterface
func (s *Service) GetOwnerID(ctx context.Context, workspaceID string) (ownerID string, err error) {
	if !s.usePublicAPI(ctx) {
		resp, err := s.gitpodService.GetWorkspace(ctx, workspaceID)
		if err != nil {
			return "", err
		}
		return resp.Workspace.OwnerID, nil
	}
	service := v1.NewWorkspacesServiceClient(s.publicAPIConn)
	resp, err := service.GetWorkspace(ctx, &v1.GetWorkspaceRequest{
		WorkspaceId: workspaceID,
	})
	if err != nil {
		return "", err
	}
	return resp.Result.OwnerId, nil
}

func (s *Service) TrackEvent(ctx context.Context, event *gitpod.RemoteTrackMessage) (err error) {
	return s.gitpodService.TrackEvent(ctx, event)
}

func (s *Service) RegisterMetrics(registry *prometheus.Registry) error {
	return registry.Register(s.publicApiMetrics)
}
