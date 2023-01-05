// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	validation "github.com/go-ozzo/ozzo-validation"
	"github.com/opentracing/opentracing-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	k8serr "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	covev1client "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/retry"
	"sigs.k8s.io/controller-runtime/pkg/client"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/common-go/util"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/layer"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/clock"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/grpcpool"

	volumesnapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/apis/volumesnapshot/v1"
	volumesnapshotclientv1 "github.com/kubernetes-csi/external-snapshotter/client/v4/clientset/versioned"
	watchtools "k8s.io/client-go/tools/watch"
)

// Manager is a kubernetes backed implementation of a workspace manager
type Manager struct {
	Config               config.Configuration
	Clientset            client.Client
	RawClient            kubernetes.Interface
	VolumeSnapshotClient volumesnapshotclientv1.Interface
	Content              *layer.Provider
	OnChange             func(context.Context, *api.WorkspaceStatus)

	activity sync.Map
	clock    *clock.HLC

	wsdaemonPool *grpcpool.Pool

	subscribers    map[string]chan *api.SubscribeResponse
	subscriberLock sync.RWMutex

	metrics *metrics

	eventRecorder record.EventRecorder

	api.UnimplementedWorkspaceManagerServer
	regapi.UnimplementedSpecProviderServer
}

type startWorkspaceContext struct {
	Request        *api.StartWorkspaceRequest     `json:"request"`
	Labels         map[string]string              `json:"labels"`
	CLIAPIKey      string                         `json:"cliApiKey"`
	OwnerToken     string                         `json:"ownerToken"`
	IDEPort        int32                          `json:"idePort"`
	SupervisorPort int32                          `json:"supervisorPort"`
	WorkspaceURL   string                         `json:"workspaceURL"`
	Headless       bool                           `json:"headless"`
	Class          *config.WorkspaceClass         `json:"class"`
	VolumeSnapshot *workspaceVolumeSnapshotStatus `json:"volumeSnapshot"`
}

func (swctx *startWorkspaceContext) ContainerConfiguration() config.ContainerConfiguration {
	var res config.ContainerConfiguration
	if swctx.Class != nil {
		res = swctx.Class.Container
	}
	return res
}

