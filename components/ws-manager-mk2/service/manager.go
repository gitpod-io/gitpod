// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	validation "github.com/go-ozzo/ozzo-validation"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/activity"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/maintenance"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/sirupsen/logrus"
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
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
)

const (
	// stopWorkspaceNormallyGracePeriod is the grace period we use when stopping a pod with StopWorkspaceNormally policy
	stopWorkspaceNormallyGracePeriod = 30 * time.Second
	// stopWorkspaceImmediatelyGracePeriod is the grace period we use when stopping a pod as soon as possbile
	stopWorkspaceImmediatelyGracePeriod = 1 * time.Second
)

func NewWorkspaceManagerServer(clnt client.Client, cfg *config.Configuration, reg prometheus.Registerer, activity *activity.WorkspaceActivity, maintenance maintenance.Maintenance) *WorkspaceManagerServer {
	metrics := newWorkspaceMetrics()
	reg.MustRegister(metrics)

	return &WorkspaceManagerServer{
		Client:      clnt,
		Config:      cfg,
		metrics:     metrics,
		activity:    activity,
		maintenance: maintenance,
		subs: subscriptions{
			subscribers: make(map[string]chan *wsmanapi.SubscribeResponse),
		},
	}
}

type WorkspaceManagerServer struct {
	Client      client.Client
	Config      *config.Configuration
	metrics     *workspaceMetrics
	activity    *activity.WorkspaceActivity
	maintenance maintenance.Maintenance

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

	if wsm.maintenance.IsEnabled() {
		return &wsmanapi.StartWorkspaceResponse{}, status.Error(codes.FailedPrecondition, "under maintenance")
	}

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

	ports := make([]workspacev1.PortSpec, 0, len(req.Spec.Ports))
	for _, p := range req.Spec.Ports {
		v := workspacev1.AdmissionLevelOwner
		if p.Visibility == wsmanapi.PortVisibility_PORT_VISIBILITY_PUBLIC {
			v = workspacev1.AdmissionLevelEveryone
		}
		ports = append(ports, workspacev1.PortSpec{
			Port:       p.Port,
			Visibility: v,
		})
	}

	var classID string
	_, ok := wsm.Config.WorkspaceClasses[req.Spec.Class]
	if !ok {
		classID = config.DefaultWorkspaceClass
	} else {
		classID = req.Spec.Class
	}

	class, ok := wsm.Config.WorkspaceClasses[classID]
	if !ok {
		return nil, status.Errorf(codes.InvalidArgument, "workspace class \"%s\" is unknown", req.Spec.Class)
	}

	annotations := make(map[string]string)
	for k, v := range req.Metadata.Annotations {
		annotations[k] = v
	}

	for _, feature := range req.Spec.FeatureFlags {
		switch feature {
		case wsmanapi.WorkspaceFeatureFlag_WORKSPACE_CLASS_LIMITING:
			limits := class.Container.Limits
			if limits != nil && limits.CPU != nil {
				if limits.CPU.MinLimit != "" {
					annotations[wsk8s.WorkspaceCpuMinLimitAnnotation] = limits.CPU.MinLimit
				}

				if limits.CPU.BurstLimit != "" {
					annotations[wsk8s.WorkspaceCpuBurstLimitAnnotation] = limits.CPU.BurstLimit
				}
			}

		case wsmanapi.WorkspaceFeatureFlag_WORKSPACE_CONNECTION_LIMITING:
			annotations[wsk8s.WorkspaceNetConnLimitAnnotation] = util.BooleanTrueString

		case wsmanapi.WorkspaceFeatureFlag_WORKSPACE_PSI:
			annotations[wsk8s.WorkspacePressureStallInfoAnnotation] = util.BooleanTrueString
		}
	}

	envSecretName := fmt.Sprintf("%s-%s", req.Id, "env")
	userEnvVars, envData := extractWorkspaceUserEnv(envSecretName, req.Spec.Envvars, req.Spec.SysEnvvars)
	sysEnvVars := extractWorkspaceSysEnv(req.Spec.SysEnvvars)

	tokenData := extractWorkspaceTokenData(req.Spec)
	initializer, err := proto.Marshal(req.Spec.Initializer)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "cannot serialise content initializer: %v", err)
	}

	ws := workspacev1.Workspace{
		TypeMeta: metav1.TypeMeta{
			APIVersion: workspacev1.GroupVersion.String(),
			Kind:       "Workspace",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:        req.Id,
			Annotations: annotations,
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
			Type:  workspaceType,
			Class: classID,
			Image: workspacev1.WorkspaceImages{
				Workspace: workspacev1.WorkspaceImage{
					Ref: pointer.String(req.Spec.WorkspaceImage),
				},
				IDE: workspacev1.IDEImages{
					Web:        req.Spec.IdeImage.WebRef,
					Refs:       req.Spec.IdeImageLayers,
					Supervisor: req.Spec.IdeImage.SupervisorRef,
				},
			},
			Initializer:       initializer,
			UserEnvVars:       userEnvVars,
			SysEnvVars:        sysEnvVars,
			WorkspaceLocation: req.Spec.WorkspaceLocation,
			Git:               git,
			Timeout: workspacev1.TimeoutSpec{
				Time: timeout,
			},
			Admission: workspacev1.AdmissionSpec{
				Level: admissionLevel,
			},
			Ports:         ports,
			SshPublicKeys: req.Spec.SshPublicKeys,
		},
	}
	controllerutil.AddFinalizer(&ws, workspacev1.GitpodFinalizerName)

	err = wsm.createWorkspaceSecret(ctx, &ws, envSecretName, wsm.Config.Namespace, envData)
	if err != nil {
		return nil, fmt.Errorf("cannot create env secret for workspace %s: %w", req.Id, err)
	}

	err = wsm.createWorkspaceSecret(ctx, &ws, fmt.Sprintf("%s-%s", req.Id, "tokens"), wsm.Config.SecretsNamespace, tokenData)
	if err != nil {
		return nil, fmt.Errorf("cannot create token secret for workspace %s: %w", req.Id, err)
	}

	wsm.metrics.recordWorkspaceStart(&ws)
	err = wsm.Client.Create(ctx, &ws)
	if err != nil {
		log.WithError(err).WithFields(owi).Error("error creating workspace")
		return nil, status.Errorf(codes.FailedPrecondition, "cannot create workspace")
	}

	var wsr workspacev1.Workspace
	err = wait.PollWithContext(ctx, 100*time.Millisecond, 30*time.Second, func(c context.Context) (done bool, err error) {
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
		return nil, status.Errorf(codes.FailedPrecondition, "cannot wait for workspace URL: %q", err)
	}

	return &wsmanapi.StartWorkspaceResponse{
		Url:        wsr.Status.URL,
		OwnerToken: wsr.Status.OwnerToken,
	}, nil
}

