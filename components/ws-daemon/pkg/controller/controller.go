// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	glog "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/logs"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"

	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
)

const (
	// maxPendingChanges is the limit beyond which we no longer report pending changes.
	// For example, if a workspace has then 150 untracked files, we'll report the first
	// 100 followed by "... and 50 more".
	//
	// We do this to keep the load on our infrastructure light and because beyond this number
	// the changes are irrelevant anyways.
	maxPendingChanges = 100
)

type WorkspaceControllerOpts struct {
	NodeName         string
	ContentConfig    content.Config
	UIDMapperConfig  iws.UidmapperConfig
	ContainerRuntime container.Runtime
	CGroupMountPoint string
	MetricsRegistry  prometheus.Registerer
}

type WorkspaceController struct {
	client.Client

	NodeName string

	opts  *WorkspaceControllerOpts
	store *session.Store
	// channel to limit the number of concurrent backups and uploads.
	backupWorkspaceLimiter chan struct{}
	metrics                *content.Metrics
}

func NewWorkspaceController(c client.Client, opts WorkspaceControllerOpts) (*WorkspaceController, error) {
	xfs, err := quota.NewXFS(opts.ContentConfig.WorkingArea)
	if err != nil {
		return nil, err
	}
	store, err := session.NewStore(context.Background(), opts.ContentConfig.WorkingArea, content.WorkspaceLifecycleHooks(
		opts.ContentConfig,
		func(instanceID string) bool { return true },
		&iws.Uidmapper{Config: opts.UIDMapperConfig, Runtime: opts.ContainerRuntime},
		xfs,
		opts.CGroupMountPoint,
	))
	if err != nil {
		return nil, err
	}

	waitingTimeHist, waitingTimeoutCounter, err := content.RegisterConcurrentBackupMetrics(opts.MetricsRegistry)
	if err != nil {
		return nil, err
	}

	return &WorkspaceController{
		Client:   c,
		NodeName: opts.NodeName,
		opts:     &opts,
		store:    store,
		metrics: &content.Metrics{
			BackupWaitingTimeHist:       waitingTimeHist,
			BackupWaitingTimeoutCounter: waitingTimeoutCounter,
		},
	}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (wsc *WorkspaceController) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&workspacev1.Workspace{}).
		Complete(wsc)
}