const (
	// workspaceVolume is the name of the workspace volume
	workspaceVolumeName = "vol-this-workspace"
	// workspaceDir is the path within all containers where workspaceVolume is mounted to
	workspaceDir = "/workspace"
	// MarkerLabel is the label by which we identify pods which belong to ws-manager
	markerLabel = "gpwsman"
	// headlessLabel marks a workspace as headless
	headlessLabel = "headless"
	// workspaceClassLabel denotes the class of a workspace
	workspaceClassLabel = "gitpod.io/workspaceClass"
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
func New(config config.Configuration, client client.Client, rawClient kubernetes.Interface, volumesnapshotClient volumesnapshotclientv1.Interface, cp *layer.Provider) (*Manager, error) {
	wsdaemonConnfactory, err := newWssyncConnectionFactory(config)
	if err != nil {
		return nil, err
	}

	broadcaster := record.NewBroadcaster()
	broadcaster.StartRecordingToSink(&covev1client.EventSinkImpl{Interface: rawClient.CoreV1().Events("")})
	eventRecorder := broadcaster.NewRecorder(runtime.NewScheme(), corev1.EventSource{Component: "ws-manager"})

	m := &Manager{
		Config:               config,
		Clientset:            client,
		RawClient:            rawClient,
		VolumeSnapshotClient: volumesnapshotClient,
		Content:              cp,
		clock:                clock.System(),
		subscribers:          make(map[string]chan *api.SubscribeResponse),
		wsdaemonPool:         grpcpool.New(wsdaemonConnfactory, checkWSDaemonEndpoint(config.Namespace, client)),
		eventRecorder:        eventRecorder,
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

type (
	ctxKeyRemainingTime struct{}
)

// StartWorkspace creates a new running workspace within the manager's cluster
func (m *Manager) StartWorkspace(ctx context.Context, req *api.StartWorkspaceRequest) (res *api.StartWorkspaceResponse, err error) {
	if m.Config.MaintenanceMode {
		return &api.StartWorkspaceResponse{}, status.Error(codes.FailedPrecondition, "under maintenance mode")
	}

	startWorkspaceTime := time.Now()

	// We cannot use the passed context because we need to decouple the timeouts
	// Create a context with a high timeout value to be able to wait for scale-up events in the cluster (slow operation)
	// Important!!!: this timeout must be lower than https://github.com/gitpod-io/gitpod/blob/main/components/ws-manager-api/typescript/src/promisified-client.ts#L122
	startWorkspaceTimeout := 10 * time.Minute

	// Edge case: when a workspace cannot be scheduled can stay in Pending state forever we
	// delete the pod and call StartWorkspace passing the remaining process time until timeout.
	// In case of timeout, the context is canceled and the error is propagated to the caller.
	if remainingTime, ok := ctx.Value(ctxKeyRemainingTime{}).(time.Duration); ok {
		startWorkspaceTimeout = remainingTime
	}

	ctx, cancel := context.WithTimeout(context.Background(), startWorkspaceTimeout)
	defer cancel()

	owi := log.LogContext(req.Metadata.Owner, req.Metadata.MetaId, req.Id, req.Metadata.GetProject(), req.Metadata.GetTeam())
	clog := log.WithFields(owi)
	span, ctx := tracing.FromContext(ctx, "StartWorkspace")
	tracing.LogRequestSafe(span, req)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	defer func(req *api.StartWorkspaceRequest, err *error) {
		if err != nil && status.Code(*err) == codes.AlreadyExists {
			// do not record metrics for already started workspaces
			return
		}

		tpe := api.WorkspaceType_name[int32(req.Type)]
		counter, cErr := m.metrics.totalStartsCounterVec.GetMetricWithLabelValues(tpe, req.Spec.Class)
		if cErr != nil {
			log.WithError(cErr).WithField("type", tpe).Warn("cannot get counter for workspace start metric")
			return
		}
		counter.Inc()
	}(req, &err)

	clog.Info("StartWorkspace")
	reqs, _ := protojson.Marshal(req)
	safeReqs, _ := log.RedactJSON(reqs)
	safeReqsLog := make(map[string]interface{})
	_ = json.Unmarshal(safeReqs, &safeReqsLog)
	clog.WithFields(safeReqsLog).Debug("StartWorkspace request received")

	// Make sure the objects we're about to create do not exist already
	switch req.Type {
	case api.WorkspaceType_IMAGEBUILD:
		wss, err := m.GetWorkspaces(ctx, &api.GetWorkspacesRequest{
			MustMatch: &api.MetadataFilter{
				Owner:       req.Metadata.Owner,
				MetaId:      req.Metadata.MetaId,
				Annotations: req.Metadata.Annotations,
			},
		})
		if err != nil {
			return nil, xerrors.Errorf("cannot start workspace: %w", err)
		}

		if len(wss.Status) >= 1 {
			status := wss.Status[0]
			return &api.StartWorkspaceResponse{
				Url:        status.Spec.Url,
				OwnerToken: status.Metadata.Owner,
			}, nil
		}
	default:
		exists, err := m.workspaceExists(ctx, req.Id)
		if err != nil {
			return nil, xerrors.Errorf("cannot start workspace: %w", err)
		}
		if exists {
			return nil, status.Error(codes.AlreadyExists, "workspace instance already exists")
		}
	}

	span.LogKV("event", "workspace does not exist")
	err = validateStartWorkspaceRequest(req)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid start workspace request: %v", err)
	}
	span.LogKV("event", "validated workspace start request")
	// create the objects required to start the workspace pod/service
	startContext, err := m.newStartWorkspaceContext(ctx, req)
	if err != nil {
		return nil, xerrors.Errorf("cannot create context: %w", err)
	}
	span.LogKV("event", "created start workspace context")
	clog.Debug("starting new workspace")

	// create a Pod object for the workspace
	pod, err := m.createWorkspacePod(startContext)
	if err != nil {
		return nil, xerrors.Errorf("cannot create workspace pod: %w", err)
	}
	span.LogKV("event", "pod created", "name", pod.Name, "namespace", pod.Namespace)

	var (
		createPVC          bool
		pvc                *corev1.PersistentVolumeClaim
		startTime, endTime time.Time // the start time and end time of PVC restoring from VolumeSnapshot
	)
	_, createPVC = pod.Labels[pvcWorkspaceFeatureLabel]

	if createPVC {
		if startContext.VolumeSnapshot != nil && startContext.VolumeSnapshot.VolumeSnapshotName != "" {
			var volumeSnapshot volumesnapshotv1.VolumeSnapshot
			err = m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: startContext.VolumeSnapshot.VolumeSnapshotName}, &volumeSnapshot)
			if k8serr.IsNotFound(err) {
				// restore volume snapshot from handle
				err = m.restoreVolumeSnapshotFromHandle(ctx, req.Type, startContext.VolumeSnapshot.VolumeSnapshotName, startContext.VolumeSnapshot.VolumeSnapshotHandle)
				if err != nil {
					clog.WithError(err).Error("was unable to restore volume snapshot")
					return nil, err
				}

				// get again to update the volumeSnapshot variable
				if err := m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: startContext.VolumeSnapshot.VolumeSnapshotName}, &volumeSnapshot); err != nil {
					return nil, err
				}
			} else if err != nil {
				clog.WithError(err).Error("was unable to get volume snapshot")
				return nil, err
			}

			// check the PVC size is not less than the volume snapshot size
			PVCConfig := m.Config.WorkspaceClasses[config.DefaultWorkspaceClass].PVC
			if startContext.Class != nil {
				PVCConfig = startContext.Class.PVC
			}

			if volumeSnapshot.Status != nil &&
				volumeSnapshot.Status.RestoreSize != nil &&
				PVCConfig.Size.Cmp(*volumeSnapshot.Status.RestoreSize) == -1 {
				return nil, xerrors.Errorf("cannot restore volume snapshot from size %s to pvc size %s", volumeSnapshot.Status.RestoreSize.String(), PVCConfig.Size.String())
			}
		}

		// create PVC object
		pvc, err = m.createPVCForWorkspacePod(startContext)
		if err != nil {
			return nil, xerrors.Errorf("cannot create pvc for workspace pod: %w", err)
		}
		err = m.Clientset.Create(ctx, pvc)
		if err != nil && !k8serr.IsAlreadyExists(err) {
			return nil, xerrors.Errorf("cannot create pvc object for workspace pod: %w", err)
		}
		// we only calculate the time that PVC restoring from VolumeSnapshot
		if startContext.VolumeSnapshot != nil && startContext.VolumeSnapshot.VolumeSnapshotName != "" {
			startTime = time.Now()
		}
	}

	secrets, _ := buildWorkspaceSecrets(startContext.Request.Spec)

	// This call actually modifies the initializer and removes the secrets.
	// Prior to the `InitWorkspace` call, we inject the secrets back into the initializer.
	// We do this so that no Git token is stored as annotation on the pod, but solely
	// remains within the Kubernetes secret.
	_ = csapi.ExtractAndReplaceSecretsFromInitializer(startContext.Request.Spec.Initializer)

	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName(startContext.Request),
			Namespace: m.Config.Namespace,
			Labels:    startContext.Labels,
		},
		StringData: secrets,
	}
	err = m.Clientset.Create(ctx, secret)
	if err != nil && !k8serr.IsAlreadyExists(err) {
		return nil, xerrors.Errorf("cannot create secret for workspace pod: %w", err)
	}

	err = waitForSecretInNamespace(m.Clientset, m.Config.Namespace, podName(startContext.Request))
	if err != nil && !k8serr.IsAlreadyExists(err) {
		return nil, xerrors.Errorf("timeout waiting for secret required by workspace pod: %w", err)
	}

	err = m.Clientset.Create(ctx, pod)
	if err != nil {
		m, _ := json.Marshal(pod)
		safePod, _ := log.RedactJSON(m)

		if k8serr.IsAlreadyExists(err) {
			clog.WithError(err).WithField("pod", string(safePod)).Warn("was unable to start workspace which already exists")
			return nil, status.Error(codes.AlreadyExists, "workspace instance already exists")
		}

		clog.WithError(err).WithField("pod", string(safePod)).Warn("was unable to create workspace pod")
		return nil, err
	}

	// if we reach this point the pod is created
	err = wait.PollImmediateWithContext(ctx, 100*time.Millisecond, 7*time.Minute, podRunning(m.Clientset, pod.Name, pod.Namespace))
	if err != nil {
		clog.WithError(err).WithField("pod", pod.Name).Warn("workspace pod did not transition to running state")
		if err == wait.ErrWaitTimeout && isPodUnschedulable(m.Clientset, pod.Name, pod.Namespace) {
			// this could be an error due to a scale-up event
			// delete the PVC object if present
			delErr := m.deleteWorkspacePVC(ctx, pod.Name)
			if delErr != nil {
				clog.WithError(delErr).WithField("pvc", pod.Name).Warn("was unable to delete workspace pvc")
				// do not return error to run the following logic
			}

			// force delete the workspace pod by removing the finalizer
			delErr = deleteWorkspacePodForce(m.Clientset, pod.Name, pod.Namespace)
			if delErr != nil {
				clog.WithError(delErr).WithField("pod", pod.Name).Warn("was unable to delete workspace pod")
				return nil, xerrors.Errorf("workspace pod never reached Running state: %w", err)
			}

			// invoke StartWorkspace passing the remaining execution time in the context
			ctx := context.Background()
			remainingTime := startWorkspaceTimeout - time.Since(startWorkspaceTime)
			ctx = context.WithValue(ctx, ctxKeyRemainingTime{}, remainingTime)
			return m.StartWorkspace(ctx, req)
		}

		return nil, xerrors.Errorf("workspace pod never reached Running state: %w", err)
	}

	// we only calculate the time that PVC restoring from VolumeSnapshot
	if createPVC {
		err = m.Clientset.Get(ctx, types.NamespacedName{Namespace: pod.Namespace, Name: pod.Name}, pod)
		if err != nil {
			return nil, xerrors.Errorf("unable to get workspace pod %s: %w", pod.Name, err)
		}

		err = wait.PollImmediateWithContext(ctx, 100*time.Millisecond, 5*time.Minute, pvcRunning(m.Clientset, pvc.Name, pvc.Namespace))
		if err != nil {
			if startContext.VolumeSnapshot != nil && startContext.VolumeSnapshot.VolumeSnapshotName != "" {
				m.eventRecorder.Eventf(pod, corev1.EventTypeWarning, "PersistentVolumeClaim", "PVC %q restore from volume snapshot %q failed %v", pvc.Name, startContext.VolumeSnapshot.VolumeSnapshotName, err)
				clog.WithError(err).Warnf("unexpected error waiting for PVC %s volume snapshot %s", pvc.Name, startContext.VolumeSnapshot.VolumeSnapshotName)
			} else {
				m.eventRecorder.Eventf(pod, corev1.EventTypeWarning, "PersistentVolumeClaim", "PVC %q create failed %v", pvc.Name, err)
				clog.WithError(err).Warnf("unexpected error waiting for PVC %s", pvc.Name)
			}
		} else {
			if startContext.VolumeSnapshot != nil && startContext.VolumeSnapshot.VolumeSnapshotName != "" {
				m.eventRecorder.Eventf(pod, corev1.EventTypeNormal, "PersistentVolumeClaim", "PVC %q restored from volume snapshot %q successfully", pvc.Name, startContext.VolumeSnapshot.VolumeSnapshotName)

				wsType := api.WorkspaceType_name[int32(req.Type)]
				hist, err := m.metrics.volumeRestoreTimeHistVec.GetMetricWithLabelValues(wsType, req.Spec.Class)
				if err != nil {
					clog.WithError(err).WithField("type", wsType).Warn("cannot get volume restore time histogram metric")
				} else if endTime.IsZero() {
					endTime = time.Now()
					hist.Observe(endTime.Sub(startTime).Seconds())
				}
			} else {
				m.eventRecorder.Eventf(pod, corev1.EventTypeNormal, "PersistentVolumeClaim", "PVC %q created successfully", pvc.Name)
			}
		}
	}

	// remove annotation to signal that workspace pod was indeed created and scheduled on the node
	err = m.markWorkspace(ctx, req.Id, deleteMark(attemptingToCreatePodAnnotation))
	if err != nil {
		clog.WithError(err).WithField("pod.Namespace", pod.Namespace).WithField("pod.Name", pod.Name).Error("failed to remove annotation after creating workspace pod. this will break things")
		return nil, xerrors.Errorf("couldn't remove annotation after creating workspace pod: %w", err)
	}

	span.LogKV("event", "pod started successfully")

	// all workspaces get a service now
	okResponse := &api.StartWorkspaceResponse{
		Url:        startContext.WorkspaceURL,
		OwnerToken: startContext.OwnerToken,
	}

	return okResponse, nil
}

