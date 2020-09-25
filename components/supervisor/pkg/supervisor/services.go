// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"os"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/backup"
	ndeapi "github.com/gitpod-io/gitpod/ws-manager-node/api"

	"github.com/golang/protobuf/ptypes"
	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RegisterableService can register a service
type RegisterableService interface{}

// RegisterableGRPCService can register gRPC services
type RegisterableGRPCService interface {
	// RegisterGRPC registers a gRPC service
	RegisterGRPC(*grpc.Server)
}

// RegisterableRESTService can register REST services
type RegisterableRESTService interface {
	// RegisterREST registers a REST service
	RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error
}

type statusService struct {
	IWH      *backup.InWorkspaceHelper
	Ports    *portsManager
	IDEReady <-chan struct{}
}

func (s *statusService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterStatusServiceServer(srv, s)
}

func (s *statusService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterStatusServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

func (s *statusService) SupervisorStatus(context.Context, *api.SupervisorStatusRequest) (*api.SupervisorStatusResponse, error) {
	return &api.SupervisorStatusResponse{Ok: true}, nil
}

func (s *statusService) IDEStatus(ctx context.Context, req *api.IDEStatusRequest) (*api.IDEStatusResponse, error) {
	if req.Wait {
		select {
		case <-s.IDEReady:
			return &api.IDEStatusResponse{Ok: true}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
		}
	}

	var ok bool
	select {
	case <-s.IDEReady:
		ok = true
	default:
		ok = false
	}
	return &api.IDEStatusResponse{Ok: ok}, nil
}

// ContentStatus provides feedback regarding the workspace content readiness
func (s *statusService) ContentStatus(ctx context.Context, req *api.ContentStatusRequest) (*api.ContentStatusResponse, error) {
	srcmap := map[csapi.WorkspaceInitSource]api.ContentSource{
		csapi.WorkspaceInitFromOther:    api.ContentSource_from_other,
		csapi.WorkspaceInitFromBackup:   api.ContentSource_from_backup,
		csapi.WorkspaceInitFromPrebuild: api.ContentSource_from_prebuild,
	}

	if req.Wait {
		select {
		case <-s.IWH.ContentReady():
			src, _ := s.IWH.ContentSource()
			return &api.ContentStatusResponse{
				Available: true,
				Source:    srcmap[src],
			}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
		}
	}

	src, ok := s.IWH.ContentSource()
	if !ok {
		return &api.ContentStatusResponse{
			Available: false,
		}, nil
	}

	return &api.ContentStatusResponse{
		Available: true,
		Source:    srcmap[src],
	}, nil
}

func (s *statusService) BackupStatus(ctx context.Context, req *api.BackupStatusRequest) (*api.BackupStatusResponse, error) {
	return &api.BackupStatusResponse{
		CanaryAvailable: s.IWH.CanaryAvailable(),
	}, nil
}

func (s *statusService) PortsStatus(req *api.PortsStatusRequest, srv api.StatusService_PortsStatusServer) error {
	err := srv.Send(&api.PortsStatusResponse{
		Ports: s.Ports.ServedPorts(),
	})
	if err != nil {
		return err
	}
	if !req.Observe {
		return nil
	}

	sub := s.Ports.Subscribe()
	if sub == nil {
		return status.Error(codes.ResourceExhausted, "too many subscriptions")
	}
	defer sub.Close()

	for {
		select {
		case <-srv.Context().Done():
			return nil
		case update := <-sub.Updates():
			if update == nil {
				return nil
			}
			err := srv.Send(&api.PortsStatusResponse{Ports: update})
			if err != nil {
				return err
			}
		}
	}
}

// RegistrableTokenService can register the token service
type RegistrableTokenService struct {
	Service api.TokenServiceServer
}

// RegisterGRPC registers a gRPC service
func (s *RegistrableTokenService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterTokenServiceServer(srv, s.Service)
}

// RegisterREST registers a REST service
func (s *RegistrableTokenService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterTokenServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

// NewInMemoryTokenService produces a new InMemoryTokenService
func NewInMemoryTokenService() *InMemoryTokenService {
	return &InMemoryTokenService{
		provider: make(map[string][]tokenProvider),
	}
}

type token struct {
	Token      string
	Host       string
	Scope      map[string]struct{}
	ExpiryDate *time.Time
	Reuse      api.TokenReuse
}

type tokenProvider interface {
	GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *token, err error)
}

// InMemoryTokenService provides an in-memory caching token service
type InMemoryTokenService struct {
	token    []*token
	provider map[string][]tokenProvider
	mu       sync.RWMutex
}

// GetToken returns a token for a host
func (s *InMemoryTokenService) GetToken(ctx context.Context, req *api.GetTokenRequest) (*api.GetTokenResponse, error) {
	tkn, ok := s.getCachedTokenFor(req.Host, req.Scope)
	if ok {
		return &api.GetTokenResponse{Token: tkn}, nil
	}

	s.mu.RLock()
	prov := s.provider[req.Host]
	s.mu.RUnlock()
	for _, p := range prov {
		tkn, err := p.GetToken(ctx, req)
		if err != nil {
			log.WithError(err).WithField("host", req.Host).Warn("cannot get token from registered provider")
			continue
		}
		if tkn == nil {
			log.WithField("host", req.Host).Warn("got no token from registered provider")
			continue
		}

		s.cacheToken(tkn)
		return &api.GetTokenResponse{Token: tkn.Token}, nil
	}

	return nil, status.Error(codes.NotFound, "no token available")
}

func (s *InMemoryTokenService) getCachedTokenFor(host string, scopes []string) (tkn string, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var res *token
	for _, tkn := range s.token {
		if tkn.Host != host {
			continue
		}

		if tkn.ExpiryDate != nil && time.Now().After(*tkn.ExpiryDate) {
			continue
		}

		if tkn.Reuse == api.TokenReuse_REUSE_NEVER {
			continue
		}
		if tkn.Reuse == api.TokenReuse_REUSE_EXACTLY && len(tkn.Scope) != len(scopes) {
			continue
		}

		hasScopes := true
		for _, scp := range scopes {
			if _, ok := tkn.Scope[scp]; !ok {
				hasScopes = false
				break
			}
		}
		if !hasScopes {
			continue
		}

		res = tkn
		break
	}

	if res == nil {
		return "", false
	}
	return res.Token, true
}

func (s *InMemoryTokenService) cacheToken(tkn *token) {
	if tkn.Reuse == api.TokenReuse_REUSE_NEVER {
		// we just don't cache non-reuse tokens
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.token = append(s.token, tkn)
	log.WithField("host", tkn.Host).WithField("scopes", tkn.Scope).WithField("reuse", tkn.Reuse.String()).Info("registered new token")
}

func convertReceivedToken(req *api.SetTokenRequest) (tkn *token, err error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	if req.Host == "" {
		return nil, status.Error(codes.InvalidArgument, "host is required")
	}

	tkn = &token{
		Host:  req.Host,
		Scope: mapScopes(req.Scope),
		Token: req.Token,
		Reuse: req.Reuse,
	}
	if req.ExpiryDate != nil {
		te, err := ptypes.Timestamp(req.GetExpiryDate())
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid expiry date: %q", err)
		}
		if time.Now().After(te) {
			return nil, status.Error(codes.InvalidArgument, "invalid expiry date: already expired")
		}
		tkn.ExpiryDate = &te
	}

	return
}

func mapScopes(s []string) map[string]struct{} {
	scopes := make(map[string]struct{}, len(s))
	for _, scp := range s {
		scopes[scp] = struct{}{}
	}
	return scopes
}

// SetToken sets a token for a host
func (s *InMemoryTokenService) SetToken(ctx context.Context, req *api.SetTokenRequest) (*api.SetTokenResponse, error) {
	tkn, err := convertReceivedToken(req)
	if err != nil {
		return nil, err
	}
	s.cacheToken(tkn)

	return &api.SetTokenResponse{}, nil
}

// ClearToken clears previously cached tokens
func (s *InMemoryTokenService) ClearToken(ctx context.Context, req *api.ClearTokenRequest) (*api.ClearTokenResponse, error) {
	if req.GetAll() {
		s.mu.Lock()
		defer s.mu.Unlock()

		s.token = nil

		log.Info("cleared all cached tokens")
		return &api.ClearTokenResponse{}, nil
	}
	if tkn := req.GetValue(); tkn != "" {
		s.mu.Lock()
		defer s.mu.Unlock()

		var found bool
		for i, t := range s.token {
			if t.Token != tkn {
				continue
			}

			found = true
			s.token = append(s.token[:i], s.token[i+1:]...)
			log.WithField("host", t.Host).WithField("scopes", t.Scope).Info("cleared token")
			break
		}
		if !found {
			return nil, status.Error(codes.NotFound, "token not found")
		}

		return &api.ClearTokenResponse{}, nil
	}

	return nil, status.Error(codes.Unknown, "unknown operation")
}

// ProvideToken registers a token provider
func (s *InMemoryTokenService) ProvideToken(srv api.TokenService_ProvideTokenServer) error {
	req, err := srv.Recv()
	if err != nil {
		return err
	}

	reg := req.GetRegistration()
	if reg == nil {
		return status.Error(codes.FailedPrecondition, "must register first")
	}
	if reg.Host == "" {
		return status.Error(codes.InvalidArgument, "host is required")
	}

	rt := &remoteTokenProvider{srv, make(chan *remoteTknReq)}
	s.mu.Lock()
	s.provider[reg.Host] = append(s.provider[reg.Host], rt)
	s.mu.Unlock()

	err = rt.Serve()

	s.mu.Lock()
	for i, p := range s.provider[reg.Host] {
		if p == rt {
			s.provider[reg.Host] = append(s.provider[reg.Host][:i], s.provider[reg.Host][i+1:]...)
		}
	}
	s.mu.Unlock()

	return err
}

type remoteTknReq struct {
	Req  *api.GetTokenRequest
	Resp chan *token
	Err  chan error
}

type remoteTokenProvider struct {
	srv api.TokenService_ProvideTokenServer
	inc chan *remoteTknReq
}

func (rt *remoteTokenProvider) Serve() (err error) {
	defer func() {
		if err == nil {
			return
		}
		log.WithError(err).Warn("token provider dropped out")
	}()

	for {
		req := <-rt.inc

		err := rt.srv.Send(&api.ProvideTokenResponse{Request: req.Req})
		if err != nil {
			req.Err <- err
			return err
		}

		resp, err := rt.srv.Recv()
		if err != nil {
			req.Err <- err
			return err
		}

		answ := resp.GetAnswer()
		if answ == nil {
			err = status.Error(codes.InvalidArgument, "provider did not answer request")
			req.Err <- err
			return err
		}

		tkn, err := convertReceivedToken(answ)
		if err != nil {
			req.Err <- err
			return err
		}

		req.Resp <- tkn
	}
}

func (rt *remoteTokenProvider) GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *token, err error) {
	rr := &remoteTknReq{
		Req:  req,
		Err:  make(chan error, 1),
		Resp: make(chan *token, 1),
	}
	rt.inc <- rr

	select {
	case <-ctx.Done():
		return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
	case err = <-rr.Err:
	case tkn = <-rr.Resp:
	}
	return
}

