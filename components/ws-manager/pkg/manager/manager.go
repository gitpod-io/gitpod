// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	validation "github.com/go-ozzo/ozzo-validation"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/controller-runtime/pkg/client"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/grpcpool"
)

// Manager is a kubernetes backed implementation of a workspace manager
type Manager struct {
	Config    config.Configuration
	Clientset client.Client
	RawClient kubernetes.Interface
	Content   *layer.Provider
	OnChange  func(context.Context, *api.WorkspaceStatus)

	activity sync.Map

	wsdaemonPool *grpcpool.Pool

	subscribers    map[string]chan *api.SubscribeResponse
	subscriberLock sync.RWMutex

	metrics *metrics

	api.UnimplementedWorkspaceManagerServer
	regapi.UnimplementedSpecProviderServer
}

type startWorkspaceContext struct {
	Request        *api.StartWorkspaceRequest `json:"request"`
	Labels         map[string]string          `json:"labels"`
	CLIAPIKey      string                     `json:"cliApiKey"`
	OwnerToken     string                     `json:"ownerToken"`
	IDEPort        int32                      `json:"idePort"`
	SupervisorPort int32                      `json:"supervisorPort"`
	WorkspaceURL   string                     `json:"workspaceURL"`
	TraceID        string                     `json:"traceID"`
	Headless       bool                       `json:"headless"`
}

const (
	// theiaVolume is the name of the theia volume
	theiaVolumeName = "vol-this-theia"
	// workspaceVolume is the name of the workspace volume
	workspaceVolumeName = "vol-this-workspace"
	// workspaceDir is the path within all containers where workspaceVolume is mounted to
	workspaceDir = "/workspace"
	// MarkerLabel is the label by which we identify pods which belong to ws-manager
	markerLabel = "gpwsman"
	// headlessLabel marks a workspace as headless
	headlessLabel = "headless"
)

const (
	// stopWorkspaceNormallyGracePeriod is the grace period we use when stopping a pod with StopWorkspaceNormally policy
	stopWorkspaceNormallyGracePeriod = 30 * time.Second
	// stopWorkspaceImmediatelyGracePeriod is the grace period we use when stopping a pod as soon as possbile
	stopWorkspaceImmediatelyGracePeriod = 1 * time.Second
	// wsdaemonDialTimeout is the time we allow for trying to connect to ws-daemon.
	// Note: this is NOT the time we allow for RPC calls to wsdaemon, but just for establishing the connection.
	wsdaemonDialTimeout = 10 * time.Second

	// kubernetesOperationTimeout is the time we give Kubernetes operations in general.
	kubernetesOperationTimeout = 5 * time.Second
)

// New creates a new workspace manager
func New(config config.Configuration, client client.Client, rawClient kubernetes.Interface, cp *layer.Provider) (*Manager, error) {
	wsdaemonConnfactory, _ := newWssyncConnectionFactory(config)
	m := &Manager{
		Config:       config,
		Clientset:    client,
		RawClient:    rawClient,
		Content:      cp,
		subscribers:  make(map[string]chan *api.SubscribeResponse),
		wsdaemonPool: grpcpool.New(wsdaemonConnfactory),
	}
	m.metrics = newMetrics(m)
	m.OnChange = m.onChange
	return m, nil
}

// Register registers all gRPC services provided by a Manager instance at a gRPC server
func Register(grpcServer *grpc.Server, manager *Manager) {
	api.RegisterWorkspaceManagerServer(grpcServer, manager)
	regapi.RegisterSpecProviderServer(grpcServer, manager)
}

// Close disposes some of the resources held by the manager. After calling close, the manager is not guaranteed
// to function properly anymore.
func (m *Manager) Close() {
	m.wsdaemonPool.Close()
}