func buildWorkspaceSecrets(spec *api.StartWorkspaceSpec) (secrets map[string]string, secretsLen int) {
	secrets = make(map[string]string)
	for _, env := range spec.Envvars {
		if env.Secret != nil {
			continue
		}
		if !isProtectedEnvVar(env.Name, spec.SysEnvvars) {
			continue
		}

		name := fmt.Sprintf("%x", sha256.Sum256([]byte(env.Name)))
		secrets[name] = env.Value
		secretsLen += len(env.Value)
	}
	for k, v := range csapi.GatherSecretsFromInitializer(spec.Initializer) {
		secrets[k] = v
		secretsLen += len(v)
	}
	return secrets, secretsLen
}

func (m *Manager) restoreVolumeSnapshotFromHandle(ctx context.Context, wsType api.WorkspaceType, id, handle string) (err error) {
	span, ctx := tracing.FromContext(ctx, "restoreVolumeSnapshotFromHandle")
	defer tracing.FinishSpan(span, &err)

	// restore is a two step process
	// 1. create volume snapshot referencing not yet created volume snapshot content
	// 2. create volume snapshot content referencing volume snapshot
	// this creates correct bidirectional binding between those two

	// todo(pavel): figure out if there is a way to find out which snapshot class we need to use here. For now use default class info.
	var volumeSnapshotClassName string
	switch wsType {
	case api.WorkspaceType_PREBUILD:
		if m.Config.WorkspaceClasses[config.DefaultWorkspaceClass].PrebuildPVC.SnapshotClass != "" {
			volumeSnapshotClassName = m.Config.WorkspaceClasses[config.DefaultWorkspaceClass].PrebuildPVC.SnapshotClass
		}
	case api.WorkspaceType_REGULAR:
		if m.Config.WorkspaceClasses[config.DefaultWorkspaceClass].PVC.SnapshotClass != "" {
			volumeSnapshotClassName = m.Config.WorkspaceClasses[config.DefaultWorkspaceClass].PVC.SnapshotClass
		}
	}

	var volumeSnapshotClass volumesnapshotv1.VolumeSnapshotClass
	err = m.Clientset.Get(ctx, types.NamespacedName{Namespace: "", Name: volumeSnapshotClassName}, &volumeSnapshotClass)
	if err != nil {
		return fmt.Errorf("was unable to get volume snapshot class: %v", err)
	}

	snapshotContentName := "restored-" + id
	volumeSnapshot := &volumesnapshotv1.VolumeSnapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:        id,
			Namespace:   m.Config.Namespace,
			Annotations: map[string]string{workspaceIDAnnotation: id},
		},
		Spec: volumesnapshotv1.VolumeSnapshotSpec{
			Source: volumesnapshotv1.VolumeSnapshotSource{
				VolumeSnapshotContentName: &snapshotContentName,
			},
		},
	}
	if volumeSnapshotClassName != "" {
		volumeSnapshot.Spec.VolumeSnapshotClassName = &volumeSnapshotClassName
	}

	err = m.Clientset.Create(ctx, volumeSnapshot)
	if err != nil && !k8serr.IsAlreadyExists(err) {
		return fmt.Errorf("cannot create volumesnapshot: %v", err)
	}

	volumeSnapshotContent := &volumesnapshotv1.VolumeSnapshotContent{
		ObjectMeta: metav1.ObjectMeta{
			Name:      snapshotContentName,
			Namespace: "", // content is not namespaced
		},
		Spec: volumesnapshotv1.VolumeSnapshotContentSpec{
			VolumeSnapshotRef: corev1.ObjectReference{
				Kind:      "VolumeSnapshot",
				Name:      id,
				Namespace: m.Config.Namespace,
			},
			DeletionPolicy: "Delete",
			Source: volumesnapshotv1.VolumeSnapshotContentSource{
				SnapshotHandle: &handle,
			},
			Driver: volumeSnapshotClass.Driver,
		},
	}

	err = m.Clientset.Create(ctx, volumeSnapshotContent)
	if err != nil && !k8serr.IsAlreadyExists(err) {
		return fmt.Errorf("cannot create volumesnapshotcontent: %v", err)
	}

	return nil
}

