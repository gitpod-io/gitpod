// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	wsdaemon "github.com/gitpod-io/gitpod/ws-daemon/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager-mk2/api/v1"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/grpcpool"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

const (
	// wsdaemonMaxAttempts is the number of times we'll attempt to work with ws-daemon when a former attempt returned unavailable.
	// We rety for two minutes every 5 seconds (see wwsdaemonRetryInterval).
	//
	// Note: this is a variable rather than a constant so that tests can modify this value.
	wsdaemonMaxAttempts = 120 / 5

	// wsdaemonRetryInterval is the time in between attempts to work with ws-daemon.
	//
	// Note: this is a variable rather than a constant so that tests can modify this value.
	wsdaemonRetryInterval = 5 * time.Second

	// wsdaemonDialTimeout is the time we allow for trying to connect to ws-daemon.
	// Note: this is NOT the time we allow for RPC calls to wsdaemon, but just for establishing the connection.
	wsdaemonDialTimeout = 10 * time.Second
)

func NewWorkspaceReconciler(c client.Client, scheme *runtime.Scheme, cfg config.Configuration) (*WorkspaceReconciler, error) {
	wsdaemonConnfactory, err := newWsdaemonConnectionFactory(cfg)
	if err != nil {
		return nil, err
	}

	res := &WorkspaceReconciler{
		Client:         c,
		Scheme:         scheme,
		Config:         cfg,
		initializerMap: make(map[string]struct{}),
		finalizerMap:   make(map[string]context.CancelFunc),
		wsdaemonPool:   grpcpool.New(wsdaemonConnfactory, checkWSDaemonEndpoint(cfg.Namespace, c)),
	}
	res.actingManager = res
	return res, nil
}

// WorkspaceReconciler reconciles a Workspace object
type WorkspaceReconciler struct {
	client.Client
	Scheme *runtime.Scheme

	Config      config.Configuration
	OnReconcile func(ctx context.Context, ws *workspacev1.Workspace)

	wsdaemonPool *grpcpool.Pool

	actingManager      actingManager
	initializerMap     map[string]struct{}
	initializerMapLock sync.Mutex
	finalizerMap       map[string]context.CancelFunc
	finalizerMapLock   sync.Mutex
}

// actingManager contains all functions needed by actOnPodEvent
type actingManager interface {
	// clearInitializerFromMap(podName string)
	initializeWorkspaceContent(ctx context.Context, ws *workspacev1.Workspace) (err error)
	finalizeWorkspaceContent(ctx context.Context, ws *workspacev1.Workspace)
}

//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=workspace.gitpod.io,resources=workspaces/finalizers,verbs=update
//+kubebuilder:rbac:groups=core,resources=pod,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=core,resources=pod/status,verbs=get

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the Workspace object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.11.0/pkg/reconcile
func (r *WorkspaceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := r.Get(ctx, req.NamespacedName, &workspace); err != nil {
		// TODO(cw): create pdo
		log.Error(err, "unable to fetch workspace")
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	log.Info("reconciling workspace", "ws", req.NamespacedName)

	var workspacePods corev1.PodList
	err := r.List(ctx, &workspacePods, client.InNamespace(req.Namespace), client.MatchingFields{wsOwnerKey: req.Name})
	if err != nil {
		log.Error(err, "unable to list workspace pods")
		return ctrl.Result{}, err
	}

	err = updateWorkspaceStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return ctrl.Result{}, err
	}

	result, err := r.actOnStatus(ctx, &workspace, workspacePods)
	if err != nil {
		return result, err
	}

	err = r.Status().Update(ctx, &workspace)
	if err != nil {
		log.Error(err, "unable to update workspace status")
		return ctrl.Result{Requeue: true}, err
	}

	if r.OnReconcile != nil {
		r.OnReconcile(ctx, &workspace)
	}

	return ctrl.Result{}, nil
}