// StartWorkspace creates a new running workspace within the manager's cluster
func (m *Manager) StartWorkspace(ctx context.Context, req *api.StartWorkspaceRequest) (res *api.StartWorkspaceResponse, err error) {
	owi := log.OWI(req.Metadata.Owner, req.Metadata.MetaId, req.Id)
	clog := log.WithFields(owi)
	span, ctx := tracing.FromContext(ctx, "StartWorkspace")
	tracing.LogRequestSafe(span, req)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	// Make sure the objects we're about to create do not exist already
	exists, err := m.workspaceExists(ctx, req.Id)
	if err != nil {
		return nil, xerrors.Errorf("cannot start workspace: %w", err)
	}
	if exists {
		return nil, status.Error(codes.AlreadyExists, "workspace instance already exists")
	}
	span.LogKV("event", "workspace does not exist")
	err = validateStartWorkspaceRequest(req)
	if err != nil {
		return nil, xerrors.Errorf("cannot start workspace: %w", err)
	}
	span.LogKV("event", "validated workspace start request")
	// create the objects required to start the workspace pod/service
	startContext, err := m.newStartWorkspaceContext(ctx, req)
	if err != nil {
		return nil, xerrors.Errorf("cannot create context: %w", err)
	}
	span.LogKV("event", "created start workspace context")
	clog.Info("starting new workspace")
	// we must create the workspace pod first to make sure we don't clean up the services or configmap we're about to create
	// because they're "dangling".
	pod, err := m.createWorkspacePod(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace pod: %w", err)
	}
	span.LogKV("event", "pod description created")
	err = m.Clientset.Create(ctx, pod)
	if err != nil {
		m, _ := json.Marshal(pod)
		safePod, _ := log.RedactJSON(m)

		if errors.IsAlreadyExists(err) {
			clog.WithError(err).WithField("req", req).WithField("pod", safePod).Warn("was unable to start workspace which already exists")
			return nil, status.Error(codes.AlreadyExists, "workspace instance already exists")
		}

		clog.WithError(err).WithField("req", req).WithField("pod", safePod).Error("was unable to start workspace")
		return nil, err
	}
	span.LogKV("event", "pod created")

	// all workspaces get a service now
	okResponse := &api.StartWorkspaceResponse{
		Url:        startContext.WorkspaceURL,
		OwnerToken: startContext.OwnerToken,
	}

	// mandatory Theia service
	servicePrefix := getServicePrefix(req)
	theiaServiceName := getTheiaServiceName(servicePrefix)
	theiaServiceLabels := make(map[string]string, len(startContext.Labels)+1)
	for k, v := range startContext.Labels {
		theiaServiceLabels[k] = v
	}
	theiaServiceLabels[wsk8s.ServiceTypeLabel] = "ide"
	theiaService := corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      theiaServiceName,
			Namespace: m.Config.Namespace,
			Labels:    startContext.Labels,
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeClusterIP,
			Ports: []corev1.ServicePort{
				{
					Name: "ide",
					Port: startContext.IDEPort,
				},
				{
					Name: "supervisor",
					Port: startContext.SupervisorPort,
				},
			},
			Selector: startContext.Labels,
		},
	}

	err = m.Clientset.Create(ctx, &theiaService)
	if err != nil {
		clog.WithError(err).WithField("req", req).Error("was unable to start workspace")
		// could not create Theia service
		return nil, xerrors.Errorf("cannot create workspace's Theia service: %w", err)
	}
	span.LogKV("event", "theia service created")

	// if we have ports configured already, create the ports service
	if len(req.Spec.Ports) > 0 {
		portService, err := m.createPortsService(req.Id, servicePrefix, req.Metadata.MetaId, req.Spec.Ports)
		if err != nil {
			return nil, xerrors.Errorf("cannot create workspace's public service: %w", err)
		}

		err = m.Clientset.Create(ctx, portService)
		if err != nil {
			clog.WithError(err).WithField("req", req).Error("was unable to start workspace")
			// could not create ports service
			return nil, xerrors.Errorf("cannot create workspace's public service: %w", err)
		}
		span.LogKV("event", "ports service created")
	}

	m.metrics.OnWorkspaceStarted(req.Type)

	return okResponse, nil
}