func (m *Manager) DeleteVolumeSnapshot(ctx context.Context, req *api.DeleteVolumeSnapshotRequest) (res *api.DeleteVolumeSnapshotResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "DeleteVolumeSnapshot")
	tracing.LogRequestSafe(span, req)
	defer tracing.FinishSpan(span, &err)
	log := log.WithField("func", "DeleteVolumeSnapshot")

	okResponse := &api.DeleteVolumeSnapshotResponse{}

	var volumeSnapshot volumesnapshotv1.VolumeSnapshot
	err = m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: req.Id}, &volumeSnapshot)
	if k8serr.IsNotFound(err) {
		if !req.SoftDelete {
			err = m.restoreVolumeSnapshotFromHandle(ctx, req.WsType, req.Id, req.VolumeHandle)
			if err != nil {
				log.WithError(err).Error("was unable to restore volume snapshot")
				return nil, err
			}
		} else {
			return okResponse, nil
		}
	} else if err != nil {
		log.WithError(err).Error("was unable to get volume snapshot")
		return nil, err
	}

	err = m.Clientset.Delete(ctx,
		&volumesnapshotv1.VolumeSnapshot{
			ObjectMeta: metav1.ObjectMeta{
				Name:      req.Id,
				Namespace: m.Config.Namespace,
			},
		},
	)
	if err != nil && !k8serr.IsNotFound(err) {
		log.WithError(err).Errorf("failed to delete volume snapshot `%s`", req.Id)
		return nil, err
	}
	if !k8serr.IsNotFound(err) {
		okResponse.WasDeleted = true
	}

	return okResponse, nil
}