func (r *WorkspaceReconciler) actOnStatus(ctx context.Context, workspace *workspacev1.Workspace, workspacePods corev1.PodList) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	// if there isn't a workspace pod and we're not currently deleting this workspace,
	// create one.
	if len(workspacePods.Items) == 0 && workspace.Status.PodStarts == 0 {
		sctx, err := newStartWorkspaceContext(ctx, &r.Config, workspace)
		if err != nil {
			log.Error(err, "unable to create startWorkspace context")
			return ctrl.Result{Requeue: true}, err
		}

		pod, err := r.createWorkspacePod(sctx)
		if err != nil {
			log.Error(err, "unable to produce workspace pod")
			return ctrl.Result{}, err
		}

		err = r.Create(ctx, pod)
		if errors.IsAlreadyExists(err) {
			// pod exists, we're good
		} else if err != nil {
			log.Error(err, "unable to create Pod for Workspace", "pod", pod)
			return ctrl.Result{Requeue: true}, err
		} else {
			// TODO(cw): replicate the startup mechanism where pods can fail to be scheduled,
			//			 need to be deleted and re-created
			workspace.Status.PodStarts++
		}

		return ctrl.Result{}, nil
	}

	// all actions below assume there is a pod
	if len(workspacePods.Items) == 0 {
		return ctrl.Result{}, nil
	}
	pod := &workspacePods.Items[0]

	switch {
	// if there is a pod, and it's failed, delete it
	case workspace.Status.Conditions.Failed != "" && !isPodBeingDeleted(pod):

		err := r.Client.Delete(ctx, pod)
		if errors.IsNotFound(err) {
			// pod is gone - nothing to do here
		} else {
			return ctrl.Result{Requeue: true}, err
		}

	// pod is creating and sits on a node - start initializing content
	case (workspace.Status.Phase == workspacev1.WorkspacePhaseCreating ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseInitializing):

		go func() {
			err := r.actingManager.initializeWorkspaceContent(ctx, workspace)
			if err == nil {
				return
			}

			// workspace initialization failed, which means the workspace as a whole failed
			msg := err.Error()
			log.Error(err, "unable to initialize workspace")
			err = retry.RetryOnConflict(retry.DefaultBackoff, func() error {
				var ws workspacev1.Workspace
				err := r.Client.Get(ctx, types.NamespacedName{Namespace: r.Config.Namespace, Name: workspace.Name}, &ws)
				if err != nil {
					return err
				}

				ws.Status.Conditions.Failed = msg

				return r.Update(ctx, &ws)
			})
			if err != nil {
				log.Error(err, "was unable to mark workspace as failed")
			}
		}()

	case workspace.Status.Phase == workspacev1.WorkspacePhaseStopping:
		var terminated bool
		for _, c := range pod.Status.ContainerStatuses {
			if c.Name == "workspace" {
				// Note: sometimes container don't enter `terminated`, but `waiting`. The processes are stopped nonetheless,
				//       and we should be running the backup. The only thing that keeps the pod alive, is our finalizer.
				terminated = c.State.Running == nil
				break
			}
		}

		if terminated {
			// We start finalizing the workspace content only after the container is gone. This way we ensure there's
			// no process modifying the workspace content as we create the backup.
			go r.actingManager.finalizeWorkspaceContent(ctx, workspace)
		}

	// we've disposed already - try to remove the finalizer and call it a day
	case workspace.Status.Phase == workspacev1.WorkspacePhaseStopped:
		n := 0
		for _, x := range pod.Finalizers {
			if x != gitpodPodFinalizerName {
				pod.Finalizers[n] = x
				n++
			}
		}
		pod.Finalizers = pod.Finalizers[:n]
		err := r.Client.Update(ctx, pod)
		if err != nil {
			return ctrl.Result{Requeue: true}, err
		}

	}

	return ctrl.Result{}, nil
}