// validateStartWorkspaceRequest ensures that acting on this request will not leave the system in an invalid state
func validateStartWorkspaceRequest(req *api.StartWorkspaceRequest) error {
	err := validation.ValidateStruct(req.Spec,
		validation.Field(&req.Spec.WorkspaceImage, validation.Required),
		validation.Field(&req.Spec.CheckoutLocation, validation.Required),
		validation.Field(&req.Spec.WorkspaceLocation, validation.Required),
		validation.Field(&req.Spec.Ports, validation.By(areValidPorts)),
		validation.Field(&req.Spec.Initializer, validation.Required),
		validation.Field(&req.Spec.FeatureFlags, validation.By(areValidFeatureFlags)),
	)
	if err != nil {
		return xerrors.Errorf("invalid request: %w", err)
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
		return xerrors.Errorf("invalid request: %w", err)
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

// StopWorkspace stops a running workspace
func (m *Manager) StopWorkspace(ctx context.Context, req *api.StopWorkspaceRequest) (res *api.StopWorkspaceResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "StopWorkspace")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	gracePeriod := stopWorkspaceNormallyGracePeriod
	if req.Policy == api.StopWorkspacePolicy_IMMEDIATELY {
		gracePeriod = stopWorkspaceImmediatelyGracePeriod
	}

	if err := m.stopWorkspace(ctx, req.Id, gracePeriod); err != nil {
		return nil, err
	}

	return &api.StopWorkspaceResponse{}, nil
}

// stopWorkspace stops a workspace. If the workspace is already stopping, this is a noop
func (m *Manager) stopWorkspace(ctx context.Context, workspaceID string, gracePeriod time.Duration) (err error) {
	if m.Config.DryRun {
		log.WithFields(log.OWI("", "", workspaceID)).Info("should have stopped pod but this is a dry run")
		return nil
	}

	span, ctx := tracing.FromContext(ctx, "stopWorkspace")
	defer tracing.FinishSpan(span, &err)

	pod, err := m.findWorkspacePod(ctx, workspaceID)
	if isKubernetesObjNotFoundError(err) {
		return err
	}
	if err != nil {
		return xerrors.Errorf("stopWorkspace: %w", err)
	}

	status, _ := m.getWorkspaceStatus(workspaceObjects{Pod: pod})
	if status != nil {
		span.SetTag("phase", status.Phase)
		// If the status is nil (e.g. because an error occured), we'll still try and stop the workspace
		// This is merely an optimization that prevents deleting the workspace pod multiple times.
		// If we do try and delete the pod a few times though, that's ok, too.
		if isPodBeingDeleted(pod) {
			return nil
		}
	}

	// we trace the stopping phase seperately from the startup phase. If we don't have a trace annotation on the workspace yet,
	// add a new one.
	workspaceSpan := opentracing.StartSpan("workspace-stop", opentracing.FollowsFrom(opentracing.SpanFromContext(ctx).Context()))
	tracing.ApplyOWI(workspaceSpan, wsk8s.GetOWIFromObject(&pod.ObjectMeta))

	servicePrefix, ok := pod.Annotations[servicePrefixAnnotation]
	if !ok {
		return xerrors.Errorf("stopWorkspace: pod %s has no %s annotation", pod.Name, servicePrefixAnnotation)
	}

	gracePeriodSeconds := int64(gracePeriod.Seconds())
	propagationPolicy := metav1.DeletePropagationForeground

	theiaServiceErr := m.Clientset.Delete(ctx,
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      getTheiaServiceName(servicePrefix),
				Namespace: m.Config.Namespace,
			},
		},
		&client.DeleteOptions{
			GracePeriodSeconds: &gracePeriodSeconds,
			PropagationPolicy:  &propagationPolicy,
		},
	)
	span.LogKV("event", "theia service deleted")

	portsServiceErr := m.Clientset.Delete(ctx, &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      getPortsServiceName(servicePrefix),
			Namespace: m.Config.Namespace,
		},
	},
		&client.DeleteOptions{
			GracePeriodSeconds: &gracePeriodSeconds,
			PropagationPolicy:  &propagationPolicy,
		},
	)
	span.LogKV("event", "ports service deleted")

	podErr := m.Clientset.Delete(ctx,
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      pod.Name,
				Namespace: m.Config.Namespace,
			},
		},
		&client.DeleteOptions{
			GracePeriodSeconds: &gracePeriodSeconds,
			PropagationPolicy:  &propagationPolicy,
		},
	)
	span.LogKV("event", "pod deleted")

	if podErr != nil {
		return xerrors.Errorf("stopWorkspace: %w", podErr)
	}
	if theiaServiceErr != nil && !isKubernetesObjNotFoundError(theiaServiceErr) {
		return xerrors.Errorf("stopWorkspace: %w", theiaServiceErr)
	}
	if portsServiceErr != nil && !isKubernetesObjNotFoundError(portsServiceErr) {
		return xerrors.Errorf("stopWorkspace: %w", portsServiceErr)
	}
	return nil
}

// findWorkspacePod finds the pod for a workspace
func (m *Manager) findWorkspacePod(ctx context.Context, workspaceID string) (*corev1.Pod, error) {
	var pods corev1.PodList
	err := m.Clientset.List(ctx, &pods,
		&client.ListOptions{
			Namespace: m.Config.Namespace,
			LabelSelector: labels.SelectorFromSet(labels.Set{
				"workspaceID": workspaceID,
			}),
		},
	)
	if err != nil {
		return nil, err
	}
	if len(pods.Items) == 0 {
		return nil, &k8serr.StatusError{ErrStatus: metav1.Status{
			Code:    http.StatusNotFound,
			Message: fmt.Sprintf("pod for workspace %s not found", workspaceID),
		}}
	}
	if len(pods.Items) > 1 {
		return nil, xerrors.Errorf("found %d candidates for workspace %s", len(pods.Items), workspaceID)
	}
	return &pods.Items[0], nil
}

// getPodID computes the pod ID from a workpace ID
//nolint:unused,deadcode
func getPodID(workspaceType, workspaceID string) string {
	return fmt.Sprintf("%s-%s", strings.TrimSpace(strings.ToLower(workspaceType)), strings.TrimSpace(workspaceID))
}

func getPortsServiceName(servicePrefix string) string {
	return fmt.Sprintf("ws-%s-ports", strings.TrimSpace(strings.ToLower(servicePrefix)))
}