func pvcRunning(clientset client.Client, pvcName, namespace string) wait.ConditionWithContextFunc {
	return func(ctx context.Context) (bool, error) {
		var pvc corev1.PersistentVolumeClaim
		err := clientset.Get(ctx, types.NamespacedName{Namespace: namespace, Name: pvcName}, &pvc)
		if err != nil {
			return false, nil
		}
		if pvc.Status.Phase == corev1.ClaimBound {
			return true, nil
		}
		return false, nil
	}
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
		return xerrors.Errorf("invalid request: %w", err)
	}

	if _, secretsLen := buildWorkspaceSecrets(req.Spec); secretsLen > maxSecretsLength {
		return xerrors.Errorf("secrets exceed maximum permitted length (%d > %d bytes): please reduce the numer or length of environment variables", secretsLen, maxSecretsLength)
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

func podRunning(clientset client.Client, podName, namespace string) wait.ConditionWithContextFunc {
	return func(ctx context.Context) (bool, error) {
		var pod corev1.Pod
		err := clientset.Get(ctx, types.NamespacedName{Namespace: namespace, Name: podName}, &pod)
		if err != nil {
			return false, nil
		}

		switch pod.Status.Phase {
		case corev1.PodFailed:
			if strings.HasPrefix(pod.Status.Reason, "OutOf") {
				return false, xerrors.Errorf("cannot schedule pod due to out of resources, reason: %s", pod.Status.Reason)
			}
			return false, fmt.Errorf("pod failed with reason: %s", pod.Status.Reason)
		case corev1.PodSucceeded:
			return false, fmt.Errorf("pod ran to completion")
		case corev1.PodPending:
			for _, c := range pod.Status.Conditions {
				if c.Type == corev1.PodScheduled && c.Status == corev1.ConditionTrue {
					// even if pod is pending but was scheduled already, it means kubelet is pulling images and running init containers
					// we can consider this as pod running
					return true, nil
				}
			}
			// if pod is pending, wait for it to get scheduled
			return false, nil
		case corev1.PodRunning:
			return true, nil
		}

		return false, xerrors.Errorf("pod in unknown state: %s", pod.Status.Phase)
	}
}

func isPodUnschedulable(clientset client.Client, podName, namespace string) bool {
	var pod corev1.Pod
	err := clientset.Get(context.Background(), types.NamespacedName{Namespace: namespace, Name: podName}, &pod)
	if err != nil {
		return false
	}

	if pod.Status.Phase != corev1.PodPending {
		return false
	}

	for _, c := range pod.Status.Conditions {
		if c.Type == corev1.PodScheduled &&
			c.Status == corev1.ConditionFalse &&
			c.Reason == corev1.PodReasonUnschedulable {
			return true
		}
	}

	return false
}

func deleteWorkspacePodForce(clientset client.Client, name, namespace string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var pod corev1.Pod
	err := clientset.Get(ctx, types.NamespacedName{Namespace: namespace, Name: name}, &pod)
	if err != nil {
		if k8serr.IsNotFound(err) {
			return nil
		}

		return err
	}

	// we successfully got the pod, now we attempt to remove finalizer
	pod.Finalizers = []string{}
	err = clientset.Update(ctx, &pod)
	if err != nil {
		if k8serr.IsNotFound(err) {
			return nil
		}

		return err
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
	if m.Config.MaintenanceMode {
		return &api.StopWorkspaceResponse{}, status.Error(codes.FailedPrecondition, "under maintenance mode")
	}

	span, ctx := tracing.FromContext(ctx, "StopWorkspace")
	owi := log.OWI("", "", req.Id)
	tracing.ApplyOWI(span, owi)
	defer tracing.FinishSpan(span, &err)

	clog := log.WithFields(owi)
	clog.Info("StopWorkspace")

	gracePeriod := stopWorkspaceNormallyGracePeriod
	if req.Policy == api.StopWorkspacePolicy_IMMEDIATELY {
		span.LogKV("policy", "immediately")
		gracePeriod = stopWorkspaceImmediatelyGracePeriod
	} else if req.Policy == api.StopWorkspacePolicy_ABORT {
		span.LogKV("policy", "abort")
		gracePeriod = stopWorkspaceImmediatelyGracePeriod
		err = m.markWorkspace(ctx, req.Id, addMark(abortRequestAnnotation, util.BooleanTrueString))
		if err != nil {
			clog.WithError(err).Error("failed to mark workspace for abort")
		}
	}

	err = m.markWorkspace(ctx, req.Id, addMark(stoppedByRequestAnnotation, gracePeriod.String()))
	if err != nil {
		return nil, err
	}

	return &api.StopWorkspaceResponse{}, nil
}

// stopWorkspace stops a workspace. If the workspace is already stopping, this is a noop
func (m *Manager) stopWorkspace(ctx context.Context, workspaceID string, gracePeriod time.Duration) (err error) {
	if m.Config.MaintenanceMode {
		log.WithFields(log.OWI("", "", workspaceID)).Info("under maintenance mode")
		return nil
	}

	span, ctx := tracing.FromContext(ctx, "stopWorkspace")
	defer tracing.FinishSpan(span, &err)
	span.LogKV("workspaceID", workspaceID)

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

	gracePeriodSeconds := int64(gracePeriod.Seconds())
	propagationPolicy := metav1.DeletePropagationForeground

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

	return nil
}

func (m *Manager) deleteWorkspacePVC(ctx context.Context, pvcName string) error {
	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: m.Config.Namespace,
		},
	}
	err := m.Clientset.Delete(ctx, pvc)
	if k8serr.IsNotFound(err) {
		err = nil
	}
	if err != nil {
		return xerrors.Errorf("cannot delete workspace pvc: %w", err)
	}
	return nil
}

