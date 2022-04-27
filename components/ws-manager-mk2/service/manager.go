// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	validation "github.com/go-ozzo/ozzo-validation"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"
	"k8s.io/utils/pointer"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func NewWorkspaceManagerServer(clnt client.Client, cfg *config.Configuration) *WorkspaceManagerServer {
	return &WorkspaceManagerServer{
		Client: clnt,
		Config: cfg,
		subs: subscriptions{
			subscribers: make(map[string]chan *wsmanapi.SubscribeResponse),
		},
	}
}

type WorkspaceManagerServer struct {
	Client client.Client
	Config *config.Configuration

	subs subscriptions
	wsmanapi.UnimplementedWorkspaceManagerServer
}

// OnWorkspaceReconcile is called by the controller whenever it reconciles a workspace.
// This function then publishes to subscribers.
func (wsm *WorkspaceManagerServer) OnWorkspaceReconcile(ctx context.Context, ws *workspacev1.Workspace) {
	wsm.subs.PublishToSubscribers(ctx, &wsmanapi.SubscribeResponse{
		Status: extractWorkspaceStatus(ws),
	})
}

func (wsm *WorkspaceManagerServer) StartWorkspace(ctx context.Context, req *wsmanapi.StartWorkspaceRequest) (resp *wsmanapi.StartWorkspaceResponse, err error) {
	owi := log.OWI(req.Metadata.Owner, req.Metadata.MetaId, req.Id)
	span, ctx := tracing.FromContext(ctx, "StartWorkspace")
	tracing.LogRequestSafe(span, req)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	if err := validateStartWorkspaceRequest(req); err != nil {
		return nil, err
	}

	var workspaceType workspacev1.WorkspaceType
	switch req.Type {
	case wsmanapi.WorkspaceType_IMAGEBUILD:
		workspaceType = workspacev1.WorkspaceTypeImageBuild
	case wsmanapi.WorkspaceType_PREBUILD:
		workspaceType = workspacev1.WorkspaceTypePrebuild
	case wsmanapi.WorkspaceType_REGULAR:
		workspaceType = workspacev1.WorkspaceTypeRegular
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported workspace type: %v", req.Type)
	}

	initializer, err := proto.Marshal(req.Spec.Initializer)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "cannot serialise content initializer: %v", err)
	}

	envvars := make([]corev1.EnvVar, 0, len(req.Spec.Envvars))
	for _, e := range req.Spec.Envvars {
		env := corev1.EnvVar{Name: e.Name, Value: e.Value}
		if len(e.Value) == 0 && e.Secret != nil {
			env.ValueFrom = &corev1.EnvVarSource{
				SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: e.Secret.SecretName},
					Key:                  e.Secret.Key,
				},
			}
		}
		envvars = append(envvars, env)
	}

	var git *workspacev1.GitSpec
	if req.Spec.Git != nil {
		git = &workspacev1.GitSpec{
			Username: req.Spec.Git.Username,
			Email:    req.Spec.Git.Email,
		}
	}

	var timeout *metav1.Duration
	if req.Spec.Timeout != "" {
		d, err := time.ParseDuration(req.Spec.Timeout)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid timeout: %v", err)
		}
		timeout = &metav1.Duration{Duration: d}
	}

	var admissionLevel workspacev1.AdmissionLevel
	switch req.Spec.Admission {
	case wsmanapi.AdmissionLevel_ADMIT_EVERYONE:
		admissionLevel = workspacev1.AdmissionLevelEveryone
	case wsmanapi.AdmissionLevel_ADMIT_OWNER_ONLY:
		admissionLevel = workspacev1.AdmissionLevelOwner
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported admission level: %v", req.Spec.Admission)
	}

	ws := workspacev1.Workspace{
		TypeMeta: metav1.TypeMeta{
			APIVersion: workspacev1.GroupVersion.String(),
			Kind:       "Workspace",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:        req.Id,
			Annotations: req.Metadata.Annotations,
			Namespace:   wsm.Config.Namespace,
			Labels: map[string]string{
				wsk8s.WorkspaceIDLabel: req.Metadata.MetaId,
				wsk8s.OwnerLabel:       req.Metadata.Owner,
			},
		},
		Spec: workspacev1.WorkspaceSpec{
			Ownership: workspacev1.Ownership{
				Owner:       req.Metadata.Owner,
				WorkspaceID: req.Metadata.MetaId,
			},
			Type: workspaceType,
			Image: workspacev1.WorkspaceImages{
				Workspace: workspacev1.WorkspaceImage{
					Ref: pointer.String(req.Spec.WorkspaceImage),
				},
				IDE: workspacev1.IDEImages{
					Web:        req.Spec.IdeImage.WebRef,
					Desktop:    req.Spec.IdeImage.DesktopRef,
					Supervisor: req.Spec.IdeImage.SupervisorRef,
				},
			},
			Initializer:       initializer,
			Envvars:           envvars,
			WorkspaceLocation: req.Spec.WorkspaceLocation,
			Git:               git,
			Timeout: workspacev1.TimeoutSpec{
				Time: timeout,
			},
			Admission: workspacev1.AdmissionSpec{
				Level: admissionLevel,
			},
		},
	}
	err = wsm.Client.Create(ctx, &ws)
	if err != nil {
		log.WithError(err).WithFields(owi).Error("error creating workspace")
		return nil, status.Errorf(codes.FailedPrecondition, "cannot create workspace")
	}

	var wsr workspacev1.Workspace
	err = wait.PollWithContext(ctx, 100*time.Millisecond, 5*time.Second, func(c context.Context) (done bool, err error) {
		err = wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: ws.Name}, &wsr)
		if err != nil {
			return false, nil
		}

		if wsr.Status.OwnerToken != "" && wsr.Status.URL != "" {
			return true, nil
		}

		return false, nil
	})
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot wait for workspace URL")
	}

	return &wsmanapi.StartWorkspaceResponse{
		Url:        wsr.Status.URL,
		OwnerToken: wsr.Status.OwnerToken,
	}, nil
}