func getTheiaServiceName(servicePrefix string) string {
	return fmt.Sprintf("ws-%s-theia", strings.TrimSpace(strings.ToLower(servicePrefix)))
}

// MarkActive records a workspace as being active which prevents it from timing out
func (m *Manager) MarkActive(ctx context.Context, req *api.MarkActiveRequest) (res *api.MarkActiveResponse, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "MarkActive")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	workspaceID := req.Id

	pod, err := m.findWorkspacePod(ctx, workspaceID)
	if isKubernetesObjNotFoundError(err) {
		return nil, xerrors.Errorf("workspace %s does not exist", workspaceID)
	}
	if err != nil {
		return nil, xerrors.Errorf("cannot mark workspace: %w", err)
	}

	// We do not keep the last activity as annotation on the workspace to limit the load we're placing
	// on the K8S master in check. Thus, this state lives locally in a map.
	now := time.Now().UTC()
	m.activity.Store(req.Id, &now)

	// We do however maintain the the "closed" flag as annotation on the workspace. This flag should not change
	// very often and provides a better UX if it persists across ws-manager restarts.
	_, isMarkedClosed := pod.Annotations[workspaceClosedAnnotation]
	if req.Closed && !isMarkedClosed {
		err = m.markWorkspace(ctx, workspaceID, addMark(workspaceClosedAnnotation, "true"))
	} else if !req.Closed && isMarkedClosed {
		err = m.markWorkspace(ctx, workspaceID, deleteMark(workspaceClosedAnnotation))
	}
	if err != nil {
		log.WithError(err).WithFields(log.OWI("", "", workspaceID)).Warn("was unable to mark workspace properly")
	}

	// If it's the first call: Mark the pod with firstUserActivityAnnotation
	if _, hasFirstUserAcitviyAnnotation := pod.Annotations[firstUserActivityAnnotation]; !hasFirstUserAcitviyAnnotation {
		err = m.markWorkspace(ctx, workspaceID, addMark(firstUserActivityAnnotation, now.Format(time.RFC3339Nano)))
		if err != nil {
			log.WithError(err).WithFields(log.OWI("", "", workspaceID)).Warn("was unable to mark workspace with firstUserAcitviy")
		}
	}

	return &api.MarkActiveResponse{}, nil
}

func (m *Manager) getWorkspaceActivity(workspaceID string) *time.Time {
	lastActivity, hasActivity := m.activity.Load(workspaceID)
	if hasActivity {
		return lastActivity.(*time.Time)
	}

	return nil
}

// markAllWorkspacesActive marks all existing workspaces as active (as if MarkActive had been called for each of them)
func (m *Manager) markAllWorkspacesActive() error {
	ctx, cancel := context.WithTimeout(context.Background(), kubernetesOperationTimeout)
	defer cancel()

	var pods corev1.PodList
	err := m.Clientset.List(ctx, &pods, workspaceObjectListOptions(m.Config.Namespace))
	if err != nil {
		return xerrors.Errorf("markAllWorkspacesActive: %w", err)
	}

	for _, pod := range pods.Items {
		wsid, ok := pod.Annotations[workspaceIDAnnotation]
		if !ok {
			log.WithFields(wsk8s.GetOWIFromObject(&pod.ObjectMeta)).Warnf("pod %s has no %s annotation - cannot mark it active", pod.Name, workspaceIDAnnotation)
			continue
		}

		now := time.Now().UTC()
		m.activity.Store(wsid, &now)
	}
	return nil
}