func isProtectedEnvVar(name string, sysEnvvars []*wsmanapi.EnvironmentVariable) bool {
	switch name {
	case "THEIA_SUPERVISOR_TOKENS":
		return true
	default:
		if isGitpodInternalEnvVar(name) {
			return false
		}
		for _, env := range sysEnvvars {
			if env.Name == name {
				return false
			}
		}
		return true
	}
}

func isGitpodInternalEnvVar(name string) bool {
	return strings.HasPrefix(name, "GITPOD_") ||
		strings.HasPrefix(name, "SUPERVISOR_") ||
		strings.HasPrefix(name, "BOB_") ||
		strings.HasPrefix(name, "THEIA_") ||
		name == "NODE_EXTRA_CA_CERTS" ||
		name == "VSX_REGISTRY_URL"
}

func (wsm *WorkspaceManagerServer) createWorkspaceSecret(ctx context.Context, owner client.Object, name, namespace string, data map[string]string) error {
	secret := corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		StringData: data,
	}

	err := wsm.Client.Create(ctx, &secret)
	if err != nil && !errors.IsAlreadyExists(err) {
		return err
	}

	return nil
}

func (wsm *WorkspaceManagerServer) StopWorkspace(ctx context.Context, req *wsmanapi.StopWorkspaceRequest) (res *wsmanapi.StopWorkspaceResponse, err error) {
	owi := log.OWI("", "", req.Id)
	span, ctx := tracing.FromContext(ctx, "StopWorkspace")
	tracing.LogRequestSafe(span, req)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	if wsm.maintenance.IsEnabled() {
		return &wsmanapi.StopWorkspaceResponse{}, status.Error(codes.FailedPrecondition, "under maintenance")
	}

	gracePeriod := stopWorkspaceNormallyGracePeriod
	if req.Policy == wsmanapi.StopWorkspacePolicy_IMMEDIATELY {
		span.LogKV("policy", "immediately")
		gracePeriod = stopWorkspaceImmediatelyGracePeriod
	} else if req.Policy == wsmanapi.StopWorkspacePolicy_ABORT {
		span.LogKV("policy", "abort")
		gracePeriod = stopWorkspaceImmediatelyGracePeriod
		if err = wsm.modifyWorkspace(ctx, req.Id, true, func(ws *workspacev1.Workspace) error {
			ws.Status.SetCondition(workspacev1.NewWorkspaceConditionAborted("StopWorkspaceRequest"))
			return nil
		}); err != nil {
			log.Error(err, "failed to add Aborted condition to workspace")
		}
	}
	err = wsm.modifyWorkspace(ctx, req.Id, true, func(ws *workspacev1.Workspace) error {
		ws.Status.SetCondition(workspacev1.NewWorkspaceConditionStoppedByRequest(gracePeriod.String()))
		return nil
	})
	// Ignore NotFound errors, workspace has already been stopped.
	if err != nil && status.Code(err) != codes.NotFound {
		return nil, err
	}
	return &wsmanapi.StopWorkspaceResponse{}, nil
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

	result := &wsmanapi.DescribeWorkspaceResponse{
		Status: extractWorkspaceStatus(&ws),
	}

	lastActivity := wsm.activity.GetLastActivity(req.Id)
	if lastActivity != nil {
		result.LastActivity = lastActivity.UTC().Format(time.RFC3339Nano)
	}
	return result, nil
}