func (wsc *WorkspaceController) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)

	var workspace workspacev1.Workspace
	if err := wsc.Get(ctx, req.NamespacedName, &workspace); err != nil {
		// we'll ignore not-found errors, since they can't be fixed by an immediate
		// requeue (we'll need to wait for a new notification), and we can get them
		// on deleted requests.
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	// not our workspace
	if workspace.Status.Runtime == nil || workspace.Status.Runtime.NodeName != wsc.NodeName {
		return ctrl.Result{}, nil
	}

	log.WithValues("workspaceID", workspace.Name, "runtime", workspace.Status.Runtime).Info("seen workspace we have to manage")

	if workspace.Status.Phase == workspacev1.WorkspacePhaseCreating ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseInitializing ||
		workspace.Status.Phase == workspacev1.WorkspacePhaseRunning {

		if c := wsk8s.GetCondition(workspace.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil {
			failure, err := wsc.initWorkspaceContent(ctx, &workspace)
			if err != nil {
				return ctrl.Result{}, err
			}

			// we retry because re-init would cause OTS to fail during the CollectRemoteContent run.
			// TODO(cw): make this reentrant
			err = retry.RetryOnConflict(retry.DefaultRetry, func() error {
				var workspace workspacev1.Workspace
				err := wsc.Get(ctx, req.NamespacedName, &workspace)
				if err != nil {
					return err
				}

				if failure != "" {
					workspace.Status.Conditions = wsk8s.AddUniqueCondition(workspace.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionContentReady),
						Status:             metav1.ConditionFalse,
						Message:            failure,
						Reason:             "failed to initialize",
						LastTransitionTime: metav1.Now(),
					})
				} else {
					workspace.Status.Conditions = wsk8s.AddUniqueCondition(workspace.Status.Conditions, metav1.Condition{
						Type:               string(workspacev1.WorkspaceConditionContentReady),
						Status:             metav1.ConditionTrue,
						Message:            "content is ready",
						LastTransitionTime: metav1.Now(),
					})
				}

				return wsc.Status().Update(ctx, &workspace)
			})
			if err != nil {
				return ctrl.Result{}, err
			}
		}
	}

	if workspace.Status.Phase == workspacev1.WorkspacePhaseStopping {
		disposeErr := wsc.disposeWorkspace(ctx, &workspace)

		err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
			var workspace workspacev1.Workspace
			err := wsc.Get(ctx, req.NamespacedName, &workspace)
			if err != nil {
				return err
			}

			if disposeErr != nil {
				workspace.Status.Conditions = wsk8s.AddUniqueCondition(workspace.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionBackupFailure),
					Status:             metav1.ConditionTrue,
					Message:            err.Error(),
					Reason:             "failed to backup",
					LastTransitionTime: metav1.Now(),
				})
			} else {
				workspace.Status.Conditions = wsk8s.AddUniqueCondition(workspace.Status.Conditions, metav1.Condition{
					Type:               string(workspacev1.WorkspaceConditionBackupComplete),
					Status:             metav1.ConditionTrue,
					Message:            "workspace backed up",
					LastTransitionTime: metav1.Now(),
				})
			}

			return wsc.Status().Update(ctx, &workspace)
		})

		if err != nil {
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

func (wsc *WorkspaceController) creator(ws *workspacev1.Workspace, init *csapi.WorkspaceInitializer) session.WorkspaceFactory {
	var checkoutLocation string
	allLocations := csapi.GetCheckoutLocationsFromInitializer(init)
	if len(allLocations) > 0 {
		checkoutLocation = allLocations[0]
	}

	serviceDirName := ws.Name + "-daemon"
	return func(ctx context.Context, location string) (res *session.Workspace, err error) {
		return &session.Workspace{
			Location:              location,
			CheckoutLocation:      checkoutLocation,
			CreatedAt:             time.Now(),
			Owner:                 ws.Spec.Ownership.Owner,
			WorkspaceID:           ws.Spec.Ownership.WorkspaceID,
			InstanceID:            ws.Name,
			FullWorkspaceBackup:   false,
			PersistentVolumeClaim: false,
			RemoteStorageDisabled: ws.Status.Headless,
			// StorageQuota:          int(req.StorageQuotaBytes),

			ServiceLocDaemon: filepath.Join(wsc.opts.ContentConfig.WorkingArea, serviceDirName),
			ServiceLocNode:   filepath.Join(wsc.opts.ContentConfig.WorkingAreaNode, serviceDirName),
		}, nil
	}
}

func (wsc *WorkspaceController) initWorkspaceContent(ctx context.Context, ws *workspacev1.Workspace) (failure string, err error) {
	var initializer csapi.WorkspaceInitializer
	err = proto.Unmarshal(ws.Spec.Initializer, &initializer)
	if err != nil {
		return "bug: cannot unmarshal initializer", xerrors.Errorf("cannot unmarshal init config: %w", err)
	}

	res, err := wsc.store.NewWorkspace(ctx, ws.Name, filepath.Join(wsc.store.Location, ws.Name), wsc.creator(ws, &initializer))
	if errors.Is(err, storage.ErrNotFound) {
		return "", nil
	}

	if err != nil {
		return "bug: cannot add workspace to store", xerrors.Errorf("cannot add workspace to store: %w", err)
	}

	rs, ok := res.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return "bug: workspace has no remote storage", xerrors.Errorf("workspace has no remote storage")
	}
	ps, err := storage.NewPresignedAccess(&wsc.opts.ContentConfig.Storage)
	if err != nil {
		return "bug: no presigned storage available", xerrors.Errorf("no presigned storage available: %w", err)
	}

	remoteContent, err := content.CollectRemoteContent(ctx, rs, ps, ws.Spec.Ownership.Owner, &initializer)
	if err != nil {
		return "remote content error", xerrors.Errorf("remote content error: %w", err)
	}

	// Initialize workspace.
	// FWB workspaces initialize without the help of ws-daemon, but using their supervisor or the registry-facade.
	opts := content.RunInitializerOpts{
		Command: wsc.opts.ContentConfig.Initializer.Command,
		Args:    wsc.opts.ContentConfig.Initializer.Args,
		// This is a bit of a hack as it makes hard assumptions about the nature of the UID mapping.
		// Also, we cannot do this in wsinit because we're dropping all the privileges that would be
		// required for this operation.
		//
		// With FWB this bit becomes unneccesary.
		UID: (wsinit.GitpodUID + 100000 - 1),
		GID: (wsinit.GitpodGID + 100000 - 1),
		IdMappings: []archive.IDMapping{
			{ContainerID: 0, HostID: wsinit.GitpodUID, Size: 1},
			{ContainerID: 1, HostID: 100000, Size: 65534},
		},
		OWI: content.OWI{
			Owner:       ws.Spec.Ownership.Owner,
			WorkspaceID: ws.Spec.Ownership.WorkspaceID,
			InstanceID:  ws.Name,
		},
	}

	err = content.RunInitializer(ctx, res.Location, &initializer, remoteContent, opts)
	if err != nil {
		return err.Error(), err
	}

	return "", nil
}