// ControlPort publicly exposes or un-exposes a network port for a workspace
func (m *Manager) ControlPort(ctx context.Context, req *api.ControlPortRequest) (res *api.ControlPortResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "ControlPort")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	pod, err := m.findWorkspacePod(ctx, req.Id)
	if err != nil {
		return nil, xerrors.Errorf("cannot find workspace: %w", err)
	}
	if pod == nil {
		return nil, status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
	}
	tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))

	servicePrefix, ok := pod.Annotations[servicePrefixAnnotation]
	if !ok || servicePrefix == "" {
		return nil, xerrors.Errorf("workspace pod %s has no service prefix annotation", pod.Name)
	}

	var service corev1.Service
	notifyStatusChange := func() error {
		// by modifying the ports service we have changed the workspace status. However, this status change is not propagated
		// through the regular monitor mechanism as we did not modify the pod itself. We have to send out a status update
		// outselves. Doing it ourselves lets us synchronize the status update with probing for actual availability, not just
		// the service modification in Kubernetes.
		wso := workspaceObjects{Pod: pod, PortsService: &service}
		err := m.completeWorkspaceObjects(ctx, &wso)
		if err != nil {
			return xerrors.Errorf("cannot update status: %w", err)
		}
		status, err := m.getWorkspaceStatus(wso)
		if err != nil {
			return xerrors.Errorf("cannot update status: %w", err)
		}
		m.OnChange(ctx, status)

		return nil
	}

	metaID := pod.ObjectMeta.Annotations[wsk8s.MetaIDLabel]
	// dunno why in k8s IP ports are int32 not uint16
	port := int32(req.Spec.Port)
	// get ports service if it exists
	err = m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: getPortsServiceName(servicePrefix)}, &service)
	if isKubernetesObjNotFoundError(err) {
		if !req.Expose {
			// we're not asked to expose the port so there's nothing left to do here
			return &api.ControlPortResponse{}, nil
		}

		// service does not exist - create it
		newService, err := m.createPortsService(req.Id, metaID, servicePrefix, []*api.PortSpec{req.Spec})
		if err != nil {
			return nil, xerrors.Errorf("cannot create workspace's public service: %w", err)
		}
		err = m.Clientset.Create(ctx, newService, &client.CreateOptions{})
		if err != nil {
			return nil, xerrors.Errorf("cannot create service: %w", err)
		}
		span.LogKV("event", "port service created")

		service = *newService

		// the KubeDNS need a short while to pick up the new service. When we can resolve the service name, so can the proxy
		// which means the user won't get an error if they try to access the port.
		host := fmt.Sprintf("%s.%s", service.Name, m.Config.Namespace)
		for {
			if m.Config.InitProbe.Disabled {
				// In tests we'd like to mock net.LookupHost(host) instead of disabling the probe,
				// but we can't (see https://github.com/golang/go/issues/12503 and https://groups.google.com/forum/#!topic/golang-codereviews/6jmR0F6BZVU)
				break
			}

			_, err = net.LookupHost(host)
			// There's no direct way to check if the host wasn't found in Go1.12: https://go-review.googlesource.com/c/go/+/168597/
			// Thus we assume any error means we can't resolve the host yet.
			if err == nil {
				break
			}

			// abort if the context deadline is exceeded
			if err := ctx.Err(); err != nil {
				return nil, err
			}
		}
		span.LogKV("event", "host available")

		// we've successfully exposed the port by creating the service
		err = notifyStatusChange()
		if err != nil {
			return nil, err
		}
		return &api.ControlPortResponse{}, nil
	}
	if err != nil {
		return nil, xerrors.Errorf("cannot control port: %w", err)
	}

	// the service exists - let's modify it
	spec := &service.Spec
	existingPortSpecIdx := -1
	for i, p := range service.Spec.Ports {
		if p.Port == port {
			existingPortSpecIdx = i
			break
		}
	}

	if req.Expose && existingPortSpecIdx < 0 {
		// port is not exposed yet - patch the service
		portSpec := corev1.ServicePort{
			Name:     portSpecToName(req.Spec),
			Port:     port,
			Protocol: corev1.ProtocolTCP,
		}
		if req.Spec.Target != 0 {
			portSpec.TargetPort = intstr.FromInt(int(req.Spec.Target))
		}
		spec.Ports = append(spec.Ports, portSpec)
	} else if req.Expose && existingPortSpecIdx >= 0 {
		service.Spec.Ports[existingPortSpecIdx].TargetPort = intstr.FromInt(int(req.Spec.Target))
		service.Spec.Ports[existingPortSpecIdx].Name = portSpecToName(req.Spec)
	} else if !req.Expose && existingPortSpecIdx < 0 {
		// port isn't exposed already - we're done here
		return &api.ControlPortResponse{}, nil
	} else if !req.Expose && existingPortSpecIdx >= 0 {
		// port is exposed but shouldn't be - remove it from the port list
		spec.Ports = append(spec.Ports[:existingPortSpecIdx], spec.Ports[existingPortSpecIdx+1:]...)
	}

	if len(spec.Ports) == 0 {
		// we don't have any ports exposed anymore: remove the service
		propagationPolicy := metav1.DeletePropagationForeground
		var zero int64 = 0
		err = m.Clientset.Delete(ctx, &service, &client.DeleteOptions{
			GracePeriodSeconds: &zero,
			PropagationPolicy:  &propagationPolicy,
		})

		span.LogKV("event", "port service deleted")
	} else {
		// we've made it here which means we need to actually patch the service
		service.Spec = *spec

		for _, p := range service.Spec.Ports {
			url, err := config.RenderWorkspacePortURL(m.Config.WorkspacePortURLTemplate, config.PortURLContext{
				Host:          m.Config.GitpodHostURL,
				ID:            req.Id,
				IngressPort:   fmt.Sprint(p.Port),
				Prefix:        servicePrefix,
				WorkspacePort: fmt.Sprint(p.Port),
			})
			if err != nil {
				return nil, xerrors.Errorf("cannot render public URL for %d: %w", p.Port, err)
			}
			if service.Annotations == nil {
				service.Annotations = map[string]string{}
			}
			service.Annotations[fmt.Sprintf("gitpod/port-url-%d", p.Port)] = url
		}

		err = m.Clientset.Update(ctx, &service)
		if err != nil {
			return nil, xerrors.Errorf("cannot update service: %w", err)
		}
		span.LogKV("event", "port service updated")
	}
	if err != nil {
		return nil, xerrors.Errorf("cannot control port: %w", err)
	}

	err = notifyStatusChange()
	if err != nil {
		return nil, err
	}
	return &api.ControlPortResponse{}, nil
}

