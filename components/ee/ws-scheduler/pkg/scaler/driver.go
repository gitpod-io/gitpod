// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/docker/distribution/reference"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/namegen"
	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	// DefaultGhostOwner is the UID of the default owner for ghost workspaces
	DefaultGhostOwner = "00000000-0000-0000-0000-000000000000"
)

// WorkspaceManagerPrescaleDriverConfig configures a ws-manager based prescale driver
type WorkspaceManagerPrescaleDriverConfig struct {
	WsManager       WorkspaceManagerConfig     `json:"wsman"`
	GhostOwner      string                     `json:"ghostOwner"`
	WorkspaceImage  string                     `json:"workspaceImage"`
	IDEImage        string                     `json:"ideImage"`
	SupervisorImage string                     `json:"supervisorImage"`
	FeatureFlags    []api.WorkspaceFeatureFlag `json:"featureFlags"`

	MaxGhostWorkspaces int           `json:"maxGhostWorkspaces"`
	SchedulerInterval  util.Duration `json:"schedulerInterval"`

	Renewal struct {
		Interval   util.Duration `json:"interval"`
		Percentage int           `json:"percentage"`
	} `json:"renewal"`
}

type WorkspaceManagerConfig struct {
	Addr string `json:"addr"`
	TLS  *struct {
		CA          string `json:"ca"`
		Certificate string `json:"crt"`
		PrivateKey  string `json:"key"`
	} `json:"tls"`
}

// NewWorkspaceManagerPrescaleDriver creates a new WorkspaceManagerPrescale
func NewWorkspaceManagerPrescaleDriver(config WorkspaceManagerPrescaleDriverConfig, controller Controller) (*WorkspaceManagerPrescaleDriver, error) {
	if config.GhostOwner == "" {
		config.GhostOwner = DefaultGhostOwner
	}
	if config.Renewal.Percentage < 0 && 100 < config.Renewal.Percentage {
		return nil, xerrors.Errorf("renewal.percentage must be between 0 and 100 (inclusive)")
	}
	if config.SchedulerInterval <= 0 {
		return nil, xerrors.Errorf("schedulerInterval must be greater than zero")
	}
	imgRef, err := reference.ParseNormalizedNamed(config.WorkspaceImage)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse workspaceImage")
	}
	config.WorkspaceImage = imgRef.String()

	grpcOpts := common_grpc.DefaultClientOptions()
	if config.WsManager.TLS != nil {
		tlsConfig, err := common_grpc.ClientAuthTLSConfig(
			config.WsManager.TLS.CA, config.WsManager.TLS.Certificate, config.WsManager.TLS.PrivateKey,
			common_grpc.WithSetRootCAs(true),
		)
		if err != nil {
			log.WithField("config", config.WsManager.TLS).Error("Cannot load ws-manager certs - this is a configuration issue.")
			return nil, xerrors.Errorf("cannot load ws-manager certs: %w", err)
		}

		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	} else {
		grpcOpts = append(grpcOpts, grpc.WithInsecure())
	}

	conn, err := grpc.Dial(config.WsManager.Addr, grpcOpts...)
	if err != nil {
		return nil, xerrors.Errorf("cannot connect to ws-manager: %w", err)
	}
	return &WorkspaceManagerPrescaleDriver{
		Config:     config,
		Client:     api.NewWorkspaceManagerClient(conn),
		conn:       conn,
		Controller: controller,
		time:       realtime,
		stop:       make(chan struct{}),
	}, nil
}

// WorkspaceManagerPrescaleDriver implements a prescale driver using ws-manager's ghost pods
type WorkspaceManagerPrescaleDriver struct {
	Config WorkspaceManagerPrescaleDriverConfig

	Client api.WorkspaceManagerClient
	conn   *grpc.ClientConn

	Controller Controller

	time    timer
	metrics *metrics

	stop chan struct{}
	once sync.Once
}

type workspaceStatus struct {
	Count              WorkspaceCount
	DeletionCandidates []string
}

// RegisterMetrics registers prometheus metrics for this driver
func (wspd *WorkspaceManagerPrescaleDriver) RegisterMetrics(reg prometheus.Registerer) error {
	wspd.metrics = newMetrics()
	return wspd.metrics.Register(reg)
}