func (wsc *WorkspaceController) disposeWorkspace(ctx context.Context, ws *workspacev1.Workspace) error {
	sess := wsc.store.Get(ws.Name)
	if sess == nil {
		return status.Error(codes.NotFound, fmt.Sprintf("cannot find workspace %s during DisposeWorkspace", ws.Name))
	}

	if c := wsk8s.GetCondition(ws.Status.Conditions, string(workspacev1.WorkspaceConditionContentReady)); c == nil || c.Status == metav1.ConditionFalse {
		return xerrors.Errorf("workspace content was never ready")
	}

	// Maybe there's someone else already trying to dispose the workspace.
	// In that case we'll simply wait for that to happen.
	done, repo, err := sess.WaitOrMarkForDisposal(ctx)
	if err != nil {
		return status.Error(codes.Internal, err.Error())
	}

	if done {
		ws.Status.GitStatus = toWorkspaceGitStatus(repo)
		return nil
	}

	// todo(thomas) check when logs need to be backed up
	if ws.Spec.Type == workspacev1.WorkspaceTypePrebuild {
		err = wsc.uploadWorkspaceLogs(ctx, ws)
		if err != nil {
			// we do not fail the workspace yet because we still might succeed with its content!
			glog.WithError(err).Error("log backup failed")
		}
	}

	if sess.RemoteStorageDisabled {
		return xerrors.Errorf("workspace has no remote storage")
	}

	err = wsc.uploadWorkspaceContent(ctx, ws, sess)
	if err != nil {
		glog.WithError(err).Error("final backup failed")
		return xerrors.Errorf("final backup failed for workspace %s", ws.Name)
	}

	// Update the git status prior to deleting the workspace
	repo, err = wsc.UpdateGitStatus(ctx, ws, sess)
	if err != nil {
		// do not fail workspace because we were unable to get git status
		// which can happen for various reasons, including user corrupting his .git folder somehow
		// instead we log the error and continue cleaning up workspace
		// todo(pavel): it would be great if we can somehow bubble this up to user without failing workspace
		glog.WithError(err).Warn("cannot get git status")
	}

	if repo != nil {
		ws.Status.GitStatus = toWorkspaceGitStatus(repo)
	}

	// remove workspace daemon directory in the node
	if err := os.RemoveAll(sess.ServiceLocDaemon); err != nil {
		glog.WithError(err).Error("cannot delete workspace daemon directory")
	}

	return nil
}

