// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang/protobuf/ptypes"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/ports"
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

type ideReadyState struct {
	ready bool
	cond  *sync.Cond
}

// Wait returns a channel that emits when IDE is ready
func (service *ideReadyState) Wait() <-chan struct{} {
	ready := make(chan struct{})
	go func() {
		service.cond.L.Lock()
		for !service.ready {
			service.cond.Wait()
		}
		service.cond.L.Unlock()
		close(ready)
	}()
	return ready
}

// Get checks whether IDE is ready
func (service *ideReadyState) Get() bool {
	service.cond.L.Lock()
	ready := service.ready
	service.cond.L.Unlock()
	return ready
}

// Set updates IDE ready state
func (service *ideReadyState) Set(ready bool) {
	service.cond.L.Lock()
	defer service.cond.L.Unlock()
	if service.ready == ready {
		return
	}
	service.ready = ready
	service.cond.Broadcast()
}

type statusService struct {
	ContentState ContentState
	Ports        *ports.Manager
	Tasks        *tasksManager
	ideReady     *ideReadyState

	api.UnimplementedStatusServiceServer
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
		case <-s.ideReady.Wait():
			return &api.IDEStatusResponse{Ok: true}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
		}
	}

	ok := s.ideReady.Get()
	return &api.IDEStatusResponse{Ok: ok}, nil
}

// ContentStatus provides feedback regarding the workspace content readiness
func (s *statusService) ContentStatus(ctx context.Context, req *api.ContentStatusRequest) (*api.ContentStatusResponse, error) {
	srcmap := map[csapi.WorkspaceInitSource]api.ContentSource{
		csapi.WorkspaceInitFromOther:    api.ContentSource_from_other,
		csapi.WorkspaceInitFromBackup:   api.ContentSource_from_backup,
		csapi.WorkspaceInitFromPrebuild: api.ContentSource_from_prebuild,
	}

	cs := s.ContentState
	if req.Wait {
		select {
		case <-cs.ContentReady():
			src, _ := cs.ContentSource()
			return &api.ContentStatusResponse{
				Available: true,
				Source:    srcmap[src],
			}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
		}
	}

	src, ok := cs.ContentSource()
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
	return nil, status.Error(codes.Unimplemented, "not implemented")
}

func (s *statusService) PortsStatus(req *api.PortsStatusRequest, srv api.StatusService_PortsStatusServer) error {
	if !req.Observe {
		return srv.Send(&api.PortsStatusResponse{
			Ports: s.Ports.Status(),
		})
	}

	sub, err := s.Ports.Subscribe()
	if err == ports.ErrTooManySubscriptions {
		return status.Error(codes.ResourceExhausted, "too many subscriptions")
	}
	if err != nil {
		return status.Error(codes.Internal, err.Error())
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
			err := srv.Send(&api.PortsStatusResponse{
				Ports: update,
			})
			if err != nil {
				return err
			}
		}
	}
}

func (s *statusService) TasksStatus(req *api.TasksStatusRequest, srv api.StatusService_TasksStatusServer) error {
	select {
	case <-srv.Context().Done():
		return nil
	case <-s.Tasks.ready:
	}

	if !req.Observe {
		return srv.Send(&api.TasksStatusResponse{
			Tasks: s.Tasks.Status(),
		})
	}

	sub := s.Tasks.Subscribe()
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
			err := srv.Send(&api.TasksStatusResponse{Tasks: update})
			if err != nil {
				return err
			}
		}
	}
}

// RegistrableTokenService can register the token service
type RegistrableTokenService struct {
	Service api.TokenServiceServer

	api.UnimplementedTokenServiceServer
}

// RegisterGRPC registers a gRPC service
func (s RegistrableTokenService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterTokenServiceServer(srv, s.Service)
}