// Subscribe streams all status updates to a client
func (m *WorkspaceManagerServer) Subscribe(req *wsmanapi.SubscribeRequest, srv wsmanapi.WorkspaceManager_SubscribeServer) (err error) {
	var sub subscriber = srv
	if req.MustMatch != nil {
		sub = &filteringSubscriber{srv, req.MustMatch}
	}

	return m.subs.Subscribe(srv.Context(), sub)
}

// MarkActive records a workspace as being active which prevents it from timing out
func (wsm *WorkspaceManagerServer) MarkActive(ctx context.Context, req *wsmanapi.MarkActiveRequest) (res *wsmanapi.MarkActiveResponse, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "MarkActive")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	workspaceID := req.Id

	var ws workspacev1.Workspace
	err = wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: req.Id}, &ws)
	if errors.IsNotFound(err) {
		return nil, status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot mark workspace: %v", err)
	}

	var firstUserActivity *timestamppb.Timestamp
	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionFirstUserActivity)); c != nil {
		firstUserActivity = timestamppb.New(c.LastTransitionTime.Time)
	}

	// if user already mark workspace as active and this request has IgnoreIfActive flag, just simple ignore it
	if firstUserActivity != nil && req.IgnoreIfActive {
		return &wsmanapi.MarkActiveResponse{}, nil
	}

	// We do not keep the last activity in the workspace resource to limit the load we're placing
	// on the K8S master in check. Thus, this state lives locally in a map.
	now := time.Now().UTC()
	wsm.activity.Store(req.Id, now)

	// We do however maintain the the "closed" flag as condition on the workspace. This flag should not change
	// very often and provides a better UX if it persists across ws-manager restarts.
	isMarkedClosed := wsk8s.ConditionPresentAndTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionClosed))
	if req.Closed && !isMarkedClosed {
		err = wsm.modifyWorkspace(ctx, req.Id, true, func(ws *workspacev1.Workspace) error {
			ws.Status.SetCondition(workspacev1.NewWorkspaceConditionClosed(metav1.ConditionTrue, "MarkActiveRequest"))
			return nil
		})
	} else if !req.Closed && isMarkedClosed {
		err = wsm.modifyWorkspace(ctx, req.Id, true, func(ws *workspacev1.Workspace) error {
			ws.Status.SetCondition(workspacev1.NewWorkspaceConditionClosed(metav1.ConditionFalse, "MarkActiveRequest"))
			return nil
		})
	}
	if err != nil {
		logFields := logrus.Fields{
			"closed":         req.Closed,
			"isMarkedClosed": isMarkedClosed,
		}
		log.WithError(err).WithFields(log.OWI("", "", workspaceID)).WithFields(logFields).Warn("was unable to mark workspace properly")
	}

	// If it's the first call: Mark the pod with FirstUserActivity condition.
	if firstUserActivity == nil {
		err := wsm.modifyWorkspace(ctx, req.Id, true, func(ws *workspacev1.Workspace) error {
			ws.Status.SetCondition(workspacev1.NewWorkspaceConditionFirstUserActivity("MarkActiveRequest"))
			return nil
		})
		if err != nil {
			log.WithError(err).WithFields(log.OWI("", "", workspaceID)).Warn("was unable to set FirstUserActivity condition on workspace")
			return nil, err
		}
	}

	return &wsmanapi.MarkActiveResponse{}, nil
}