// portSpecToName generates a port name from the given PortSpec
func portSpecToName(spec *api.PortSpec) string {
	api.PortVisibility_PORT_VISIBILITY_PUBLIC.EnumDescriptor()
	visibilityStr := strings.ToLower(strings.TrimPrefix(spec.Visibility.String(), "PORT_VISIBILITY_"))
	return fmt.Sprintf("p%d-%s", spec.Port, visibilityStr)
}

// portNameToVisibility parses the port name with the pattern defined in PortSpecToName and return the ports visibility (or default value if not specified)
func portNameToVisibility(s string) api.PortVisibility {
	parts := strings.Split(s, "-")
	if len(parts) != 2 {
		// old or wrong port name: return default
		return api.PortVisibility_PORT_VISIBILITY_PRIVATE
	}

	// parse (or public as fallback: important for backwards compatibility during rollout)
	visibilitStr := fmt.Sprintf("PORT_VISIBILITY_%s", strings.ToUpper(parts[1]))
	i32Value, present := api.PortVisibility_value[visibilitStr]
	if !present {
		return api.PortVisibility_PORT_VISIBILITY_PRIVATE
	}
	return api.PortVisibility(i32Value)
}

// DescribeWorkspace investigates a workspace and returns its status, and configuration
func (m *Manager) DescribeWorkspace(ctx context.Context, req *api.DescribeWorkspaceRequest) (res *api.DescribeWorkspaceResponse, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "DescribeWorkspace")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	// Note: if we ever face performance issues with our constant querying of Kubernetes, we could use the reflector
	//       which mirrors the server-side content (see https://github.com/kubernetes/client-go/blob/master/tools/cache/reflector.go).

	pod, err := m.findWorkspacePod(ctx, req.Id)
	if isKubernetesObjNotFoundError(err) {
		// TODO: make 404 status error
		return nil, status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}
	tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))
	span.LogKV("event", "get pod")

	wso, err := m.getWorkspaceObjects(ctx, pod)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}

	sts, err := m.getWorkspaceStatus(*wso)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace status: %q", err)
	}

	result := &api.DescribeWorkspaceResponse{
		Status: sts,
	}

	lastActivity := m.getWorkspaceActivity(req.Id)
	if lastActivity != nil {
		result.LastActivity = lastActivity.UTC().Format(time.RFC3339Nano)
	}
	return result, nil
}