func (wsm *WorkspaceManagerServer) GetWorkspaces(ctx context.Context, req *wsmanapi.GetWorkspacesRequest) (*wsmanapi.GetWorkspacesResponse, error) {
	labelSelector, err := metadataFilterToLabelSelector(req.MustMatch)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot convert metadata filter: %v", err)
	}

	var workspaces workspacev1.WorkspaceList
	err = wsm.Client.List(ctx, &workspaces, &client.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "cannot list workspaces: %v", err)
	}

	res := make([]*wsmanapi.WorkspaceStatus, 0, len(workspaces.Items))
	for _, ws := range workspaces.Items {
		if !matchesMetadataAnnotations(&ws, req.MustMatch) {
			continue
		}

		res = append(res, extractWorkspaceStatus(&ws))
	}

	return &wsmanapi.GetWorkspacesResponse{Status: res}, nil
}

func (wsm *WorkspaceManagerServer) DescribeWorkspace(ctx context.Context, req *wsmanapi.DescribeWorkspaceRequest) (*wsmanapi.DescribeWorkspaceResponse, error) {
	var ws workspacev1.Workspace
	err := wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: req.Id}, &ws)
	if errors.IsNotFound(err) {
		return nil, status.Errorf(codes.NotFound, "workspace %s not found", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot lookup workspace: %v", err)
	}

	return &wsmanapi.DescribeWorkspaceResponse{
		Status: extractWorkspaceStatus(&ws),
		// TODO(cw): Add lastActivity
	}, nil
}

// Subscribe streams all status updates to a client
func (m *WorkspaceManagerServer) Subscribe(req *api.SubscribeRequest, srv api.WorkspaceManager_SubscribeServer) (err error) {
	var sub subscriber = srv
	if req.MustMatch != nil {
		sub = &filteringSubscriber{srv, req.MustMatch}
	}

	return m.subs.Subscribe(srv.Context(), sub)
}

func (wsm *WorkspaceManagerServer) MarkActive(ctx context.Context, req *wsmanapi.MarkActiveRequest) (*wsmanapi.MarkActiveResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method MarkActive not implemented")
}