func (wsm *WorkspaceManagerServer) SetTimeout(ctx context.Context, req *wsmanapi.SetTimeoutRequest) (*wsmanapi.SetTimeoutResponse, error) {
	duration, err := time.ParseDuration(req.Duration)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid duration: %v", err)
	}

	err = wsm.modifyWorkspace(ctx, req.Id, false, func(ws *workspacev1.Workspace) error {
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
	err := wsm.modifyWorkspace(ctx, req.Id, false, func(ws *workspacev1.Workspace) error {
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
			if req.Spec.Visibility == wsmanapi.PortVisibility_PORT_VISIBILITY_PUBLIC {
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

func (wsm *WorkspaceManagerServer) TakeSnapshot(ctx context.Context, req *wsmanapi.TakeSnapshotRequest) (res *wsmanapi.TakeSnapshotResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "TakeSnapshot")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	if wsm.maintenance.IsEnabled() {
		return &wsmanapi.TakeSnapshotResponse{}, status.Error(codes.FailedPrecondition, "under maintenance")
	}

	var ws workspacev1.Workspace
	err = wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: req.Id}, &ws)
	if errors.IsNotFound(err) {
		return nil, status.Errorf(codes.NotFound, "workspace %s not found", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot lookup workspace: %v", err)
	}

	if ws.Status.Phase != workspacev1.WorkspacePhaseRunning {
		return nil, status.Errorf(codes.FailedPrecondition, "snapshots can only be taken of running workspaces, not %s workspaces", ws.Status.Phase)
	}

	snapshot := workspacev1.Snapshot{
		TypeMeta: metav1.TypeMeta{
			APIVersion: workspacev1.GroupVersion.String(),
			Kind:       "Snapshot",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-%d", req.Id, time.Now().UnixNano()),
			Namespace: wsm.Config.Namespace,
		},
		Spec: workspacev1.SnapshotSpec{
			NodeName:    ws.Status.Runtime.NodeName,
			WorkspaceID: ws.Name,
		},
	}

	err = controllerutil.SetOwnerReference(&ws, &snapshot, wsm.Client.Scheme())
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot set owner for snapshot: %q", err)
	}

	err = wsm.Client.Create(ctx, &snapshot)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot create snapshot object: %q", err)
	}

	var sso workspacev1.Snapshot
	err = wait.PollWithContext(ctx, 100*time.Millisecond, 10*time.Second, func(c context.Context) (done bool, err error) {
		err = wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: snapshot.Name}, &sso)
		if err != nil {
			return false, err
		}

		if sso.Status.Error != "" {
			return true, fmt.Errorf(sso.Status.Error)
		}

		if sso.Status.URL != "" {
			return true, nil
		}

		return false, nil
	})

	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot wait for snapshot URL: %v", err)
	}

	if !req.ReturnImmediately {
		err = wait.PollWithContext(ctx, 100*time.Millisecond, 0, func(c context.Context) (done bool, err error) {
			err = wsm.Client.Get(ctx, types.NamespacedName{Namespace: wsm.Config.Namespace, Name: ws.Name}, &sso)
			if err != nil {
				return false, nil
			}

			if sso.Status.Completed {
				return true, nil
			}

			return false, nil
		})

		if err != nil {
			return nil, status.Errorf(codes.Internal, "cannot wait for snapshot: %q", err)
		}

		if sso.Status.Error != "" {
			return nil, status.Errorf(codes.Internal, "cannot take snapshot: %q", sso.Status.Error)
		}
	}

	return &wsmanapi.TakeSnapshotResponse{
		Url: sso.Status.URL,
	}, nil
}