func toWorkspaceGitStatus(status *csapi.GitStatus) *workspacev1.GitStatus {
	return &workspacev1.GitStatus{
		Branch:               status.Branch,
		LatestCommit:         status.LatestCommit,
		UncommitedFiles:      status.UncommitedFiles,
		TotalUncommitedFiles: status.TotalUncommitedFiles,
		UntrackedFiles:       status.UntrackedFiles,
		TotalUntrackedFiles:  status.TotalUntrackedFiles,
		UnpushedCommits:      status.UnpushedCommits,
		TotalUnpushedCommits: status.TotalUnpushedCommits,
	}
}

func (wsc *WorkspaceController) uploadWorkspaceLogs(ctx context.Context, ws *workspacev1.Workspace) (err error) {
	// currently we're only uploading prebuild log files
	logFiles, err := logs.ListPrebuildLogFiles(ctx, ws.Spec.WorkspaceLocation)
	if err != nil {
		return err
	}

	rs, err := storage.NewDirectAccess(&wsc.opts.ContentConfig.Storage)
	if err != nil {
		return xerrors.Errorf("cannot use configured storage: %w", err)
	}

	err = rs.Init(ctx, ws.Spec.Ownership.Owner, ws.Spec.Ownership.WorkspaceID, ws.Name)
	if err != nil {
		return xerrors.Errorf("cannot use configured storage: %w", err)
	}

	err = rs.EnsureExists(ctx)
	if err != nil {
		return err
	}

	for _, absLogPath := range logFiles {
		taskID, parseErr := logs.ParseTaskIDFromPrebuildLogFilePath(absLogPath)
		if parseErr != nil {
			glog.WithError(parseErr).Warn("cannot parse headless workspace log file name")
			continue
		}

		err = retryIfErr(ctx, 5, glog.WithField("op", "upload log"), func(ctx context.Context) (err error) {
			_, _, err = rs.UploadInstance(ctx, absLogPath, logs.UploadedHeadlessLogPath(taskID))
			if err != nil {
				return
			}

			return
		})
		if err != nil {
			return xerrors.Errorf("cannot upload workspace logs: %w", err)
		}
	}
	return err
}