func (m *Manager) deleteWorkspaceSecrets(ctx context.Context, podName string) error {
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: m.Config.Namespace,
		},
	}
	err := m.Clientset.Delete(ctx, secret)
	if k8serr.IsNotFound(err) {
		err = nil
	}
	if err != nil {
		return xerrors.Errorf("cannot delete workspace secrets: %w", err)
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
//
//nolint:unused,deadcode
func getPodID(workspaceType, workspaceID string) string {
	return fmt.Sprintf("%s-%s", strings.TrimSpace(strings.ToLower(workspaceType)), strings.TrimSpace(workspaceID))
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
	_, hasFirstUserActivityAnnotation := pod.Annotations[firstUserActivityAnnotation]

	// if user already mark workspace as active and this request has IgnoreIfActive flag, just simple ignore it
	if hasFirstUserActivityAnnotation && req.IgnoreIfActive {
		return &api.MarkActiveResponse{}, nil
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
	if !hasFirstUserActivityAnnotation {
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

	// dunno why in k8s IP ports are int32 not uint16
	port := req.Spec.Port

	err = retry.RetryOnConflict(retry.DefaultBackoff, func() (err error) {
		pod, err := m.findWorkspacePod(ctx, req.Id)
		if err != nil {
			return xerrors.Errorf("cannot find workspace: %w", err)
		}
		if pod == nil {
			return status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
		}
		tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))

		exposedPorts := extractExposedPorts(pod)
		existingPortSpecIdx := -1
		for i, p := range exposedPorts.Ports {
			if p.Port == port {
				existingPortSpecIdx = i
				break
			}
		}

		servicePrefix, ok := pod.Annotations[servicePrefixAnnotation]
		if !ok || servicePrefix == "" {
			return xerrors.Errorf("workspace pod %s has no service prefix annotation", pod.Name)
		}

		if req.Expose && existingPortSpecIdx < 0 {
			// port is not exposed yet - patch the pod
			url, err := config.RenderWorkspacePortURL(m.Config.WorkspacePortURLTemplate, config.PortURLContext{
				Host:          m.Config.GitpodHostURL,
				ID:            req.Id,
				IngressPort:   fmt.Sprint(port),
				Prefix:        servicePrefix,
				WorkspacePort: fmt.Sprint(port),
			})
			if err != nil {
				return xerrors.Errorf("cannot render public URL for %d: %w", port, err)
			}

			portSpec := &api.PortSpec{
				Port:       uint32(port),
				Visibility: req.Spec.Visibility,
				Url:        url,
			}

			exposedPorts.Ports = append(exposedPorts.Ports, portSpec)
		} else if req.Expose && existingPortSpecIdx >= 0 {
			exposedPorts.Ports[existingPortSpecIdx].Visibility = req.Spec.Visibility
		} else if !req.Expose && existingPortSpecIdx < 0 {
			// port isn't exposed already - we're done here
			return nil
		} else if !req.Expose && existingPortSpecIdx >= 0 {
			// port is exposed but shouldn't be - remove it from the port list
			exposedPorts.Ports = append(exposedPorts.Ports[:existingPortSpecIdx], exposedPorts.Ports[existingPortSpecIdx+1:]...)
		}

		// update pod annotation
		data, err := exposedPorts.ToBase64()
		if err != nil {
			return xerrors.Errorf("cannot update status: %w", err)
		}

		if pod.Annotations[wsk8s.WorkspaceExposedPorts] != data {
			log.WithField("ports", exposedPorts).Debug("updating exposed ports")
			pod.Annotations[wsk8s.WorkspaceExposedPorts] = data

			// update pod
			err = m.Clientset.Update(ctx, pod)
			if err != nil {
				// do not wrap error so we don't break the retry mechanism
				return err
			}
		}

		// by modifying the ports service we have changed the workspace status. However, this status change is not propagated
		// through the regular monitor mechanism as we did not modify the pod itself. We have to send out a status update
		// outselves. Doing it ourselves lets us synchronize the status update with probing for actual availability, not just
		// the service modification in Kubernetes.
		wso := workspaceObjects{Pod: pod}
		err = m.completeWorkspaceObjects(ctx, &wso)
		if err != nil {
			return xerrors.Errorf("cannot update status: %w", err)
		}
		status, err := m.getWorkspaceStatus(wso)
		if err != nil {
			return xerrors.Errorf("cannot update status: %w", err)
		}
		m.OnChange(ctx, status)

		return nil
	})

	return &api.ControlPortResponse{}, err
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

// UpdateSSHKey update ssh keys
func (m *Manager) UpdateSSHKey(ctx context.Context, req *api.UpdateSSHKeyRequest) (res *api.UpdateSSHKeyResponse, err error) {
	span, ctx := tracing.FromContext(ctx, "UpdateSSHKey")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	err = retry.RetryOnConflict(retry.DefaultBackoff, func() (err error) {
		pod, err := m.findWorkspacePod(ctx, req.Id)
		if err != nil {
			return status.Errorf(codes.NotFound, "cannot find workspace: %v", err)
		}
		if pod == nil {
			return status.Errorf(codes.NotFound, "workspace %s does not exist", req.Id)
		}
		tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))

		// update pod annotation
		rspec, err := proto.Marshal(&api.SSHPublicKeys{
			Keys: req.Keys,
		})
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "cannot serialise SSH keys: %v", err)
		}
		data := base64.StdEncoding.EncodeToString(rspec)

		if pod.Annotations[wsk8s.WorkspaceSSHPublicKeys] != data {
			pod.Annotations[wsk8s.WorkspaceSSHPublicKeys] = data
			// update pod
			err = m.Clientset.Update(ctx, pod)
			if err != nil {
				// do not wrap error so we don't break the retry mechanism
				return err
			}
		}
		return nil
	})

	return &api.UpdateSSHKeyResponse{}, err
}