// Run runs the prescale driver until Stop() is called
func (wspd *WorkspaceManagerPrescaleDriver) Run() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	statusChan := make(chan workspaceStatus)
	go func() {
		for {
			wasAvailable, err := wspd.maintainWorkspaceStatus(ctx, statusChan)
			if err == context.Canceled {
				return
			}
			if s, ok := status.FromError(err); ok && s.Code() == codes.Unavailable {
				if wasAvailable {
					log.WithError(err).Error("ws-manager is unavailable")
				}
			} else if err != nil {
				log.WithError(err).Error("cannot maintain workspace count")
			}
			// we don't have to wait here until we retry, because the RPC calls
			// in maintainWorkspaceStatus will wait for us.
		}
	}()

	var renewal <-chan time.Time
	if wspd.Config.Renewal.Percentage > 0 && wspd.Config.Renewal.Interval > 0 {
		tc, stop := wspd.time.NewTicker(time.Duration(wspd.Config.Renewal.Interval))
		defer stop()
		renewal = tc

		log.WithField("percentage", wspd.Config.Renewal.Percentage).WithField("interval", wspd.Config.Renewal.Interval.String()).Debug("enabled ghost workspace renewal")
	}
	scheduleGhosts, stopSchedulingGhosts := wspd.time.NewTicker(time.Duration(wspd.Config.SchedulerInterval))
	defer stopSchedulingGhosts()

	var (
		counts         = make(chan WorkspaceCount, 100)
		status         workspaceStatus
		startingGhosts = make(map[string]time.Time)
		setpoint       int
	)

	canStartGhost := func() bool {
		if status.Count.Ghost >= wspd.Config.MaxGhostWorkspaces {
			log.WithField("limit", wspd.Config.MaxGhostWorkspaces).Warn("max number of ghost workspace reached")
			return false
		}
		return true
	}
	registerStartingGhost := func(id string) {
		startingGhosts[id] = wspd.time.Now()
		status.Count.Ghost++
	}

	cchan := wspd.Controller.Control(ctx, counts)
	for {
		select {
		case <-ctx.Done():
			return
		case status = <-statusChan:
			// we've just made contact with the real world and received that actual
			// status from Kubernetes. We use this real-world-view to update our own
			// state, e.g. updating deletion candidates or incorporating starting ghosts
			// which aren't seen by Kubernetes yet.
			for _, id := range status.DeletionCandidates {
				delete(startingGhosts, id)
			}
			status.Count.Ghost += len(startingGhosts)
			counts <- status.Count
			wspd.metrics.OnGhostCountChange(status.Count.Ghost)
			log.WithField("counts", status.Count).Debug("status update")
		case <-renewal:
			if len(status.DeletionCandidates) == 0 {
				// no deletion candidates means there's nothing to renew
				continue
			}
			d := int(float64(len(status.DeletionCandidates)) * float64(wspd.Config.Renewal.Percentage) * 0.01)
			if d == 0 {
				// we have deletion candidates, but the percentage was so low that it wasn't enough for a single
				// candidate to be selected. If we left it at that, we might never renew anything, hence forcing
				// the renewal of at least one candidate.
				d = 1
			}
			if d > len(status.DeletionCandidates) {
				d = len(status.DeletionCandidates)
			}
			// we're only deleting ghosts here, not starting any. In the next scheduling interval, we'll restart
			// the neccesary ghosts.
			err := wspd.stopGhostWorkspaces(ctx, status.DeletionCandidates[:d])
			if err != nil {
				log.WithError(err).Error("cannot stop ghost workspaces during renewal")
				continue
			}
			log.WithField("delta", d).WithField("ghostCount", status.Count.Ghost).Debug("deleted ghost workspaces for renewal")
		case setpoint = <-cchan:
			// we've already set the new setpoint - wait for scheduleGhosts to act on it.
			wspd.metrics.OnSetpointChange(setpoint)
		case <-scheduleGhosts:
			d := setpoint - status.Count.Ghost

			var err error
			if d < 0 {
				d *= -1
				if d > len(status.DeletionCandidates) {
					d = len(status.DeletionCandidates)
				}
				err = wspd.stopGhostWorkspaces(ctx, status.DeletionCandidates[:d])
			} else if d > 0 {
				err = wspd.startGhostWorkspaces(ctx, d, canStartGhost, registerStartingGhost)
			} else {
				continue
			}
			if err != nil {
				log.WithError(err).Error("failed to realise ghost workspace delta")
				continue
			}
			log.WithField("setpoint", setpoint).WithField("delta", d).Debug("(de)scheduled ghost workspaces")
		}
	}
}