// RegisterREST registers a REST service
func (s RegistrableTokenService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterTokenServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

// NewInMemoryTokenService produces a new InMemoryTokenService
func NewInMemoryTokenService() *InMemoryTokenService {
	return &InMemoryTokenService{
		token:    make(map[string][]*Token),
		provider: make(map[string][]tokenProvider),
	}
}

// Token can be used to access the host limited to the granted scopes
type Token struct {
	User       string
	Token      string
	Host       string
	Scope      map[string]struct{}
	ExpiryDate *time.Time
	Reuse      api.TokenReuse
}

// Match checks whether token can be reused to access for the given args
func (tkn *Token) Match(host string, scopes []string) bool {
	if tkn.Host != host {
		return false
	}

	if tkn.ExpiryDate != nil && time.Now().After(*tkn.ExpiryDate) {
		return false
	}

	if tkn.Reuse == api.TokenReuse_REUSE_NEVER {
		return false
	}
	if tkn.Reuse == api.TokenReuse_REUSE_EXACTLY && len(tkn.Scope) != len(scopes) {
		return false
	}

	if !tkn.HasScopes(scopes) {
		return false
	}

	return true
}

// HasScopes checks whether token can be used to access for the given scopes
func (tkn *Token) HasScopes(scopes []string) bool {
	if len(scopes) == 0 {
		return true
	}
	for _, scp := range scopes {
		if _, ok := tkn.Scope[scp]; !ok {
			return false
		}
	}

	return true
}

type tokenProvider interface {
	GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error)
}

// InMemoryTokenService provides an in-memory caching token service
type InMemoryTokenService struct {
	token    map[string][]*Token
	provider map[string][]tokenProvider
	mu       sync.RWMutex

	api.UnimplementedTokenServiceServer
}

// GetToken returns a token for a host
func (s *InMemoryTokenService) GetToken(ctx context.Context, req *api.GetTokenRequest) (*api.GetTokenResponse, error) {
	// filter empty scopes, when no scopes are requested, i.e. empty list [] we return an arbitrary/max scoped token, see Token.HasScopes
	var scopes []string
	for _, scope := range req.Scope {
		scope = strings.TrimSpace(scope)
		if len(scope) != 0 {
			scopes = append(scopes, scope)
		}
	}
	req.Scope = scopes

	tkn := s.getCachedTokenFor(req.Kind, req.Host, req.Scope)
	if tkn != nil {
		return asGetTokenResponse(tkn), nil
	}

	s.mu.RLock()
	prov := s.provider[req.Kind]
	s.mu.RUnlock()
	for _, p := range prov {
		tkn, err := p.GetToken(ctx, req)
		if err != nil {
			log.WithError(err).WithField("kind", req.Kind).WithField("host", req.Host).Warn("cannot get token from registered provider")
			continue
		}
		if tkn == nil {
			log.WithField("kind", req.Kind).WithField("host", req.Host).Warn("got no token from registered provider")
			continue
		}

		s.cacheToken(req.Kind, tkn)
		return asGetTokenResponse(tkn), nil
	}

	return nil, status.Error(codes.NotFound, "no token available")
}

func asGetTokenResponse(tkn *Token) *api.GetTokenResponse {
	resp := &api.GetTokenResponse{Token: tkn.Token, User: tkn.User}
	for scope := range tkn.Scope {
		resp.Scope = append(resp.Scope, scope)
	}
	return resp
}

func (s *InMemoryTokenService) getCachedTokenFor(kind string, host string, scopes []string) *Token {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, tkn := range s.token[kind] {
		if tkn.Match(host, scopes) {
			return tkn
		}
	}
	return nil
}

