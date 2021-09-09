// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"io"
	"io/ioutil"
	"net/url"
	"strconv"
	"sync"
	"time"

	validation "github.com/go-ozzo/ozzo-validation"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

// WorkspaceCoords represents the coordinates of a workspace (port)
type WorkspaceCoords struct {
	// The workspace ID
	ID string
	// The workspace port. "" in case of Theia
	Port string
}

// WorkspaceInfoProvider is an entity that is able to provide workspaces related information
type WorkspaceInfoProvider interface {
	// WorkspaceInfo returns the workspace information of a workspace using it's workspace ID
	WorkspaceInfo(ctx context.Context, workspaceID string) *WorkspaceInfo

	// WorkspaceCoords provides workspace coordinates for a workspace using the public port
	// exposed by this service.
	WorkspaceCoords(publicPort string) *WorkspaceCoords
}

// WorkspaceInfoProviderConfig configures a WorkspaceInfoProvider
type WorkspaceInfoProviderConfig struct {
	WsManagerAddr     string        `json:"wsManagerAddr"`
	ReconnectInterval util.Duration `json:"reconnectInterval"`
	TLS               struct {
		CA   string `json:"ca"`
		Cert string `json:"crt"`
		Key  string `json:"key"`
	} `json:"tls"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *WorkspaceInfoProviderConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("WorkspaceInfoProviderConfig not configured")
	}

	err := validation.ValidateStruct(c,
		validation.Field(&c.WsManagerAddr, validation.Required),
	)
	return err
}

// WorkspaceInfo is all the infos ws-proxy needs to know about a workspace
type WorkspaceInfo struct {
	WorkspaceID string
	InstanceID  string
	URL         string

	IDEImage string

	// (parsed from URL)
	IDEPublicPort string

	Ports     []PortInfo
	Auth      *wsapi.WorkspaceAuthentication
	Phase     wsapi.WorkspacePhase
	StartedAt time.Time
}

// PortInfo contains all information ws-proxy needs to know about a workspace port
type PortInfo struct {
	wsapi.PortSpec

	// The publicly visible proxy port it is exposed on
	PublicPort string
}

// RemoteWorkspaceInfoProvider provides (cached) infos about running workspaces that it queries from ws-manager
type RemoteWorkspaceInfoProvider struct {
	Config WorkspaceInfoProviderConfig
	Dialer WSManagerDialer

	stop  chan struct{}
	ready bool
	mu    sync.Mutex
	cache *workspaceInfoCache
}

// WSManagerDialer dials out to a ws-manager instance
type WSManagerDialer func(target string, dialOption grpc.DialOption) (io.Closer, wsapi.WorkspaceManagerClient, error)

// NewRemoteWorkspaceInfoProvider creates a fresh WorkspaceInfoProvider
func NewRemoteWorkspaceInfoProvider(config WorkspaceInfoProviderConfig) *RemoteWorkspaceInfoProvider {
	return &RemoteWorkspaceInfoProvider{
		Config: config,
		Dialer: defaultWsmanagerDialer,
		cache:  newWorkspaceInfoCache(),
		stop:   make(chan struct{}),
	}
}

// Close prevents the info provider from connecting
func (p *RemoteWorkspaceInfoProvider) Close() {
	close(p.stop)
}

func defaultWsmanagerDialer(target string, dialOption grpc.DialOption) (io.Closer, wsapi.WorkspaceManagerClient, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	grpcOpts := common_grpc.DefaultClientOptions()
	grpcOpts = append(grpcOpts, dialOption)
	conn, err := grpc.DialContext(ctx, target, grpcOpts...)
	if err != nil {
		return nil, nil, err
	}

	client := wsapi.NewWorkspaceManagerClient(conn)
	return conn, client, err
}

// Run is meant to be called as a go-routine and streams the current state of all workspace statuus from ws-manager,
// transforms the relevent pieces into WorkspaceInfos and stores them in the cache
func (p *RemoteWorkspaceInfoProvider) Run() (err error) {
	// create initial connection
	target := p.Config.WsManagerAddr
	dialOption := grpc.WithInsecure()
	if p.Config.TLS.CA != "" && p.Config.TLS.Cert != "" && p.Config.TLS.Key != "" {
		log.
			WithField("ca", p.Config.TLS.CA).
			WithField("cert", p.Config.TLS.Cert).
			WithField("key", p.Config.TLS.Key).
			Debug("using TLS config to connect ws-manager")
		certPool := x509.NewCertPool()
		ca, err := ioutil.ReadFile(p.Config.TLS.CA)
		if err != nil {
			return err
		}
		if !certPool.AppendCertsFromPEM(ca) {
			return xerrors.Errorf("failed appending CA cert")
		}
		cert, err := tls.LoadX509KeyPair(p.Config.TLS.Cert, p.Config.TLS.Key)
		if err != nil {
			return err
		}
		creds := credentials.NewTLS(&tls.Config{
			Certificates: []tls.Certificate{cert},
			RootCAs:      certPool,
		})
		dialOption = grpc.WithTransportCredentials(creds)
	}
	conn, client, err := p.Dialer(target, dialOption)
	if err != nil {
		return xerrors.Errorf("error while connecting to ws-manager: %w", err)
	}

	// do the initial fetching synchronously
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	infos, err := p.fetchInitialWorkspaceInfo(ctx, client)
	if err != nil {
		return err
	}
	p.cache.Reinit(infos)

	// maintain connection and stream workspace statuus
	go func(conn io.Closer, client wsapi.WorkspaceManagerClient) {
		for {
			p.mu.Lock()
			p.ready = true
			p.mu.Unlock()

			err := p.listen(client)
			if xerrors.Is(err, io.EOF) {
				log.Warn("ws-manager closed the connection, reconnecting after timeout...")
			} else if err != nil {
				log.WithError(err).Warnf("error while listening for workspace status updates, reconnecting after timeout")
			}

			conn.Close()
			p.mu.Lock()
			p.ready = false
			p.mu.Unlock()

			var stop bool
			select {
			case <-p.stop:
				stop = true
			default:
			}
			if stop {
				break
			}

			for {
				time.Sleep(time.Duration(p.Config.ReconnectInterval))

				conn, client, err = p.Dialer(target, dialOption)
				if err != nil {
					log.WithError(err).Warnf("error while connecting to ws-manager, reconnecting after timeout...")
					continue
				}
				break
			}
		}
	}(conn, client)

	return nil
}

// Ready returns true if the info provider is up and running
func (p *RemoteWorkspaceInfoProvider) Ready() bool {
	p.mu.Lock()
	defer p.mu.Unlock()

	return p.ready
}

// listen starts listening to WorkspaceStatus updates from ws-manager
func (p *RemoteWorkspaceInfoProvider) listen(client wsapi.WorkspaceManagerClient) (err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("error while starting streaming status updates from ws-manager: %w", err)
		}
	}()

	// rebuild entire cache on (re-)connect
	ctx := context.Background()
	infos, err := p.fetchInitialWorkspaceInfo(ctx, client)
	if err != nil {
		return err
	}
	p.cache.Reinit(infos)

	// start streaming status updates
	stream, err := client.Subscribe(ctx, &wsapi.SubscribeRequest{})
	if err != nil {
		return err
	}
	for {
		resp, err := stream.Recv()
		if err != nil {
			return err
		}

		status := resp.GetStatus()
		if status == nil {
			// some subscription responses contain log output rather than status updates.
			continue
		}

		if status.Phase == wsapi.WorkspacePhase_STOPPED {
			p.cache.Delete(status.Metadata.MetaId, status.Id)
		} else {
			info := mapWorkspaceStatusToInfo(status)
			p.cache.Insert(info)
		}
	}
}

// fetchInitialWorkspaceInfo retrieves initial WorkspaceStatus' from ws-manager and maps them into WorkspaceInfos
func (p *RemoteWorkspaceInfoProvider) fetchInitialWorkspaceInfo(ctx context.Context, client wsapi.WorkspaceManagerClient) ([]*WorkspaceInfo, error) {
	initialResp, err := client.GetWorkspaces(ctx, &wsapi.GetWorkspacesRequest{})
	if err != nil {
		return nil, xerrors.Errorf("error while retrieving initial state from ws-manager: %w", err)
	}

	var infos []*WorkspaceInfo
	for _, status := range initialResp.GetStatus() {
		infos = append(infos, mapWorkspaceStatusToInfo(status))
	}
	return infos, nil
}

func mapWorkspaceStatusToInfo(status *wsapi.WorkspaceStatus) *WorkspaceInfo {
	var portInfos []PortInfo
	for _, spec := range status.Spec.ExposedPorts {
		proxyPort := getPortStr(spec.Url)
		if proxyPort == "" {
			continue
		}

		portInfos = append(portInfos, PortInfo{
			PortSpec:   *spec,
			PublicPort: proxyPort,
		})
	}

	return &WorkspaceInfo{
		WorkspaceID:   status.Metadata.MetaId,
		InstanceID:    status.Id,
		URL:           status.Spec.Url,
		IDEImage:      status.Spec.IdeImage,
		IDEPublicPort: getPortStr(status.Spec.Url),
		Ports:         portInfos,
		Auth:          status.Auth,
		Phase:         status.Phase,
		StartedAt:     status.Metadata.StartedAt.AsTime(),
	}
}

// WorkspaceInfo return the WorkspaceInfo available for the given workspaceID.
// Callers should make sure their context gets canceled properly. For good measure
// this function will timeout by itself as well.
func (p *RemoteWorkspaceInfoProvider) WorkspaceInfo(ctx context.Context, workspaceID string) *WorkspaceInfo {
	// In case the parent context does not cancel for some reason, we want to make sure
	// we clean up after ourselves to not leak Go routines.
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	info, present := p.cache.WaitFor(ctx, workspaceID)
	if !present {
		return nil
	}
	return info
}

// WorkspaceCoords returns the WorkspaceCoords the given publicPort is associated with
func (p *RemoteWorkspaceInfoProvider) WorkspaceCoords(publicPort string) *WorkspaceCoords {
	coords, present := p.cache.GetCoordsByPublicPort(publicPort)
	if !present {
		return nil
	}
	return coords
}

// getPortStr extracts the port part from a given URL string. Returns "" if parsing fails or port is not specified
func getPortStr(urlStr string) string {
	portURL, err := url.Parse(urlStr)
	if err != nil {
		log.WithField("url", urlStr).WithError(err).Error("error parsing URL while getting URL port")
		return ""
	}
	if portURL.Port() == "" {
		switch scheme := portURL.Scheme; scheme {
		case "http":
			return "80"
		case "https":
			return "443"
		}
	}
	return portURL.Port()
}

// TODO(rl): type def workspaceID and instanceID throughout for better readability and type safety?
type workspaceInfosByInstance map[string]*WorkspaceInfo
type instanceInfosByWorkspace map[string]workspaceInfosByInstance

// workspaceInfoCache stores WorkspaceInfo in a manner which is easy to query for WorkspaceInfoProvider
type workspaceInfoCache struct {
	// WorkspaceInfos indexed by workspaceID and then instanceID
	infos instanceInfosByWorkspace
	// WorkspaceCoords indexed by public (proxy) port (string)
	coordsByPublicPort map[string]*WorkspaceCoords

	// cond signals the arrival of new workspace info
	cond *sync.Cond
	// mu is cond's Locker
	mu *sync.RWMutex
}

func newWorkspaceInfoCache() *workspaceInfoCache {
	var mu sync.RWMutex
	return &workspaceInfoCache{
		infos:              make(map[string]workspaceInfosByInstance),
		coordsByPublicPort: make(map[string]*WorkspaceCoords),
		mu:                 &mu,
		cond:               sync.NewCond(&mu),
	}
}

func (c *workspaceInfoCache) Reinit(infos []*WorkspaceInfo) {
	c.cond.L.Lock()
	defer c.cond.L.Unlock()

	c.infos = make(map[string]workspaceInfosByInstance, len(infos))
	c.coordsByPublicPort = make(map[string]*WorkspaceCoords, len(c.coordsByPublicPort))

	for _, info := range infos {
		c.doInsert(info)
	}
	c.cond.Broadcast()
}

func (c *workspaceInfoCache) Insert(info *WorkspaceInfo) {
	c.cond.L.Lock()
	defer c.cond.L.Unlock()

	c.doInsert(info)
	c.cond.Broadcast()
}

func (c *workspaceInfoCache) doInsert(info *WorkspaceInfo) {
	existingInfos, ok := c.infos[info.WorkspaceID]
	if !ok {
		existingInfos = make(map[string]*WorkspaceInfo)
	}
	existingInfos[info.InstanceID] = info
	c.infos[info.WorkspaceID] = existingInfos

	// NOTE: in the unlikely event that a subsequent insert changes the port
	//       then we add it here assuming that the delete will remove it
	c.coordsByPublicPort[info.IDEPublicPort] = &WorkspaceCoords{
		ID: info.WorkspaceID,
	}

	for _, p := range info.Ports {
		c.coordsByPublicPort[p.PublicPort] = &WorkspaceCoords{
			ID:   info.WorkspaceID,
			Port: strconv.Itoa(int(p.Port)),
		}
	}
}

func (c *workspaceInfoCache) Delete(workspaceID string, instanceID string) {
	c.cond.L.Lock()
	defer c.cond.L.Unlock()

	infos, present := c.infos[workspaceID]
	if !present || infos == nil {
		return
	}

	// Keep only the active instances and public port(s) for the workspace id
	var instanceIDEPublicPort string
	if info, ok := infos[instanceID]; ok {
		delete(infos, instanceID)
		instanceIDEPublicPort = info.IDEPublicPort
	}

	if len(infos) == 0 {
		delete(c.infos, workspaceID)
	} else {
		c.infos[workspaceID] = infos
	}

	// Clean up the public port if port no longer active
	activePublicPorts := make(map[string]interface{})
	for _, info := range infos {
		activePublicPorts[info.IDEPublicPort] = true
	}

	if _, ok := activePublicPorts[instanceIDEPublicPort]; !ok {
		log.WithField("workspaceID", workspaceID).WithField("instanceID", instanceID).WithField("port", instanceIDEPublicPort).Debug("deleting port for workspace")
		delete(c.coordsByPublicPort, instanceIDEPublicPort)
	}
}

// WaitFor waits for workspace info until that info is available or the context is canceled.
func (c *workspaceInfoCache) WaitFor(ctx context.Context, workspaceID string) (w *WorkspaceInfo, ok bool) {
	c.mu.RLock()
	existing, ok := c.infos[workspaceID]
	c.mu.RUnlock()

	getCandidate := func(infos map[string]*WorkspaceInfo) *WorkspaceInfo {
		// Find the *best* candidate i.e. prefer any instance running over stopping/stopped
		// If there are >1 instances in running state it will pick the most recently started
		// as opposed to the random iteration order (which is harder to test)
		// NOTE: Yes, these is a potential issue with clock drift
		//       but this scenario is extremely unlikely to happen in the wild
		var candidate *WorkspaceInfo
		for _, info := range infos {
			if candidate == nil ||
				(info.Phase == wsapi.WorkspacePhase_RUNNING &&
					(candidate.Phase != info.Phase || info.StartedAt.After(candidate.StartedAt))) ||
				(candidate.Phase > wsapi.WorkspacePhase_RUNNING && candidate.Phase < info.Phase) {
				candidate = info
			}
		}
		return candidate
	}

	if ok {
		return getCandidate(existing), true
	}

	inc := make(chan *WorkspaceInfo)
	go func() {
		defer close(inc)

		c.cond.L.Lock()
		defer c.cond.L.Unlock()
		for {
			c.cond.Wait()
			if ctx.Err() != nil {
				return
			}

			infos, ok := c.infos[workspaceID]
			if !ok {
				continue
			}

			inc <- getCandidate(infos)
			return
		}
	}()

	select {
	case w = <-inc:
		if w == nil {
			return nil, false
		}
		return w, true
	case <-ctx.Done():
		return nil, false
	}
}

func (c *workspaceInfoCache) GetCoordsByPublicPort(wsProxyPort string) (*WorkspaceCoords, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	coords, ok := c.coordsByPublicPort[wsProxyPort]
	return coords, ok
}

type fixedInfoProvider struct {
	Infos  map[string]*WorkspaceInfo
	Coords map[string]*WorkspaceCoords
}

// WorkspaceInfo returns the workspace information of a workspace using it's workspace ID
func (fp *fixedInfoProvider) WorkspaceInfo(ctx context.Context, workspaceID string) *WorkspaceInfo {
	if fp.Infos == nil {
		return nil
	}
	return fp.Infos[workspaceID]
}

// WorkspaceCoords provides workspace coordinates for a workspace using the public port exposed by this service.
func (fp *fixedInfoProvider) WorkspaceCoords(publicPort string) *WorkspaceCoords {
	if fp.Coords == nil {
		return nil
	}
	return fp.Coords[publicPort]
}