// Subscribe streams all status updates to a client
func (m *Manager) Subscribe(req *api.SubscribeRequest, srv api.WorkspaceManager_SubscribeServer) (err error) {
	var sub subscriber = srv
	if req.MustMatch != nil {
		sub = &filteringSubscriber{srv, req.MustMatch}
	}

	return m.subscribe(srv.Context(), sub)
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

func (m *Manager) subscribe(ctx context.Context, recv subscriber) (err error) {
	incoming := make(chan *api.SubscribeResponse, 250)

	var key string
	peer, ok := peer.FromContext(ctx)
	if ok {
		key = fmt.Sprintf("k%s@%d", peer.Addr.String(), time.Now().UnixNano())
	}

	m.subscriberLock.Lock()
	if key == "" {
		// if for some reason we didn't get peer information,
		// we must generate they key within the lock, otherwise we might end up with duplicate keys
		key = fmt.Sprintf("k%d@%d", len(m.subscribers), time.Now().UnixNano())
	}
	m.subscribers[key] = incoming
	log.WithField("subscriberKey", key).WithField("subscriberCount", len(m.subscribers)).Info("new subscriber")
	m.subscriberLock.Unlock()

	defer func() {
		m.subscriberLock.Lock()
		delete(m.subscribers, key)
		m.subscriberLock.Unlock()
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

func (m *Manager) publishToSubscribers(ctx context.Context, update *api.SubscribeResponse) {
	m.subscriberLock.RLock()
	var dropouts []string
	for k, sub := range m.subscribers {
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
	m.subscriberLock.RUnlock()

	// we check if there are any dropouts here to avoid the non-inlinable dropSubscriber call.
	if len(dropouts) > 0 {
		m.dropSubscriber(dropouts)
	}
}

func (m *Manager) dropSubscriber(dropouts []string) {
	defer func() {
		err := recover()
		if err != nil {
			log.WithField("error", err).Error("caught panic in dropSubscriber")
		}
	}()

	m.subscriberLock.Lock()
	defer m.subscriberLock.Unlock()

	for _, k := range dropouts {
		sub, ok := m.subscribers[k]
		if !ok {
			continue
		}

		log.WithField("subscriber", k).WithField("subscriberCount", len(m.subscribers)).Warn("subscriber channel was full - dropping subscriber")
		// despite closing the subscriber channel, the subscriber's serve Go routine will still try to send
		// all prior updates up to this point. See https://play.golang.org/p/XR-9nLrQLQs
		close(sub)
		delete(m.subscribers, k)
	}
}

// onChange is the default OnChange implementation which publishes workspace status updates to subscribers
func (m *Manager) onChange(ctx context.Context, status *api.WorkspaceStatus) {
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

	m.publishToSubscribers(ctx, &api.SubscribeResponse{
		Status: status,
		Header: header,
	})

	m.metrics.OnChange(status)

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

// GetWorkspaces produces a list of running workspaces and their status
func (m *Manager) GetWorkspaces(ctx context.Context, req *api.GetWorkspacesRequest) (res *api.GetWorkspacesResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "GetWorkspaces")
	defer tracing.FinishSpan(span, &err)

	wsos, err := m.getAllWorkspaceObjects(ctx)
	if err != nil {
		return nil, xerrors.Errorf("cannot get all workspaces: %w", err)
	}

	result := make([]*api.WorkspaceStatus, 0, len(wsos))
	for _, wso := range wsos {
		status, err := m.getWorkspaceStatus(wso)
		if err != nil {
			log.WithError(err).Error("cannot get complete workspace list")
			continue
		}

		if !matchesMetadataFilter(req.MustMatch, status.Metadata) {
			continue
		}

		result = append(result, status)
	}

	return &api.GetWorkspacesResponse{Status: result}, nil
}

// getAllWorkspaceObjects retturns all (possibly incomplete) workspaceObjects of all workspaces this manager is currently aware of.
// If a workspace has a pod that pod is part of the returned WSO.
func (m *Manager) getAllWorkspaceObjects(ctx context.Context) (objs []workspaceObjects, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "getAllWorkspaceObjects")
	defer tracing.FinishSpan(span, &err)

	var pods corev1.PodList
	err = m.Clientset.List(ctx, &pods, workspaceObjectListOptions(m.Config.Namespace))
	if err != nil {
		return nil, xerrors.Errorf("cannot list workspaces: %w", err)
	}
	var services corev1.ServiceList
	err = m.Clientset.List(ctx, &services, workspaceObjectListOptions(m.Config.Namespace))
	if err != nil {
		return nil, xerrors.Errorf("cannot list services: %w", err)
	}

	var (
		wsoIndex          = make(map[string]*workspaceObjects)
		theiaServiceIndex = make(map[string]*workspaceObjects)
		portServiceIndex  = make(map[string]*workspaceObjects)
	)
	for _, pod := range pods.Items {
		id, ok := pod.Annotations[workspaceIDAnnotation]
		if !ok {
			log.WithField("pod", pod.Name).Warn("pod has no workspace ID")
			span.LogKV("warning", "pod has no workspace ID", "podName", pod.Name)
			span.SetTag("error", true)
			continue
		}

		// don't references to loop variables - they magically change their value
		podcopy := pod
		wso := &workspaceObjects{Pod: &podcopy}

		wsoIndex[id] = wso
		if sp, ok := pod.Annotations[servicePrefixAnnotation]; ok {
			theiaServiceIndex[getTheiaServiceName(sp)] = wso
			portServiceIndex[getPortsServiceName(sp)] = wso
		}
	}

	for _, service := range services.Items {
		// don't references to loop variables - they magically change their value
		serviceCopy := service

		if wso, ok := theiaServiceIndex[service.Name]; ok {
			wso.TheiaService = &serviceCopy
			continue
		}
		if wso, ok := portServiceIndex[service.Name]; ok {
			wso.PortsService = &serviceCopy
			continue
		}
	}

	var i int
	result := make([]workspaceObjects, len(wsoIndex))
	for _, wso := range wsoIndex {
		result[i] = *wso
		i++
	}
	return result, nil
}

// workspaceExists checks if a workspace exists with the given ID
func (m *Manager) workspaceExists(ctx context.Context, id string) (bool, error) {
	pod, err := m.findWorkspacePod(ctx, id)
	if isKubernetesObjNotFoundError(err) {
		return false, nil
	}
	if err != nil {
		return false, xerrors.Errorf("workspaceExists: %w", err)
	}
	return pod != nil, nil
}

func isKubernetesObjNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	if err, ok := err.(*k8serr.StatusError); ok {
		return err.ErrStatus.Code == http.StatusNotFound
	}
	return false
}

// connectToWorkspaceDaemon establishes a connection to the ws-daemon daemon running on the node of the pod/workspace.
func (m *Manager) connectToWorkspaceDaemon(ctx context.Context, wso workspaceObjects) (wcsClient wsdaemon.WorkspaceContentServiceClient, err error) {
	//nolint:ineffassign
	span, ctx := tracing.FromContext(ctx, "connectToWorkspaceDaemon")
	tracing.ApplyOWI(span, wso.GetOWI())
	defer tracing.FinishSpan(span, &err)

	nodeName := wso.NodeName()
	if nodeName == "" {
		return nil, xerrors.Errorf("no nodeName found")
	}

	// Get all the ws-daemon endpoints (headless)
	// NOTE: we could do a DNS lookup but currently keeping it k8s-centric
	// to allow for transitioning to the newer service topology support.
	// Also the Clientset is cache-enabled so we can leverage that.
	var endpointsList corev1.EndpointsList
	err = m.Clientset.List(ctx, &endpointsList,
		&client.ListOptions{
			Namespace: m.Config.Namespace,
			LabelSelector: labels.SelectorFromSet(labels.Set{
				"component": "ws-daemon",
				"kind":      "service",
			}),
		},
	)
	if err != nil {
		return nil, err
	}

	// Find the ws-daemon endpoint on this node
	var hostIP string
	for _, pod := range endpointsList.Items {
		for _, subset := range pod.Subsets {
			for _, endpointAddress := range subset.Addresses {
				if endpointAddress.NodeName != nil && strings.Compare(nodeName, *endpointAddress.NodeName) == 0 {
					hostIP = endpointAddress.IP
					break
				}
			}
		}
	}

	if hostIP == "" {
		return nil, xerrors.Errorf("cannot connect to ws-daemon: pod has no matching endpoint")
	}
	conn, err := m.wsdaemonPool.Get(hostIP)
	if err != nil {
		return nil, err
	}

	return wsdaemon.NewWorkspaceContentServiceClient(conn), nil
}

// newWssyncConnectionFactory creates a new wsdaemon connection factory based on the wsmanager configuration
func newWssyncConnectionFactory(managerConfig config.Configuration) (grpcpool.Factory, error) {
	cfg := managerConfig.WorkspaceDaemon
	grpcOpts := common_grpc.DefaultClientOptions()
	if cfg.TLS.Authority != "" || cfg.TLS.Certificate != "" && cfg.TLS.PrivateKey != "" {
		ca := cfg.TLS.Authority
		crt := cfg.TLS.Certificate
		key := cfg.TLS.PrivateKey

		// Telepresence (used for debugging only) requires special paths to load files from
		if root := os.Getenv("TELEPRESENCE_ROOT"); root != "" {
			ca = filepath.Join(root, ca)
			crt = filepath.Join(root, crt)
			key = filepath.Join(root, key)
		}

		rootCA, err := os.ReadFile(ca)
		if err != nil {
			return nil, xerrors.Errorf("could not read ca certificate: %s", err)
		}
		certPool := x509.NewCertPool()
		if ok := certPool.AppendCertsFromPEM(rootCA); !ok {
			return nil, xerrors.Errorf("failed to append ca certs")
		}

		certificate, err := tls.LoadX509KeyPair(crt, key)
		if err != nil {
			log.WithField("config", cfg.TLS).Error("Cannot load ws-daemon certs - this is a configuration issue.")
			return nil, xerrors.Errorf("cannot load ws-daemon certs: %w", err)
		}

		creds := credentials.NewTLS(&tls.Config{
			ServerName:   "wsdaemon",
			Certificates: []tls.Certificate{certificate},
			RootCAs:      certPool,
			MinVersion:   tls.VersionTLS12,
		})
		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(creds))
	} else {
		grpcOpts = append(grpcOpts, grpc.WithInsecure())
	}
	port := cfg.Port

	return func(host string) (*grpc.ClientConn, error) {
		var (
			addr           = fmt.Sprintf("%s:%d", host, port)
			conctx, cancel = context.WithTimeout(context.Background(), wsdaemonDialTimeout)
		)
		// Canceling conctx becomes a no-op once the connection is established.
		// Because we use WithBlock in the opts DialContext will only return once the connection is established.
		// Hence upon leaving this function we can safely cancel the conctx.
		defer cancel()

		conn, err := grpc.DialContext(conctx, addr, grpcOpts...)
		if err != nil {
			log.WithError(err).WithField("addr", addr).Error("cannot connect to ws-daemon")

			// we deliberately swallow the error here as users might see this one.
			return nil, xerrors.Errorf("cannot connect to workspace daemon")
		}
		return conn, nil
	}, nil
}