// InfoService implements the api.InfoService
type InfoService struct {
	cfg *Config
}

// RegisterGRPC registers the gRPC info service
func (is *InfoService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterInfoServiceServer(srv, is)
}

// RegisterREST registers the REST info service
func (is *InfoService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterInfoServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

// WorkspaceInfo provides information about the workspace
func (is *InfoService) WorkspaceInfo(context.Context, *api.WorkspaceInfoRequest) (*api.WorkspaceInfoResponse, error) {
	resp := &api.WorkspaceInfoResponse{
		CheckoutLocation: is.cfg.RepoRoot,
		InstanceId:       is.cfg.WorkspaceInstanceID,
		WorkspaceId:      is.cfg.WorkspaceID,
	}

	stat, err := os.Stat(is.cfg.WorkspaceRoot)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if stat.IsDir() {
		resp.WorkspaceLocation = &api.WorkspaceInfoResponse_WorkspaceLocationFolder{WorkspaceLocationFolder: is.cfg.WorkspaceRoot}
	} else {
		resp.WorkspaceLocation = &api.WorkspaceInfoResponse_WorkspaceLocationFile{WorkspaceLocationFile: is.cfg.WorkspaceRoot}
	}

	resp.UserHome, err = os.UserHomeDir()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	endpoint, host, err := is.cfg.GitpodAPIEndpoint()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	resp.GitpodApi = &api.WorkspaceInfoResponse_GitpodAPI{
		Endpoint: endpoint,
		Host:     host,
	}

	return resp, nil
}

// ControlService implements the supervisor control service
type ControlService struct {
	UidmapCanary *ndeapi.InWorkspaceHelper
}

// RegisterGRPC registers the gRPC info service
func (c *ControlService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterControlServiceServer(srv, c)
}

// Newuidmap establishes a new UID mapping in a user namespace
func (c *ControlService) Newuidmap(ctx context.Context, req *api.NewuidmapRequest) (*api.NewuidmapResponse, error) {
	if !c.UidmapCanary.CanaryAvailable() {
		return nil, status.Error(codes.Unavailable, "service unavailable")
	}

	mapping := make([]*ndeapi.UidmapCanaryRequest_Mapping, len(req.Mapping))
	for i, m := range req.Mapping {
		mapping[i] = &ndeapi.UidmapCanaryRequest_Mapping{
			ContainerId: m.ContainerId,
			HostId:      m.HostId,
			Size:        m.Size,
		}
	}

	ndereq := &ndeapi.UidmapCanaryRequest{
		Pid:     req.Pid,
		Gid:     req.Gid,
		Mapping: mapping,
	}

	err := c.UidmapCanary.Newuidmap(ctx, ndereq)
	if err != nil {
		return nil, err
	}

	return &api.NewuidmapResponse{}, nil
}