func (wsc *WorkspaceController) uploadWorkspaceContent(ctx context.Context, ws *workspacev1.Workspace, sess *session.Workspace) (err error) {
	var (
		backupName = storage.DefaultBackup
		mfName     = storage.DefaultBackupManifest
	)

	// Avoid too many simultaneous backups in order to avoid excessive memory utilization.
	waitStart := time.Now()
	select {
	case wsc.backupWorkspaceLimiter <- struct{}{}:
	case <-time.After(15 * time.Minute):
		// we timed out on the rate limit - let's upload anyways, because we don't want to actually block
		// an upload. If we reach this point, chances are other things are broken. No upload should ever
		// take this long.
		wsc.metrics.BackupWaitingTimeoutCounter.Inc()
	}

	wsc.metrics.BackupWaitingTimeHist.Observe(time.Since(waitStart).Seconds())

	defer func() {
		<-wsc.backupWorkspaceLimiter
	}()

	var (
		loc  = sess.Location
		opts []storage.UploadOption
		mf   csapi.WorkspaceContentManifest
	)

	err = os.Remove(filepath.Join(sess.Location, wsinit.WorkspaceReadyFile))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		// We'll still upload the backup, well aware that the UX during restart will be broken.
		// But it's better to have a backup with all files (albeit one too many), than having no backup at all.
		glog.WithError(err).WithFields(sess.OWI()).Warn("cannot remove workspace ready file")
	}

	rs, ok := sess.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return xerrors.Errorf("no remote storage configured")
	}

	var (
		tmpf       *os.File
		tmpfSize   int64
		tmpfDigest digest.Digest
	)

	err = retryIfErr(ctx, wsc.opts.ContentConfig.Backup.Attempts, glog.WithFields(sess.OWI()).WithField("op", "create archive"), func(ctx context.Context) (err error) {
		tmpf, err = os.CreateTemp(wsc.opts.ContentConfig.TmpDir, fmt.Sprintf("wsbkp-%s-*.tar", sess.InstanceID))
		if err != nil {
			return
		}
		defer tmpf.Close()

		var opts []archive.TarOption
		opts = append(opts)
		if !sess.FullWorkspaceBackup {
			mappings := []archive.IDMapping{
				{ContainerID: 0, HostID: wsinit.GitpodUID, Size: 1},
				{ContainerID: 1, HostID: 100000, Size: 65534},
			}
			opts = append(opts,
				archive.WithUIDMapping(mappings),
				archive.WithGIDMapping(mappings),
			)
		}

		err = content.BuildTarbal(ctx, loc, tmpf.Name(), sess.FullWorkspaceBackup, opts...)
		if err != nil {
			return
		}
		err = tmpf.Sync()
		if err != nil {
			return
		}
		_, err = tmpf.Seek(0, 0)
		if err != nil {
			return
		}
		tmpfDigest, err = digest.FromReader(tmpf)
		if err != nil {
			return
		}

		stat, err := tmpf.Stat()
		if err != nil {
			return
		}
		tmpfSize = stat.Size()
		glog.WithField("size", tmpfSize).WithField("location", tmpf.Name()).WithFields(sess.OWI()).Debug("created temp file for workspace backup upload")

		return
	})
	if err != nil {
		return xerrors.Errorf("cannot create archive: %w", err)
	}
	defer func() {
		if tmpf != nil {
			// always remove the archive file to not fill up the node needlessly
			os.Remove(tmpf.Name())
		}
	}()

	var (
		layerBucket string
		layerObject string
	)
	err = retryIfErr(ctx, wsc.opts.ContentConfig.Backup.Attempts, glog.WithFields(sess.OWI()).WithField("op", "upload layer"), func(ctx context.Context) (err error) {
		layerUploadOpts := opts
		if sess.FullWorkspaceBackup {
			// we deliberately ignore the other opload options here as FWB workspace trailing doesn't make sense
			layerUploadOpts = []storage.UploadOption{
				storage.WithAnnotations(map[string]string{
					storage.ObjectAnnotationDigest:             tmpfDigest.String(),
					storage.ObjectAnnotationUncompressedDigest: tmpfDigest.String(),
					storage.ObjectAnnotationOCIContentType:     csapi.MediaTypeUncompressedLayer,
				}),
			}
		}

		layerBucket, layerObject, err = rs.Upload(ctx, tmpf.Name(), backupName, layerUploadOpts...)
		if err != nil {
			return
		}

		return
	})
	if err != nil {
		return xerrors.Errorf("cannot upload workspace content: %w", err)
	}

	err = retryIfErr(ctx, wsc.opts.ContentConfig.Backup.Attempts, glog.WithFields(sess.OWI()).WithField("op", "upload manifest"), func(ctx context.Context) (err error) {
		if !sess.FullWorkspaceBackup {
			return
		}

		ls := make([]csapi.WorkspaceContentLayer, len(mf.Layers), len(mf.Layers)+1)
		copy(ls, mf.Layers)
		ls = append(ls, csapi.WorkspaceContentLayer{
			Bucket:     layerBucket,
			Object:     layerObject,
			DiffID:     tmpfDigest,
			InstanceID: sess.InstanceID,
			Descriptor: ociv1.Descriptor{
				MediaType: csapi.MediaTypeUncompressedLayer,
				Digest:    tmpfDigest,
				Size:      tmpfSize,
			},
		})

		mf, err := json.Marshal(csapi.WorkspaceContentManifest{
			Type:   mf.Type,
			Layers: append(mf.Layers, ls...),
		})
		if err != nil {
			return err
		}
		glog.WithFields(sess.OWI()).WithField("manifest", mf).Debug("uploading content manifest")

		tmpmf, err := os.CreateTemp(wsc.opts.ContentConfig.TmpDir, fmt.Sprintf("mf-%s-*.json", sess.InstanceID))
		if err != nil {
			return err
		}
		defer os.Remove(tmpmf.Name())
		_, err = tmpmf.Write(mf)
		tmpmf.Close()
		if err != nil {
			return err
		}

		// Upload new manifest without opts as don't want to overwrite the layer trail with the manifest.
		// We have to make sure we use the right content type s.t. we can identify this as manifest later on,
		// e.g. when distinguishing between legacy snapshots and new manifests.
		_, _, err = rs.Upload(ctx, tmpmf.Name(), mfName, storage.WithContentType(csapi.ContentTypeManifest))
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return xerrors.Errorf("cannot upload workspace content manifest: %w", err)
	}

	return nil
}