func (wsm *WorkspaceManagerServer) SetTimeout(ctx context.Context, req *wsmanapi.SetTimeoutRequest) (*wsmanapi.SetTimeoutResponse, error) {
	duration, err := time.ParseDuration(req.Duration)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid duration: %v", err)
	}

	err = wsm.modifyWorkspace(ctx, req.Id, func(ws *workspacev1.Workspace) error {
		ws.Spec.Timeout.Time = &metav1.Duration{Duration: duration}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &wsmanapi.SetTimeoutResponse{}, nil
}

func (wsm *WorkspaceManagerServer) ControlPort(ctx context.Context, req *wsmanapi.ControlPortRequest) (*wsmanapi.ControlPortResponse, error) {
	if req.Spec == nil {
		return nil, status.Errorf(codes.InvalidArgument, "missing spec")
	}

	port := req.Spec.Port
	err := wsm.modifyWorkspace(ctx, req.Id, func(ws *workspacev1.Workspace) error {
		n := 0
		for _, x := range ws.Spec.Ports {
			if x.Port != port {
				ws.Spec.Ports[n] = x
				n++
			}
		}
		ws.Spec.Ports = ws.Spec.Ports[:n]

		if req.Expose {
			visibility := workspacev1.AdmissionLevelOwner
			if req.Spec.Visibility == api.PortVisibility_PORT_VISIBILITY_PUBLIC {
				visibility = workspacev1.AdmissionLevelEveryone
			}
			ws.Spec.Ports = append(ws.Spec.Ports, workspacev1.PortSpec{
				Port:       port,
				Visibility: visibility,
			})
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return &wsmanapi.ControlPortResponse{}, nil
}

func (wsm *WorkspaceManagerServer) TakeSnapshot(ctx context.Context, req *wsmanapi.TakeSnapshotRequest) (*wsmanapi.TakeSnapshotResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method TakeSnapshot not implemented")
}

func (wsm *WorkspaceManagerServer) ControlAdmission(ctx context.Context, req *wsmanapi.ControlAdmissionRequest) (*wsmanapi.ControlAdmissionResponse, error) {
	err := wsm.modifyWorkspace(ctx, req.Id, func(ws *workspacev1.Workspace) error {
		switch req.Level {
		case wsmanapi.AdmissionLevel_ADMIT_EVERYONE:
			ws.Spec.Admission.Level = workspacev1.AdmissionLevelEveryone
		case wsmanapi.AdmissionLevel_ADMIT_OWNER_ONLY:
			ws.Spec.Admission.Level = workspacev1.AdmissionLevelOwner
		default:
			return status.Errorf(codes.InvalidArgument, "unsupported admission level: %v", req.Level)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &wsmanapi.ControlAdmissionResponse{}, nil
}

// modifyWorkspace modifies a workspace object using the mod function. If the mod function returns a gRPC status error, that error
// is returned directly. If mod returns a non-gRPC error it is turned into one.
func (wsm *WorkspaceManagerServer) modifyWorkspace(ctx context.Context, id string, mod func(ws *workspacev1.Workspace) error) error {
	err := retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		var ws workspacev1.Workspace
		err := wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: id}, &ws)
		if err != nil {
			return err
		}

		err = mod(&ws)
		if err != nil {
			return err
		}

		return wsm.Client.Update(ctx, &ws)
	})
	if errors.IsNotFound(err) {
		return status.Errorf(codes.NotFound, "workspace %s not found", id)
	}
	if c := status.Code(err); c != codes.Unknown && c != codes.OK {
		return err
	}
	if err != nil {
		return status.Errorf(codes.Internal, "cannot modify workspace: %v", err)
	}
	return nil
}

// validateStartWorkspaceRequest ensures that acting on this request will not leave the system in an invalid state
func validateStartWorkspaceRequest(req *api.StartWorkspaceRequest) error {
	err := validation.ValidateStruct(req.Spec,
		validation.Field(&req.Spec.WorkspaceImage, validation.Required),
		validation.Field(&req.Spec.WorkspaceLocation, validation.Required),
		validation.Field(&req.Spec.Ports, validation.By(areValidPorts)),
		validation.Field(&req.Spec.Initializer, validation.Required),
		validation.Field(&req.Spec.FeatureFlags, validation.By(areValidFeatureFlags)),
	)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid request: %v", err)
	}

	rules := make([]*validation.FieldRules, 0)
	rules = append(rules, validation.Field(&req.Id, validation.Required))
	rules = append(rules, validation.Field(&req.Spec, validation.Required))
	rules = append(rules, validation.Field(&req.Type, validation.By(isValidWorkspaceType)))
	if req.Type == api.WorkspaceType_REGULAR {
		rules = append(rules, validation.Field(&req.ServicePrefix, validation.Required))
	}
	err = validation.ValidateStruct(req, rules...)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid request: %v", err)
	}

	return nil
}

func isValidWorkspaceType(value interface{}) error {
	s, ok := value.(api.WorkspaceType)
	if !ok {
		return xerrors.Errorf("value is not a workspace type")
	}

	_, ok = api.WorkspaceType_name[int32(s)]
	if !ok {
		return xerrors.Errorf("value %d is out of range", s)
	}

	return nil
}

func areValidPorts(value interface{}) error {
	s, ok := value.([]*api.PortSpec)
	if !ok {
		return xerrors.Errorf("value is not a port spec list")
	}

	idx := make(map[uint32]struct{})
	for _, p := range s {
		if _, exists := idx[p.Port]; exists {
			return xerrors.Errorf("port %d is not unique", p.Port)
		}
		idx[p.Port] = struct{}{}

		// TODO [cw]: probably the target should be unique as well.
		//            I don't want to introduce new issues with too
		//            tight validation though.
	}

	return nil
}

func areValidFeatureFlags(value interface{}) error {
	s, ok := value.([]api.WorkspaceFeatureFlag)
	if !ok {
		return xerrors.Errorf("value not a feature flag list")
	}

	idx := make(map[api.WorkspaceFeatureFlag]struct{}, len(s))
	for _, k := range s {
		idx[k] = struct{}{}
	}

	return nil
}

func extractWorkspaceStatus(ws *workspacev1.Workspace) *wsmanapi.WorkspaceStatus {
	version, _ := strconv.ParseUint(ws.ResourceVersion, 10, 64)

	var tpe wsmanapi.WorkspaceType
	switch ws.Spec.Type {
	case workspacev1.WorkspaceTypeImageBuild:
		tpe = wsmanapi.WorkspaceType_IMAGEBUILD
	case workspacev1.WorkspaceTypePrebuild:
		tpe = wsmanapi.WorkspaceType_PREBUILD
	case workspacev1.WorkspaceTypeRegular:
		tpe = wsmanapi.WorkspaceType_REGULAR
	}

	var timeout string
	if ws.Spec.Timeout.Time != nil {
		timeout = ws.Spec.Timeout.Time.String()
	}

	var phase wsmanapi.WorkspacePhase
	switch ws.Status.Phase {
	case workspacev1.WorkspacePhasePending:
		phase = wsmanapi.WorkspacePhase_PENDING
	case workspacev1.WorkspacePhaseImageBuild:
		// TODO(cw): once we have an imagebuild phase on the protocol, map this properly
		phase = wsmanapi.WorkspacePhase_PENDING
	case workspacev1.WorkspacePhaseCreating:
		phase = wsmanapi.WorkspacePhase_CREATING
	case workspacev1.WorkspacePhaseInitializing:
		phase = wsmanapi.WorkspacePhase_INITIALIZING
	case workspacev1.WorkspacePhaseRunning:
		phase = wsmanapi.WorkspacePhase_RUNNING
	case workspacev1.WorkspacePhaseStopping:
		phase = wsmanapi.WorkspacePhase_STOPPING
	case workspacev1.WorkspacePhaseStopped:
		phase = wsmanapi.WorkspacePhase_STOPPED
	case workspacev1.WorkspacePhaseUnknown:
		phase = wsmanapi.WorkspacePhase_UNKNOWN
	}

	var snapshot string
	if ws.Status.Results != nil {
		snapshot = ws.Status.Results.Snapshot
	}

	var deployed wsmanapi.WorkspaceConditionBool
	if ws.Status.Conditions.Deployed {
		deployed = api.WorkspaceConditionBool_TRUE
	} else {
		deployed = api.WorkspaceConditionBool_FALSE
	}

	var firstUserActivity *timestamppb.Timestamp
	if ws.Status.Conditions.FirstUserActivity != nil {
		firstUserActivity = timestamppb.New(ws.Status.Conditions.FirstUserActivity.Time)
	}

	var stoppedByRequest wsmanapi.WorkspaceConditionBool
	if ws.Status.Conditions.StoppedByRequest == nil {
		stoppedByRequest = wsmanapi.WorkspaceConditionBool_EMPTY
	} else if *ws.Status.Conditions.StoppedByRequest {
		stoppedByRequest = wsmanapi.WorkspaceConditionBool_TRUE
	} else {
		stoppedByRequest = wsmanapi.WorkspaceConditionBool_FALSE
	}

	var runtime *wsmanapi.WorkspaceRuntimeInfo
	if rt := ws.Status.Runtime; rt != nil {
		runtime = &wsmanapi.WorkspaceRuntimeInfo{
			NodeName: rt.NodeName,
			NodeIp:   rt.HostIP,
			PodName:  rt.PodName,
		}
	}

	var admissionLevel wsmanapi.AdmissionLevel
	switch ws.Spec.Admission.Level {
	case workspacev1.AdmissionLevelEveryone:
		admissionLevel = wsmanapi.AdmissionLevel_ADMIT_EVERYONE
	case workspacev1.AdmissionLevelOwner:
		admissionLevel = wsmanapi.AdmissionLevel_ADMIT_OWNER_ONLY
	}

	res := &wsmanapi.WorkspaceStatus{
		Id:            ws.Name,
		StatusVersion: version,
		Metadata: &wsmanapi.WorkspaceMetadata{
			Owner:       ws.Spec.Ownership.Owner,
			MetaId:      ws.Spec.Ownership.WorkspaceID,
			StartedAt:   timestamppb.New(ws.CreationTimestamp.Time),
			Annotations: ws.Annotations,
		},
		Spec: &wsmanapi.WorkspaceSpec{
			WorkspaceImage: pointer.StringDeref(ws.Spec.Image.Workspace.Ref, ""),
			IdeImage: &wsmanapi.IDEImage{
				WebRef:        ws.Spec.Image.IDE.Web,
				DesktopRef:    ws.Spec.Image.IDE.Desktop,
				SupervisorRef: ws.Spec.Image.IDE.Supervisor,
			},
			Headless: ws.Status.Headless,
			Url:      ws.Status.URL,
			Type:     tpe,
			Timeout:  timeout,
		},
		Phase: phase,
		Conditions: &wsmanapi.WorkspaceConditions{
			Failed:             ws.Status.Conditions.Failed,
			Timeout:            ws.Status.Conditions.Timeout,
			Snapshot:           snapshot,
			Deployed:           deployed,
			FirstUserActivity:  firstUserActivity,
			HeadlessTaskFailed: ws.Status.Conditions.HeadlessTaskFailed,
			StoppedByRequest:   stoppedByRequest,
		},
		Runtime: runtime,
		Auth: &wsmanapi.WorkspaceAuthentication{
			Admission:  admissionLevel,
			OwnerToken: ws.Status.OwnerToken,
		},
	}
	return res
}

func matchesMetadataAnnotations(ws *workspacev1.Workspace, filter *wsmanapi.MetadataFilter) bool {
	if filter == nil {
		return true
	}
	for k, v := range filter.Annotations {
		av, ok := ws.Annotations[k]
		if !ok || av != v {
			return false
		}
	}
	return true
}

func metadataFilterToLabelSelector(filter *wsmanapi.MetadataFilter) (labels.Selector, error) {
	if filter == nil {
		return nil, nil
	}

	res := labels.NewSelector()
	if filter.MetaId != "" {
		req, err := labels.NewRequirement(wsk8s.WorkspaceIDLabel, selection.Equals, []string{filter.MetaId})
		if err != nil {
			return nil, xerrors.Errorf("cannot create metaID filter: %w", err)
		}
		res.Add(*req)
	}
	if filter.Owner != "" {
		req, err := labels.NewRequirement(wsk8s.OwnerLabel, selection.Equals, []string{filter.Owner})
		if err != nil {
			return nil, xerrors.Errorf("cannot create owner filter: %w", err)
		}
		res.Add(*req)
	}
	return res, nil
}

type filteringSubscriber struct {
	Sub    subscriber
	Filter *api.MetadataFilter
}

func matchesMetadataFilter(filter *api.MetadataFilter, md *api.WorkspaceMetadata) bool {
	if filter == nil {
		return true
	}

	if filter.MetaId != "" && filter.MetaId != md.MetaId {
		return false
	}
	if filter.Owner != "" && filter.Owner != md.Owner {
		return false
	}
	for k, v := range filter.Annotations {
		av, ok := md.Annotations[k]
		if !ok || av != v {
			return false
		}
	}
	return true
}

func (f *filteringSubscriber) Send(resp *api.SubscribeResponse) error {
	var md *api.WorkspaceMetadata
	if sts := resp.GetStatus(); sts != nil {
		md = sts.Metadata
	}
	if md == nil {
		// no metadata, no forwarding
		return nil
	}
	if !matchesMetadataFilter(f.Filter, md) {
		return nil
	}

	return f.Sub.Send(resp)
}

type subscriber interface {
	Send(*api.SubscribeResponse) error
}

type subscriptions struct {
	mu          sync.RWMutex
	subscribers map[string]chan *wsmanapi.SubscribeResponse
}

func (subs *subscriptions) Subscribe(ctx context.Context, recv subscriber) (err error) {
	incoming := make(chan *api.SubscribeResponse, 250)

	var key string
	peer, ok := peer.FromContext(ctx)
	if ok {
		key = fmt.Sprintf("k%s@%d", peer.Addr.String(), time.Now().UnixNano())
	}

	subs.mu.Lock()
	if key == "" {
		// if for some reason we didn't get peer information,
		// we must generate they key within the lock, otherwise we might end up with duplicate keys
		key = fmt.Sprintf("k%d@%d", len(subs.subscribers), time.Now().UnixNano())
	}
	subs.subscribers[key] = incoming
	log.WithField("subscriberKey", key).WithField("subscriberCount", len(subs.subscribers)).Info("new subscriber")
	subs.mu.Unlock()

	defer func() {
		subs.mu.Lock()
		delete(subs.subscribers, key)
		subs.mu.Unlock()
	}()

	for {
		var inc *api.SubscribeResponse
		select {
		case <-ctx.Done():
			return ctx.Err()
		case inc = <-incoming:
		}

		if inc == nil {
			log.WithField("subscriberKey", key).Warn("subscription was canceled")
			return xerrors.Errorf("subscription was canceled")
		}

		err = recv.Send(inc)
		if err != nil {
			log.WithField("subscriberKey", key).WithError(err).Error("cannot send update - dropping subscriber")
			return err
		}
	}
}

func (subs *subscriptions) PublishToSubscribers(ctx context.Context, update *api.SubscribeResponse) {
	subs.mu.RLock()
	var dropouts []string
	for k, sub := range subs.subscribers {
		select {
		case sub <- update:
			// all is well
		default:
			// writing to subscriber cannel blocked, which means the subscriber isn't consuming fast enough and
			// would block others. We'll drop this consumer later (do not drop here to avoid concurrency issues).
			dropouts = append(dropouts, k)
		}
	}
	// we cannot defer this call as dropSubscriber will attempt to acquire a write lock
	subs.mu.RUnlock()

	// we check if there are any dropouts here to avoid the non-inlinable dropSubscriber call.
	if len(dropouts) > 0 {
		subs.DropSubscriber(dropouts)
	}
}

func (subs *subscriptions) DropSubscriber(dropouts []string) {
	defer func() {
		err := recover()
		if err != nil {
			log.WithField("error", err).Error("caught panic in dropSubscriber")
		}
	}()

	subs.mu.Lock()
	defer subs.mu.Unlock()

	for _, k := range dropouts {
		sub, ok := subs.subscribers[k]
		if !ok {
			continue
		}

		log.WithField("subscriber", k).WithField("subscriberCount", len(subs.subscribers)).Warn("subscriber channel was full - dropping subscriber")
		// despite closing the subscriber channel, the subscriber's serve Go routine will still try to send
		// all prior updates up to this point. See https://play.golang.org/p/XR-9nLrQLQs
		close(sub)
		delete(subs.subscribers, k)
	}
}

// onChange is the default OnChange implementation which publishes workspace status updates to subscribers
func (subs *subscriptions) OnChange(ctx context.Context, status *api.WorkspaceStatus) {
	log := log.WithFields(log.OWI(status.Metadata.Owner, status.Metadata.MetaId, status.Id))

	header := make(map[string]string)
	span := opentracing.SpanFromContext(ctx)
	if span != nil {
		tracingHeader := make(opentracing.HTTPHeadersCarrier)
		err := opentracing.GlobalTracer().Inject(span.Context(), opentracing.HTTPHeaders, tracingHeader)
		if err != nil {
			// if the error was caused by the span coming from the Noop tracer - ignore it.
			// This can happen if the workspace doesn't have a span associated with it, then we resort to creating Noop spans.
			if _, isNoopTracer := span.Tracer().(opentracing.NoopTracer); !isNoopTracer {
				log.WithError(err).Debug("unable to extract tracing information - trace will be broken")
			}
		} else {
			for k, v := range tracingHeader {
				if len(v) != 1 {
					continue
				}
				header[k] = v[0]
			}
		}
	}

	subs.PublishToSubscribers(ctx, &api.SubscribeResponse{
		Status: status,
		Header: header,
	})

	// subs.metrics.OnChange(status)

	// There are some conditions we'd like to get notified about, for example while running experiements or because
	// they represent out-of-the-ordinary situations.
	// We attempt to use the GCP Error Reporting for this, hence log these situations as errors.
	if status.Conditions.Failed != "" {
		log.WithField("status", status).Error("workspace failed")
	}
	if status.Phase == 0 {
		log.WithField("status", status).Error("workspace in UNKNOWN phase")
	}
}