func (wsm *WorkspaceManagerServer) ControlAdmission(ctx context.Context, req *wsmanapi.ControlAdmissionRequest) (*wsmanapi.ControlAdmissionResponse, error) {
	err := wsm.modifyWorkspace(ctx, req.Id, false, func(ws *workspacev1.Workspace) error {
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

func (wsm *WorkspaceManagerServer) UpdateSSHKey(ctx context.Context, req *wsmanapi.UpdateSSHKeyRequest) (res *wsmanapi.UpdateSSHKeyResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "UpdateSSHKey")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	if err = validateUpdateSSHKeyRequest(req); err != nil {
		return &wsmanapi.UpdateSSHKeyResponse{}, err
	}

	err = wsm.modifyWorkspace(ctx, req.Id, false, func(ws *workspacev1.Workspace) error {
		ws.Spec.SshPublicKeys = req.Keys
		return nil
	})

	return &wsmanapi.UpdateSSHKeyResponse{}, err
}

// modifyWorkspace modifies a workspace object using the mod function. If the mod function returns a gRPC status error, that error
// is returned directly. If mod returns a non-gRPC error it is turned into one.
func (wsm *WorkspaceManagerServer) modifyWorkspace(ctx context.Context, id string, updateStatus bool, mod func(ws *workspacev1.Workspace) error) error {
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

		if updateStatus {
			err = wsm.Client.Status().Update(ctx, &ws)
		} else {
			err = wsm.Client.Update(ctx, &ws)

		}
		return err
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
func validateStartWorkspaceRequest(req *wsmanapi.StartWorkspaceRequest) error {
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
	if req.Type == wsmanapi.WorkspaceType_REGULAR {
		rules = append(rules, validation.Field(&req.ServicePrefix, validation.Required))
	}
	err = validation.ValidateStruct(req, rules...)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid request: %v", err)
	}

	return nil
}

func validateUpdateSSHKeyRequest(req *wsmanapi.UpdateSSHKeyRequest) error {
	err := validation.ValidateStruct(req,
		validation.Field(&req.Id, validation.Required),
		validation.Field(&req.Keys, validation.Required),
	)

	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid request: %v", err)
	}

	return nil
}

func isValidWorkspaceType(value interface{}) error {
	s, ok := value.(wsmanapi.WorkspaceType)
	if !ok {
		return xerrors.Errorf("value is not a workspace type")
	}

	_, ok = wsmanapi.WorkspaceType_name[int32(s)]
	if !ok {
		return xerrors.Errorf("value %d is out of range", s)
	}

	return nil
}

func areValidPorts(value interface{}) error {
	s, ok := value.([]*wsmanapi.PortSpec)
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
	s, ok := value.([]wsmanapi.WorkspaceFeatureFlag)
	if !ok {
		return xerrors.Errorf("value not a feature flag list")
	}

	idx := make(map[wsmanapi.WorkspaceFeatureFlag]struct{}, len(s))
	for _, k := range s {
		idx[k] = struct{}{}
	}

	return nil
}

func extractWorkspaceUserEnv(secretName string, userEnvs, sysEnvs []*wsmanapi.EnvironmentVariable) ([]corev1.EnvVar, map[string]string) {
	envVars := make([]corev1.EnvVar, 0, len(userEnvs))
	secrets := make(map[string]string)
	for _, e := range userEnvs {
		switch {
		case e.Secret != nil:
			securedEnv := corev1.EnvVar{
				Name: e.Name,
				ValueFrom: &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{Name: e.Secret.SecretName},
						Key:                  e.Secret.Key,
					},
				},
			}

			envVars = append(envVars, securedEnv)

		case e.Value == "":
			continue

		case !isProtectedEnvVar(e.Name, sysEnvs):
			unprotectedEnv := corev1.EnvVar{
				Name:  e.Name,
				Value: e.Value,
			}

			envVars = append(envVars, unprotectedEnv)

		default:
			name := fmt.Sprintf("%x", sha256.Sum256([]byte(e.Name)))
			protectedEnv := corev1.EnvVar{
				Name: e.Name,
				ValueFrom: &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{Name: secretName},
						Key:                  name,
					},
				},
			}

			envVars = append(envVars, protectedEnv)
			secrets[name] = e.Value
		}
	}

	return envVars, secrets
}

func extractWorkspaceSysEnv(sysEnvs []*wsmanapi.EnvironmentVariable) []corev1.EnvVar {
	envs := make([]corev1.EnvVar, 0, len(sysEnvs))
	for _, e := range sysEnvs {
		envs = append(envs, corev1.EnvVar{
			Name:  e.Name,
			Value: e.Value,
		})
	}

	return envs
}