// UpdateGitStatus attempts to update the LastGitStatus from the workspace's local working copy.
func (wsc *WorkspaceController) UpdateGitStatus(ctx context.Context, ws *workspacev1.Workspace, s *session.Workspace) (res *csapi.GitStatus, err error) {
	var loc string
	loc = ws.Spec.WorkspaceLocation
	if loc == "" {
		// FWB workspaces don't have `Location` set, but rather ServiceLocDaemon and ServiceLocNode.
		// We'd can't easily produce the Git status, because in this context `mark` isn't mounted, and `upper`
		// only contains the full git working copy if the content was just initialised.
		// Something like
		//   loc = filepath.Join(s.ServiceLocDaemon, "mark", "workspace")
		// does not work.
		//
		// TODO(cw): figure out a way to get ahold of the Git status.
		glog.WithField("loc", loc).WithFields(s.OWI()).Debug("not updating Git status of FWB workspace")
		return
	}

	loc = filepath.Join(loc, s.CheckoutLocation)
	if !git.IsWorkingCopy(loc) {
		glog.WithField("loc", loc).WithField("checkout location", s.CheckoutLocation).WithFields(s.OWI()).Debug("did not find a Git working copy - not updating Git status")
		return nil, nil
	}

	c := git.Client{Location: loc}

	stat, err := c.Status(ctx)
	if err != nil {
		return nil, err
	}

	lastGitStatus := toGitStatus(stat)

	err = s.Persist()
	if err != nil {
		glog.WithError(err).Warn("cannot persist latest Git status")
		err = nil
	}

	return lastGitStatus, nil
}

func toGitStatus(s *git.Status) *csapi.GitStatus {
	limit := func(entries []string) []string {
		if len(entries) > maxPendingChanges {
			return append(entries[0:maxPendingChanges], fmt.Sprintf("... and %d more", len(entries)-maxPendingChanges))
		}

		return entries
	}

	return &csapi.GitStatus{
		Branch:               s.BranchHead,
		LatestCommit:         s.LatestCommit,
		UncommitedFiles:      limit(s.UncommitedFiles),
		TotalUncommitedFiles: int64(len(s.UncommitedFiles)),
		UntrackedFiles:       limit(s.UntrackedFiles),
		TotalUntrackedFiles:  int64(len(s.UntrackedFiles)),
		UnpushedCommits:      limit(s.UnpushedCommits),
		TotalUnpushedCommits: int64(len(s.UnpushedCommits)),
	}
}

func retryIfErr(ctx context.Context, attempts int, log *logrus.Entry, op func(ctx context.Context) error) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "retryIfErr")
	defer tracing.FinishSpan(span, &err)
	for k, v := range log.Data {
		span.LogKV(k, v)
	}

	if attempts == 0 {
		attempts = 1
	}

	backoff := 1 * time.Second
	for i := 0; i < attempts; i++ {
		span.LogKV("attempt", i)

		if cerr := ctx.Err(); cerr != nil {
			return cerr
		}

		bctx, cancel := context.WithCancel(ctx)
		err = op(bctx)
		cancel()
		if err == nil {
			break
		}

		log.WithError(err).Error("op failed")
		span.LogKV("error", err.Error())
		if i < attempts-1 {
			log.WithField("backoff", backoff.String()).Debug("retrying op after backoff")
			if cerr := ctx.Err(); cerr != nil {
				return cerr
			}
			time.Sleep(backoff)
			backoff = 2 * backoff
		}
	}
	return
}