func (wspd *WorkspaceManagerPrescaleDriver) startGhostWorkspaces(ctx context.Context, count int, canStartGhost func() bool, registerStartingGhost func(id string)) (err error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	for i := 0; i < count; i++ {
		if !canStartGhost() {
			return nil
		}

		instanceUUID, err := uuid.NewRandom()
		if err != nil {
			return err
		}
		instanceID := instanceUUID.String()
		metaID, err := namegen.GenerateWorkspaceID()
		if err != nil {
			return err
		}

		_, err = wspd.Client.StartWorkspace(ctx, &api.StartWorkspaceRequest{
			Type: api.WorkspaceType_GHOST,
			Id:   instanceID,
			Metadata: &api.WorkspaceMetadata{
				MetaId: metaID,
				Owner:  wspd.Config.GhostOwner,
			},
			ServicePrefix: instanceID,
			Spec: &api.StartWorkspaceSpec{
				Admission:        api.AdmissionLevel_ADMIT_OWNER_ONLY,
				Timeout:          "60m",
				CheckoutLocation: "none",
				FeatureFlags:     wspd.Config.FeatureFlags,
				Git: &api.GitSpec{
					Email:    "none@gitpod.io",
					Username: "gitpod-ghost",
				},
				DeprecatedIdeImage: wspd.Config.IDEImage,
				IdeImage: &api.IDEImage{
					WebRef:        wspd.Config.IDEImage,
					SupervisorRef: wspd.Config.SupervisorImage,
				},
				Initializer: &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Empty{
						Empty: &csapi.EmptyInitializer{},
					},
				},
				WorkspaceLocation: "none",
				WorkspaceImage:    wspd.Config.WorkspaceImage,
			},
		})
		if err != nil {
			return err
		}
		registerStartingGhost(instanceID)
	}

	return nil
}

func (wspd *WorkspaceManagerPrescaleDriver) stopGhostWorkspaces(ctx context.Context, ids []string) (err error) {
	defer func() {
		if err != nil {
			err = xerrors.Errorf("cannot stop ghosts: %w", err)
		}
	}()

	for _, id := range ids {
		_, err := wspd.Client.StopWorkspace(ctx, &api.StopWorkspaceRequest{Id: id, Policy: api.StopWorkspacePolicy_NORMALLY})
		if status.Code(err) == codes.NotFound {
			continue
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func (wspd *WorkspaceManagerPrescaleDriver) maintainWorkspaceStatus(ctx context.Context, counts chan<- workspaceStatus) (wasAvailable bool, err error) {
	type workspaceState struct {
		Started time.Time
		Type    api.WorkspaceType
	}

	wss, err := wspd.Client.GetWorkspaces(ctx, &api.GetWorkspacesRequest{})
	if err != nil {
		return
	}
	wasAvailable = true

	state := make(map[string]workspaceState)
	produceStatus := func() workspaceStatus {
		var res workspaceStatus
		res.DeletionCandidates = make([]string, 0, len(state))
		for id, s := range state {
			switch s.Type {
			case api.WorkspaceType_GHOST:
				res.DeletionCandidates = append(res.DeletionCandidates, id)
				res.Count.Ghost++
			case api.WorkspaceType_REGULAR:
				res.Count.Regular++
			}
		}

		sort.Slice(res.DeletionCandidates, func(i, j int) bool {
			var (
				ti = state[res.DeletionCandidates[i]].Started
				tj = state[res.DeletionCandidates[j]].Started
			)
			return ti.Before(tj)
		})
		return res
	}

	for _, s := range wss.Status {
		var startedAt time.Time
		err := s.Metadata.StartedAt.CheckValid()
		if err != nil {
			log.WithError(err).WithFields(log.OWI(s.Metadata.Owner, s.Metadata.MetaId, s.Id)).Warn("cannot convert startedAt timestamp")
			startedAt = time.Now()
		} else {
			startedAt = s.Metadata.StartedAt.AsTime()
		}

		state[s.Id] = workspaceState{
			Started: startedAt,
			Type:    s.Spec.Type,
		}
	}
	select {
	case <-ctx.Done():
		return wasAvailable, ctx.Err()
	case counts <- produceStatus():
	}

	sub, err := wspd.Client.Subscribe(ctx, &api.SubscribeRequest{})
	if err != nil {
		return wasAvailable, err
	}
	for {
		resp, err := sub.Recv()
		if err != nil {
			return wasAvailable, err
		}
		s := resp.GetStatus()
		if s == nil {
			continue
		}

		_, known := state[s.Id]
		if known && s.Phase == api.WorkspacePhase_STOPPED {
			delete(state, s.Id)
		} else if !known && s.Phase == api.WorkspacePhase_PENDING {
			var startedAt time.Time
			err := s.Metadata.StartedAt.CheckValid()
			if err != nil {
				log.WithError(err).WithFields(log.OWI(s.Metadata.Owner, s.Metadata.MetaId, s.Id)).Warn("cannot convert startedAt timestamp")
				startedAt = time.Now()
			} else {
				startedAt = s.Metadata.StartedAt.AsTime()
			}

			state[s.Id] = workspaceState{
				Started: startedAt,
				Type:    s.Spec.Type,
			}
			state[s.Id] = workspaceState{
				Started: startedAt,
				Type:    s.Spec.Type,
			}
		} else {
			continue
		}

		select {
		case <-ctx.Done():
			return wasAvailable, ctx.Err()
		case counts <- produceStatus():
		}
	}
}

// Stop stops the driver
func (wspd *WorkspaceManagerPrescaleDriver) Stop() {
	wspd.once.Do(func() {
		close(wspd.stop)
		if wspd.conn != nil {
			wspd.conn.Close()
		}
	})
}