// finalizeWorkspaceContent talks to a ws-daemon daemon on the node of the pod and creates a backup of the workspace content.
func (r *WorkspaceReconciler) finalizeWorkspaceContent(ctx context.Context, workspace *workspacev1.Workspace) {
	log := log.FromContext(ctx)

	var disposalStatus *workspacev1.WorkspaceDisposalStatus
	defer func() {
		if disposalStatus == nil {
			return
		}

		err := retry.RetryOnConflict(retry.DefaultBackoff, func() error {
			var ws workspacev1.Workspace
			err := r.Client.Get(ctx, types.NamespacedName{Namespace: r.Config.Namespace, Name: workspace.Name}, &ws)
			if err != nil {
				return err
			}

			ws.Status.Disposal = disposalStatus
			return r.Client.Update(ctx, &ws)
		})
		if err != nil {
			log.Error(err, "was unable to update pod's disposal state - this will break someone's experience")
		}
	}()

	doBackup := workspace.Status.Conditions.EverReady && !workspace.Status.Headless
	doBackupLogs := workspace.Spec.Type == workspacev1.WorkspaceTypePrebuild
	doSnapshot := workspace.Spec.Type == workspacev1.WorkspaceTypePrebuild
	doFinalize := func() (worked bool, gitStatus *workspacev1.GitStatus, err error) {
		r.finalizerMapLock.Lock()
		_, alreadyFinalizing := r.finalizerMap[workspace.Name]
		if alreadyFinalizing {
			r.finalizerMapLock.Unlock()
			return false, nil, nil
		}

		var hostIP string
		if workspace.Status.Runtime != nil {
			hostIP = workspace.Status.Runtime.HostIP
		}

		// Maybe the workspace never made it to a phase where we actually initialized a workspace.
		// Assuming that once we've had a nodeName we've spoken to ws-daemon it's safe to assume that if
		// we don't have a nodeName we don't need to dipose the workspace.
		// Obviously that only holds if we do not require a backup. If we do require one, we want to
		// fail as loud as we can in this case.
		if !doBackup && !doSnapshot && hostIP == "" {
			// we don't need a backup and have never spoken to ws-daemon: we're good here.
			r.finalizerMapLock.Unlock()
			return true, nil, nil
		}

		// we're not yet finalizing - start the process
		snc, err := r.connectToWorkspaceDaemon(ctx, workspace)
		if err != nil {
			r.finalizerMapLock.Unlock()
			return true, nil, err
		}

		ctx, cancelReq := context.WithTimeout(ctx, time.Duration(r.Config.Timeouts.ContentFinalization))
		r.finalizerMap[workspace.Name] = cancelReq
		r.finalizerMapLock.Unlock()
		defer func() {
			// we're done disposing - remove from the finalizerMap
			r.finalizerMapLock.Lock()
			delete(r.finalizerMap, workspace.Name)
			r.finalizerMapLock.Unlock()
		}()

		if doSnapshot {
			// if this is a prebuild take a snapshot and mark the workspace
			var res *wsdaemon.TakeSnapshotResponse
			res, err = snc.TakeSnapshot(ctx, &wsdaemon.TakeSnapshotRequest{Id: workspace.Name})
			if err != nil {
				log.Error(err, "cannot take snapshot")
				err = xerrors.Errorf("cannot take snapshot: %v", err)
			}

			if res != nil {
				r.modifyWorkspace(ctx, workspace.Name, func(ws *workspacev1.Workspace) error {
					results := ws.Status.Results
					if res == nil {
						results = &workspacev1.WorkspaceResults{}
					}
					results.Snapshot = res.Url
					return nil
				})
				if err != nil {
					log.Error(err, "cannot mark headless workspace with snapshot - that's one prebuild lost")
					err = xerrors.Errorf("cannot remember snapshot: %v", err)
				}
			}
		}

		// DiposeWorkspace will "degenerate" to a simple wait if the finalization/disposal process is already running.
		// This is unlike the initialization process where we wait for things to finish in a later phase.
		resp, err := snc.DisposeWorkspace(ctx, &wsdaemon.DisposeWorkspaceRequest{
			Id:         workspace.Name,
			Backup:     doBackup,
			BackupLogs: doBackupLogs,
		})
		if resp != nil {
			gitStatus = gitStatusfromContentServiceAPI(resp.GitStatus)
		}
		return true, gitStatus, err
	}

	var (
		dataloss    bool
		backupError error
		gitStatus   *workspacev1.GitStatus
	)
	for i := 0; i < wsdaemonMaxAttempts; i++ {
		didSometing, gs, err := doFinalize()
		if !didSometing {
			// someone else is managing finalization process ... we don't have to bother
			return
		}

		// by default we assume the worst case scenario. If things aren't just as bad, we'll tune it down below.
		dataloss = true
		backupError = err
		gitStatus = gs

		// At this point one of three things may have happened:
		//   1. the context deadline was exceeded, e.g. due to misconfiguration (not enough time to upload) or network issues. We'll try again.
		//   2. the service was unavailable, in which case we'll try again.
		//   3. none of the above, in which case we'll give up
		st, isGRPCError := status.FromError(err)
		if !isGRPCError {
			break
		}

		if (err != nil && strings.Contains(err.Error(), context.DeadlineExceeded.Error())) ||
			st.Code() == codes.Unavailable ||
			st.Code() == codes.Canceled {
			// service is currently unavailable or we did not finish in time - let's wait some time and try again
			time.Sleep(wsdaemonRetryInterval)
			continue
		}

		// service was available, we've tried to do the work and failed. Tell the world about it.
		if (doBackup || doSnapshot) && isGRPCError {
			switch st.Code() {
			case codes.DataLoss:
				// ws-daemon told us that it's lost data
				dataloss = true
			case codes.FailedPrecondition:
				// the workspace content was not in the state we thought it was
				dataloss = true
			}
		}
		break
	}

	disposalStatus = &workspacev1.WorkspaceDisposalStatus{
		BackupComplete: true,
		GitStatus:      gitStatus,
	}
	if backupError != nil {
		if dataloss {
			disposalStatus.BackupFailure = backupError.Error()
		} else {
			// internal errors make no difference to the user experience. The backup still worked, we just messed up some
			// state management or cleanup. No need to worry the user.
			log.Error(backupError, "internal error while disposing workspace content")
		}
	}
}