func extractWorkspaceTokenData(spec *wsmanapi.StartWorkspaceSpec) map[string]string {
	secrets := make(map[string]string)
	for k, v := range csapi.ExtractAndReplaceSecretsFromInitializer(spec.Initializer) {
		secrets[k] = v
	}
	return secrets
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
		timeout = ws.Spec.Timeout.Time.Duration.String()
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

	var firstUserActivity *timestamppb.Timestamp
	for _, c := range ws.Status.Conditions {
		if c.Type == string(workspacev1.WorkspaceConditionFirstUserActivity) {
			firstUserActivity = timestamppb.New(c.LastTransitionTime.Time)
		}
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
				SupervisorRef: ws.Spec.Image.IDE.Supervisor,
			},
			IdeImageLayers: ws.Spec.Image.IDE.Refs,
			Headless:       ws.IsHeadless(),
			Url:            ws.Status.URL,
			Type:           tpe,
			Timeout:        timeout,
		},
		Phase: phase,
		Conditions: &wsmanapi.WorkspaceConditions{
			Failed:              getConditionMessageIfTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionFailed)),
			Timeout:             getConditionMessageIfTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionTimeout)),
			Snapshot:            ws.Status.Snapshot,
			Deployed:            convertCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionDeployed)),
			FirstUserActivity:   firstUserActivity,
			HeadlessTaskFailed:  getConditionMessageIfTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionsHeadlessTaskFailed)),
			StoppedByRequest:    convertCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionStoppedByRequest)),
			FinalBackupComplete: convertCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionBackupComplete)),
			Aborted:             convertCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionAborted)),
		},
		Runtime: runtime,
		Auth: &wsmanapi.WorkspaceAuthentication{
			Admission:  admissionLevel,
			OwnerToken: ws.Status.OwnerToken,
		},
	}

	return res
}

func getConditionMessageIfTrue(conds []metav1.Condition, tpe string) string {
	for _, c := range conds {
		if c.Type == tpe && c.Status == metav1.ConditionTrue {
			return c.Message
		}
	}
	return ""
}

func convertCondition(conds []metav1.Condition, tpe string) wsmanapi.WorkspaceConditionBool {
	res := wsk8s.GetCondition(conds, tpe)
	if res == nil {
		return wsmanapi.WorkspaceConditionBool_FALSE
	}

	switch res.Status {
	case metav1.ConditionTrue:
		return wsmanapi.WorkspaceConditionBool_TRUE
	default:
		return wsmanapi.WorkspaceConditionBool_FALSE
	}
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
	Filter *wsmanapi.MetadataFilter
}

func matchesMetadataFilter(filter *wsmanapi.MetadataFilter, md *wsmanapi.WorkspaceMetadata) bool {
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

func (f *filteringSubscriber) Send(resp *wsmanapi.SubscribeResponse) error {
	var md *wsmanapi.WorkspaceMetadata
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
	Send(*wsmanapi.SubscribeResponse) error
}

type subscriptions struct {
	mu          sync.RWMutex
	subscribers map[string]chan *wsmanapi.SubscribeResponse
}

func (subs *subscriptions) Subscribe(ctx context.Context, recv subscriber) (err error) {
	incoming := make(chan *wsmanapi.SubscribeResponse, 250)

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
		var inc *wsmanapi.SubscribeResponse
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

func (subs *subscriptions) PublishToSubscribers(ctx context.Context, update *wsmanapi.SubscribeResponse) {
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
func (subs *subscriptions) OnChange(ctx context.Context, status *wsmanapi.WorkspaceStatus) {
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

	subs.PublishToSubscribers(ctx, &wsmanapi.SubscribeResponse{
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

type workspaceMetrics struct {
	totalStartsCounterVec *prometheus.CounterVec
}

func newWorkspaceMetrics() *workspaceMetrics {
	return &workspaceMetrics{
		totalStartsCounterVec: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "gitpod",
			Subsystem: "ws_manager_mk2",
			Name:      "workspace_starts_total",
			Help:      "total number of workspaces started",
		}, []string{"type", "class"}),
	}
}

func (m *workspaceMetrics) recordWorkspaceStart(ws *workspacev1.Workspace) {
	tpe := string(ws.Spec.Type)
	class := ws.Spec.Class

	counter, err := m.totalStartsCounterVec.GetMetricWithLabelValues(tpe, class)
	if err != nil {
		log.WithError(err).WithField("type", tpe).WithField("class", class)
	}
	counter.Inc()
}

// Describe implements Collector. It will send exactly one Desc to the provided channel.
func (m *workspaceMetrics) Describe(ch chan<- *prometheus.Desc) {
	m.totalStartsCounterVec.Describe(ch)
}

// Collect implements Collector.
func (m *workspaceMetrics) Collect(ch chan<- prometheus.Metric) {
	m.totalStartsCounterVec.Collect(ch)
}