func (s *InMemoryTokenService) cacheToken(kind string, tkn *Token) {
	if tkn.Reuse == api.TokenReuse_REUSE_NEVER {
		// we just don't cache non-reuse tokens
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.token[kind] = append(s.token[kind], tkn)
	log.WithField("kind", kind).WithField("host", tkn.Host).WithField("scopes", tkn.Scope).WithField("reuse", tkn.Reuse.String()).Info("registered new token")
}

func convertReceivedToken(req *api.SetTokenRequest) (tkn *Token, err error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}
	if req.Host == "" {
		return nil, status.Error(codes.InvalidArgument, "host is required")
	}

	tkn = &Token{
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
	s.cacheToken(req.Kind, tkn)

	return &api.SetTokenResponse{}, nil
}

// ClearToken clears previously cached tokens
func (s *InMemoryTokenService) ClearToken(ctx context.Context, req *api.ClearTokenRequest) (*api.ClearTokenResponse, error) {
	if req.GetAll() {
		s.mu.Lock()
		defer s.mu.Unlock()

		s.token[req.Kind] = nil

		log.WithField("kind", req.Kind).Info("cleared all cached tokens")
		return &api.ClearTokenResponse{}, nil
	}
	if tkn := req.GetValue(); tkn != "" {
		s.mu.Lock()
		defer s.mu.Unlock()

		var found bool
		token := s.token[req.Kind]
		for i, t := range token {
			if t.Token != tkn {
				continue
			}

			found = true
			token = append(token[:i], token[i+1:]...)
			log.WithField("kind", req.Kind).WithField("host", t.Host).WithField("scopes", t.Scope).Info("cleared token")
			break
		}
		s.token[req.Kind] = token
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
	if reg.Kind == "" {
		return status.Error(codes.InvalidArgument, "kind is required")
	}

	rt := &remoteTokenProvider{srv, make(chan *remoteTknReq)}
	s.mu.Lock()
	s.provider[reg.Kind] = append(s.provider[reg.Kind], rt)
	s.mu.Unlock()

	err = rt.Serve()

	s.mu.Lock()
	for i, p := range s.provider[reg.Kind] {
		if p == rt {
			s.provider[reg.Kind] = append(s.provider[reg.Kind][:i], s.provider[reg.Kind][i+1:]...)
		}
	}
	s.mu.Unlock()

	return err
}

type remoteTknReq struct {
	Req  *api.GetTokenRequest
	Resp chan *Token
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

func (rt *remoteTokenProvider) GetToken(ctx context.Context, req *api.GetTokenRequest) (tkn *Token, err error) {
	rr := &remoteTknReq{
		Req:  req,
		Err:  make(chan error, 1),
		Resp: make(chan *Token, 1),
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
	cfg          *Config
	ContentState ContentState

	api.UnimplementedInfoServiceServer
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
		CheckoutLocation:    is.cfg.RepoRoot,
		InstanceId:          is.cfg.WorkspaceInstanceID,
		WorkspaceId:         is.cfg.WorkspaceID,
		GitpodHost:          is.cfg.GitpodHost,
		WorkspaceContextUrl: is.cfg.WorkspaceContextURL,
	}

	commit, err := is.cfg.getCommit()
	if err != nil {
		log.WithError(err).Error()
	} else if commit != nil && commit.Repository != nil {
		resp.Repository = &api.WorkspaceInfoResponse_Repository{
			Owner: commit.Repository.Owner,
			Name:  commit.Repository.Name,
		}
	}

	_, contentReady := is.ContentState.ContentSource()
	if contentReady {
		stat, err := os.Stat(is.cfg.WorkspaceRoot)
		if err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
		if stat.IsDir() {
			resp.WorkspaceLocation = &api.WorkspaceInfoResponse_WorkspaceLocationFolder{WorkspaceLocationFolder: is.cfg.WorkspaceRoot}
		} else {
			resp.WorkspaceLocation = &api.WorkspaceInfoResponse_WorkspaceLocationFile{WorkspaceLocationFile: is.cfg.WorkspaceRoot}
		}
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
	portsManager *ports.Manager

	api.UnimplementedControlServiceServer
}

// RegisterGRPC registers the gRPC info service
func (c *ControlService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterControlServiceServer(srv, c)
}

// ExposePort exposes a port
func (c *ControlService) ExposePort(ctx context.Context, req *api.ExposePortRequest) (*api.ExposePortResponse, error) {
	err := c.portsManager.Expose(ctx, req.Port, req.TargetPort)
	return &api.ExposePortResponse{}, err
}

// ContentState signals the workspace content state
type ContentState interface {
	MarkContentReady(src csapi.WorkspaceInitSource)
	ContentReady() <-chan struct{}
	ContentSource() (src csapi.WorkspaceInitSource, ok bool)
}

// NewInMemoryContentState creates a new InMemoryContentState
func NewInMemoryContentState(checkoutLocation string) *InMemoryContentState {
	return &InMemoryContentState{
		checkoutLocation: checkoutLocation,
		contentReadyChan: make(chan struct{}),
	}
}

// InMemoryContentState implements the ContentState interface in-memory
type InMemoryContentState struct {
	checkoutLocation string

	contentReadyChan chan struct{}
	contentSource    csapi.WorkspaceInitSource
}

// MarkContentReady marks the workspace content as available.
// This function is not synchronized and must be called from a single thread/go routine only.
func (state *InMemoryContentState) MarkContentReady(src csapi.WorkspaceInitSource) {
	state.contentSource = src
	close(state.contentReadyChan)
}

// ContentReady returns a chan that closes when the content becomes available
func (state *InMemoryContentState) ContentReady() <-chan struct{} {
	return state.contentReadyChan
}

// ContentSource returns the init source of the workspace content.
// The value returned here is only OK after ContentReady() was closed.
func (state *InMemoryContentState) ContentSource() (src csapi.WorkspaceInitSource, ok bool) {
	select {
	case <-state.contentReadyChan:
	default:
		return "", false
	}
	return state.contentSource, true
}