func gitStatusfromContentServiceAPI(s *csapi.GitStatus) *workspacev1.GitStatus {
	return &workspacev1.GitStatus{
		Branch:               s.Branch,
		LatestCommit:         s.LatestCommit,
		UncommitedFiles:      s.UncommitedFiles,
		TotalUncommitedFiles: s.TotalUncommitedFiles,
		UntrackedFiles:       s.UntrackedFiles,
		TotalUntrackedFiles:  s.TotalUntrackedFiles,
		UnpushedCommits:      s.UnpushedCommits,
		TotalUnpushedCommits: s.TotalUnpushedCommits,
	}
}

// connectToWorkspaceDaemon establishes a connection to the ws-daemon daemon running on the node of the pod/workspace.
func (r *WorkspaceReconciler) connectToWorkspaceDaemon(ctx context.Context, workspace *workspacev1.Workspace) (wcsClient wsdaemon.WorkspaceContentServiceClient, err error) {
	var nodeName string
	if workspace.Status.Runtime != nil {
		nodeName = workspace.Status.Runtime.NodeName
	}
	if nodeName == "" {
		return nil, xerrors.Errorf("no nodeName found")
	}

	var podList corev1.PodList
	err = r.Client.List(ctx, &podList,
		&client.ListOptions{
			Namespace: r.Config.Namespace,
			LabelSelector: labels.SelectorFromSet(labels.Set{
				"component": "ws-daemon",
				"app":       "gitpod",
			}),
		},
	)
	if err != nil {
		return nil, err
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
	conn, err := r.wsdaemonPool.Get(hostIP)
	if err != nil {
		return nil, err
	}

	return wsdaemon.NewWorkspaceContentServiceClient(conn), nil
}

// modifyWorkspace modifies a workspace object using the mod function. If the mod function returns a gRPC status error, that error
// is returned directly. If mod returns a non-gRPC error it is turned into one.
func (r *WorkspaceReconciler) modifyWorkspace(ctx context.Context, id string, mod func(ws *workspacev1.Workspace) error) error {
	return retry.RetryOnConflict(retry.DefaultBackoff, func() error {
		var ws workspacev1.Workspace
		err := r.Client.Get(ctx, types.NamespacedName{Namespace: r.Config.Namespace, Name: id}, &ws)
		if err != nil {
			return err
		}

		err = mod(&ws)
		if err != nil {
			return err
		}

		return r.Client.Update(ctx, &ws)
	})
}

// initializeWorkspaceContent talks to a ws-daemon daemon on the node of the pod and initializes the workspace content.
// If we're already initializing the workspace, thus function will return immediately. If we were not initializing,
// prior to this call this function returns once initialization is complete.
func (r *WorkspaceReconciler) initializeWorkspaceContent(ctx context.Context, ws *workspacev1.Workspace) (err error) {
	if ws.Spec.Ownership.Owner == "" {
		return xerrors.Errorf("workspace instance %s has no owner", ws.Name)
	}

	var (
		initializer     csapi.WorkspaceInitializer
		snc             wsdaemon.WorkspaceContentServiceClient
		contentManifest []byte
	)
	// The function below deliniates the initializer lock. It's just there so that we can
	// defer the unlock call, thus making sure we actually call it.
	err = func() error {
		r.initializerMapLock.Lock()
		defer r.initializerMapLock.Unlock()

		_, alreadyInitializing := r.initializerMap[ws.Name]
		if alreadyInitializing {
			return nil
		}

		// There is no need to emit this span if the operation is noop.
		span, ctx := tracing.FromContext(ctx, "initializeWorkspace")
		defer tracing.FinishSpan(span, &err)

		err = proto.Unmarshal(ws.Spec.Initializer, &initializer)
		if err != nil {
			return xerrors.Errorf("cannot unmarshal init config: %w", err)
		}

		// connect to the appropriate ws-daemon
		snc, err = r.connectToWorkspaceDaemon(ctx, ws)
		if err != nil {
			return err
		}

		// mark that we're already initialising this workspace
		r.initializerMap[ws.Name] = struct{}{}

		return nil
	}()
	if err != nil {
		return xerrors.Errorf("cannot initialize workspace: %w", err)
	}
	if err == nil && snc == nil {
		// we are already initialising
		return nil
	}
	_, err = snc.InitWorkspace(ctx, &wsdaemon.InitWorkspaceRequest{
		Id: ws.Name,
		Metadata: &wsdaemon.WorkspaceMetadata{
			Owner:  ws.Spec.Ownership.Owner,
			MetaId: ws.Spec.Ownership.WorkspaceID,
		},
		Initializer:           &initializer,
		FullWorkspaceBackup:   false,
		ContentManifest:       contentManifest,
		RemoteStorageDisabled: ws.Spec.Type == workspacev1.WorkspaceTypeImageBuild,
	})
	if st, ok := status.FromError(err); ok && st.Code() == codes.AlreadyExists {
		// we're already initializing, things are good - we'll wait for it later
		err = nil
	}
	if err != nil {
		return xerrors.Errorf("cannot initialize workspace: %w", err)
	}

	return nil
}

var (
	wsOwnerKey = ".metadata.controller"
	apiGVStr   = workspacev1.GroupVersion.String()
)

// SetupWithManager sets up the controller with the Manager.
func (r *WorkspaceReconciler) SetupWithManager(mgr ctrl.Manager) error {
	idx := func(rawObj client.Object) []string {
		// grab the job object, extract the owner...
		job := rawObj.(*corev1.Pod)
		owner := metav1.GetControllerOf(job)
		if owner == nil {
			return nil
		}
		// ...make sure it's a workspace...
		if owner.APIVersion != apiGVStr || owner.Kind != "Workspace" {
			return nil
		}

		// ...and if so, return it
		return []string{owner.Name}
	}
	err := mgr.GetFieldIndexer().IndexField(context.Background(), &corev1.Pod{}, wsOwnerKey, idx)
	if err != nil {
		return err
	}

	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Workspace{}).
		Owns(&corev1.Pod{}).
		Complete(r)
}

// newWsdaemonConnectionFactory creates a new wsdaemon connection factory based on the wsmanager configuration
func newWsdaemonConnectionFactory(managerConfig config.Configuration) (grpcpool.Factory, error) {
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
			return nil, xerrors.Errorf("cannot load ws-daemon certs: %w", err)
		}

		grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
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
			return nil, xerrors.Errorf("cannot connect to workspace daemon: %w", err)
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
			// log.Error("cannot list ws-daemon pods")
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