func (m *Manager) DescribeCluster(ctx context.Context, req *api.DescribeClusterRequest) (*api.DescribeClusterResponse, error) {
	span, _ := tracing.FromContext(ctx, "DescribeCluster")
	defer tracing.FinishSpan(span, nil)

	classes := make([]*api.WorkspaceClass, len(m.Config.WorkspaceClasses))

	i := 0
	for id, class := range m.Config.WorkspaceClasses {
		classes[i] = &api.WorkspaceClass{
			Id:          id,
			DisplayName: class.Name,
		}
		i += 1
	}

	return &api.DescribeClusterResponse{
		WorkspaceClasses: classes,
	}, nil
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
	clog := log.WithFields(log.OWI(status.Metadata.Owner, status.Metadata.MetaId, status.Id))

	header := make(map[string]string)
	span := opentracing.SpanFromContext(ctx)
	if span != nil {
		tracingHeader := make(opentracing.HTTPHeadersCarrier)
		err := opentracing.GlobalTracer().Inject(span.Context(), opentracing.HTTPHeaders, tracingHeader)
		if err != nil {
			// if the error was caused by the span coming from the Noop tracer - ignore it.
			// This can happen if the workspace doesn't have a span associated with it, then we resort to creating Noop spans.
			if _, isNoopTracer := span.Tracer().(opentracing.NoopTracer); !isNoopTracer {
				clog.WithError(err).Debug("unable to extract tracing information - trace will be broken")
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
		wsoIndex = make(map[string]*workspaceObjects)
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
		return nil, xerrors.Errorf("workspace without a valid node name")
	}

	var podList corev1.PodList
	err = m.Clientset.List(ctx, &podList,
		&client.ListOptions{
			Namespace: m.Config.Namespace,
			LabelSelector: labels.SelectorFromSet(labels.Set{
				"component": "ws-daemon",
				"app":       "gitpod",
			}),
		},
	)
	if err != nil {
		return nil, xerrors.Errorf("unexpected error searching for Gitpod ws-daemon pod: %w", err)
	}

	// find the ws-daemon on this node
	var hostIP string
	for _, pod := range podList.Items {
		if pod.Spec.NodeName == nodeName {
			hostIP = pod.Status.PodIP
			break
		}
	}

	if hostIP == "" {
		return nil, xerrors.Errorf("no running ws-daemon pod found")
	}
	conn, err := m.wsdaemonPool.Get(hostIP)
	if err != nil {
		return nil, xerrors.Errorf("unexpected error creating connection to Gitpod ws-daemon: %w", err)
	}

	return wsdaemon.NewWorkspaceContentServiceClient(conn), nil
}

func (m *Manager) createWorkspaceSnapshotFromPVC(ctx context.Context, pvcName string, pvcVolumeSnapshotName string, pvcVolumeSnapshotClassName string, workspaceID string, labels map[string]string) error {
	// create snapshot object out of PVC
	volumeSnapshot := &volumesnapshotv1.VolumeSnapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:        pvcVolumeSnapshotName,
			Namespace:   m.Config.Namespace,
			Annotations: map[string]string{workspaceIDAnnotation: workspaceID},
			Labels:      labels,
		},
		Spec: volumesnapshotv1.VolumeSnapshotSpec{
			Source: volumesnapshotv1.VolumeSnapshotSource{
				PersistentVolumeClaimName: &pvcName,
			},
			VolumeSnapshotClassName: &pvcVolumeSnapshotClassName,
		},
	}

	err := m.Clientset.Create(ctx, volumeSnapshot)
	if err != nil && !k8serr.IsAlreadyExists(err) {
		err = xerrors.Errorf("cannot create volumesnapshot: %v", err)
		return err
	}
	return nil
}

func (m *Manager) waitForWorkspaceVolumeSnapshotReady(ctx context.Context, pvcVolumeSnapshotName string, log *logrus.Entry) (pvcVolumeSnapshotContentName string, readyVolumeSnapshot bool, err error) {
	log = log.WithField("VolumeSnapshot.Name", pvcVolumeSnapshotName)

	var volumeSnapshotWatcher *watchtools.RetryWatcher
	volumeSnapshotWatcher, err = watchtools.NewRetryWatcher("1", &cache.ListWatch{
		WatchFunc: func(options metav1.ListOptions) (watch.Interface, error) {
			return m.VolumeSnapshotClient.SnapshotV1().VolumeSnapshots(m.Config.Namespace).Watch(ctx, metav1.ListOptions{
				FieldSelector: fields.OneTermEqualSelector("metadata.name", pvcVolumeSnapshotName).String(),
			})
		},
	})
	if err != nil {
		log.WithError(err).Info("fall back to exponential backoff retry")
		// we can not create a retry watcher, we fall back to exponential backoff retry
		backoff := wait.Backoff{
			Steps:    30,
			Duration: 100 * time.Millisecond,
			Factor:   1.5,
			Jitter:   0.1,
			Cap:      10 * time.Minute,
		}
		err = wait.ExponentialBackoff(backoff, func() (bool, error) {
			var vs volumesnapshotv1.VolumeSnapshot
			err := m.Clientset.Get(ctx, types.NamespacedName{Namespace: m.Config.Namespace, Name: pvcVolumeSnapshotName}, &vs)
			if err != nil {
				if k8serr.IsNotFound(err) {
					// volumesnapshot doesn't exist yet, retry again
					return false, nil
				}
				log.WithError(err).Error("was unable to get volume snapshot")
				return false, err
			}
			if vs.Status != nil && vs.Status.ReadyToUse != nil && *vs.Status.ReadyToUse && vs.Status.BoundVolumeSnapshotContentName != nil {
				pvcVolumeSnapshotContentName = *vs.Status.BoundVolumeSnapshotContentName
				return true, nil
			}
			return false, nil
		})
		if err != nil {
			log.WithError(err).Errorf("failed while waiting for volume snapshot to get ready")
			return "", false, err
		}
		readyVolumeSnapshot = true
	} else {
		for event := range volumeSnapshotWatcher.ResultChan() {
			vs, ok := event.Object.(*volumesnapshotv1.VolumeSnapshot)
			if !ok {
				log.Errorf("unexpected type assertion %T", event.Object)
				continue
			}

			if vs != nil && vs.Status != nil && vs.Status.ReadyToUse != nil && *vs.Status.ReadyToUse && vs.Status.BoundVolumeSnapshotContentName != nil {
				pvcVolumeSnapshotContentName = *vs.Status.BoundVolumeSnapshotContentName
				readyVolumeSnapshot = true
				break
			}
		}

		// stop the volume snapshot retry watcher
		volumeSnapshotWatcher.Stop()
	}

	return pvcVolumeSnapshotContentName, readyVolumeSnapshot, nil
}

// newWssyncConnectionFactory creates a new wsdaemon connection factory based on the wsmanager configuration
func newWssyncConnectionFactory(managerConfig config.Configuration) (grpcpool.Factory, error) {
	cfg := managerConfig.WorkspaceDaemon
	// TODO(cw): add client-side gRPC metrics
	grpcOpts := common_grpc.DefaultClientOptions()
	if cfg.TLS.Authority != "" || cfg.TLS.Certificate != "" && cfg.TLS.PrivateKey != "" {
		tlsConfig, err := common_grpc.ClientAuthTLSConfig(
			cfg.TLS.Authority, cfg.TLS.Certificate, cfg.TLS.PrivateKey,
			common_grpc.WithSetRootCAs(true),
			common_grpc.WithServerName("wsdaemon"),
		)
		if err != nil {
			log.WithField("config", cfg.TLS).Error("Cannot load ws-manager certs - this is a configuration issue.")
			return nil, xerrors.Errorf("cannot load ws-manager certs: %w", err)
		}

		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	} else {
		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
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

func checkWSDaemonEndpoint(namespace string, clientset client.Client) func(string) bool {
	return func(address string) bool {
		var podList corev1.PodList
		err := clientset.List(context.Background(), &podList,
			&client.ListOptions{
				Namespace: namespace,
				LabelSelector: labels.SelectorFromSet(labels.Set{
					"component": "ws-daemon",
					"app":       "gitpod",
				}),
			},
		)
		if err != nil {
			log.WithError(err).Error("cannot list ws-daemon pods")
			return false
		}

		for _, pod := range podList.Items {
			if pod.Status.PodIP == address {
				return true
			}
		}

		return false
	}
}

func extractExposedPorts(pod *corev1.Pod) *api.ExposedPorts {
	if data, ok := pod.Annotations[wsk8s.WorkspaceExposedPorts]; ok {
		ports, _ := api.ExposedPortsFromBase64(data)
		return ports
	}

	return &api.ExposedPorts{}
}

func waitForSecretInNamespace(client client.Client, namespace, name string) error {
	return wait.Poll(200*time.Millisecond, 1*time.Minute, secretInNamespace(client, namespace, name))
}

func secretInNamespace(client client.Client, namespace, name string) wait.ConditionFunc {
	return func() (bool, error) {
		var secret corev1.Secret
		err := client.Get(context.TODO(), types.NamespacedName{Namespace: namespace, Name: name}, &secret)
		if k8serr.IsNotFound(err) {
			return false, nil
		}

		if err != nil {
			return false, err
		}

		return true, nil
	}
}
