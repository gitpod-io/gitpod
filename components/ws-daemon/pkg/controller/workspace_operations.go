// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	glog "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/logs"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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

type WorkspaceOperations struct {
	config                 content.Config
	store                  *session.Store
	backupWorkspaceLimiter chan struct{}
	metrics                *content.Metrics
}

type WorkspaceMeta struct {
	Owner       string
	WorkspaceId string
	InstanceId  string
}

type InitContentOptions struct {
	Meta        WorkspaceMeta
	Initializer *csapi.WorkspaceInitializer
	Headless    bool
}

type DisposeOptions struct {
	Meta              WorkspaceMeta
	WorkspaceLocation string
	BackupLogs        bool
}

func NewWorkspaceOperations(config content.Config, store *session.Store, reg prometheus.Registerer) (*WorkspaceOperations, error) {
	waitingTimeHist, waitingTimeoutCounter, err := content.RegisterConcurrentBackupMetrics(reg, "mk2")
	if err != nil {
		return nil, err
	}

	return &WorkspaceOperations{
		config: config,
		store:  store,
		metrics: &content.Metrics{
			BackupWaitingTimeHist:       waitingTimeHist,
			BackupWaitingTimeoutCounter: waitingTimeoutCounter,
		},
		// we permit five concurrent backups at any given time, hence the five in the channel
		backupWorkspaceLimiter: make(chan struct{}, 5),
	}, nil
}

func (wso *WorkspaceOperations) InitWorkspaceContent(ctx context.Context, options InitContentOptions) (bool, string, error) {
	res, err := wso.store.NewWorkspace(
		ctx, options.Meta.WorkspaceId, filepath.Join(wso.store.Location, options.Meta.WorkspaceId),
		wso.creator(options.Meta.Owner, options.Meta.WorkspaceId, options.Meta.InstanceId, options.Initializer, options.Headless))
	if errors.Is(err, storage.ErrNotFound) {
		return false, "", nil
	}

	if errors.Is(err, session.ErrAlreadyExists) {
		return true, "", nil
	}

	if err != nil {
		return false, "bug: cannot add workspace to store", xerrors.Errorf("cannot add workspace to store: %w", err)
	}

	rs, ok := res.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return false, "bug: workspace has no remote storage", xerrors.Errorf("workspace has no remote storage")
	}
	ps, err := storage.NewPresignedAccess(&wso.config.Storage)
	if err != nil {
		return false, "bug: no presigned storage available", xerrors.Errorf("no presigned storage available: %w", err)
	}

	remoteContent, err := content.CollectRemoteContent(ctx, rs, ps, options.Meta.Owner, options.Initializer)
	if err != nil {
		return false, "remote content error", xerrors.Errorf("remote content error: %w", err)
	}

	glog.Info("RUNNING INITIALIZER")

	// Initialize workspace.
	// FWB workspaces initialize without the help of ws-daemon, but using their supervisor or the registry-facade.
	opts := content.RunInitializerOpts{
		Command: wso.config.Initializer.Command,
		Args:    wso.config.Initializer.Args,
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
			Owner:       options.Meta.Owner,
			WorkspaceID: options.Meta.WorkspaceId,
			InstanceID:  options.Meta.InstanceId,
		},
	}

	err = content.RunInitializer(ctx, res.Location, options.Initializer, remoteContent, opts)
	if err != nil {
		return false, err.Error(), err
	}

	return false, "", nil
}

func (wso *WorkspaceOperations) creator(owner, workspaceId, instanceId string, init *csapi.WorkspaceInitializer, storageDisabled bool) session.WorkspaceFactory {
	var checkoutLocation string
	allLocations := csapi.GetCheckoutLocationsFromInitializer(init)
	if len(allLocations) > 0 {
		checkoutLocation = allLocations[0]
	}

	glog.WithField("checkoutLocation", checkoutLocation)

	serviceDirName := instanceId + "-daemon"
	return func(ctx context.Context, location string) (res *session.Workspace, err error) {
		return &session.Workspace{
			Location:              location,
			CheckoutLocation:      checkoutLocation,
			CreatedAt:             time.Now(),
			Owner:                 owner,
			WorkspaceID:           workspaceId,
			InstanceID:            instanceId,
			FullWorkspaceBackup:   false,
			PersistentVolumeClaim: false,
			RemoteStorageDisabled: storageDisabled,

			ServiceLocDaemon: filepath.Join(wso.config.WorkingArea, serviceDirName),
			ServiceLocNode:   filepath.Join(wso.config.WorkingAreaNode, serviceDirName),
		}, nil
	}
}

func (wso *WorkspaceOperations) DisposeWorkspace(ctx context.Context, opts DisposeOptions) (bool, *csapi.GitStatus, error) {
	log := log.FromContext(ctx)

	sess := wso.store.Get(opts.Meta.InstanceId)
	if sess == nil {
		return false, nil, status.Error(codes.NotFound, fmt.Sprintf("cannot find workspace %s during DisposeWorkspace", opts.Meta.InstanceId))
	}

	log.Info("wait disposal")

	// Maybe there's someone else already trying to dispose the workspace.
	// In that case we'll simply wait for that to happen.
	done, repo, err := sess.WaitOrMarkForDisposal(ctx)
	if err != nil {
		return false, nil, status.Error(codes.Internal, err.Error())
	}

	if done {
		log.Info("get git status", "repo", repo)
		//ws.Status.GitStatus = toWorkspaceGitStatus(repo)
		return true, repo, nil
	}

	if opts.BackupLogs {
		err := wso.uploadWorkspaceLogs(ctx, opts)
		if err != nil {
			// we do not fail the workspace yet because we still might succeed with its content!
			glog.WithError(err).Error("log backup failed")
		}
	}

	if sess.RemoteStorageDisabled {
		return false, nil, xerrors.Errorf("workspace has no remote storage")
	}

	log.Info("upload workspace content")

	err = wso.uploadWorkspaceContent(ctx, sess)
	if err != nil {
		glog.WithError(err).Error("final backup failed")
		return false, nil, xerrors.Errorf("final backup failed for workspace %s", opts.Meta.InstanceId)
	}

	log.Info("update git status")

	// Update the git status prior to deleting the workspace
	repo, err = sess.UpdateGitStatus(ctx, false)
	if err != nil {
		// do not fail workspace because we were unable to get git status
		// which can happen for various reasons, including user corrupting his .git folder somehow
		// instead we log the error and continue cleaning up workspace
		// todo(pavel): it would be great if we can somehow bubble this up to user without failing workspace
		glog.WithError(err).Warn("cannot get git status")
	}

	log.Info("updated git status", "repo", repo)

	if err = sess.Dispose(ctx); err != nil {
		glog.WithError(err).Error("cannot dispose session")
	}

	// remove workspace daemon directory in the node
	if err := os.RemoveAll(sess.ServiceLocDaemon); err != nil {
		glog.WithError(err).Error("cannot delete workspace daemon directory")
	}

	log.Info("returning from dispose")
	return false, repo, nil
}

func (wso *WorkspaceOperations) uploadWorkspaceLogs(ctx context.Context, opts DisposeOptions) (err error) {
	// currently we're only uploading prebuild log files
	logFiles, err := logs.ListPrebuildLogFiles(ctx, opts.WorkspaceLocation)
	if err != nil {
		return err
	}

	rs, err := storage.NewDirectAccess(&wso.config.Storage)
	if err != nil {
		return xerrors.Errorf("cannot use configured storage: %w", err)
	}

	err = rs.Init(ctx, opts.Meta.Owner, opts.Meta.WorkspaceId, opts.Meta.InstanceId)
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

func (wso *WorkspaceOperations) uploadWorkspaceContent(ctx context.Context, sess *session.Workspace) error {
	var backupName = storage.DefaultBackup
	// Avoid too many simultaneous backups in order to avoid excessive memory utilization.
	waitStart := time.Now()
	select {
	case wso.backupWorkspaceLimiter <- struct{}{}:
	case <-time.After(15 * time.Minute):
		// we timed out on the rate limit - let's upload anyways, because we don't want to actually block
		// an upload. If we reach this point, chances are other things are broken. No upload should ever
		// take this long.
		wso.metrics.BackupWaitingTimeoutCounter.Inc()
	}

	wso.metrics.BackupWaitingTimeHist.Observe(time.Since(waitStart).Seconds())

	defer func() {
		<-wso.backupWorkspaceLimiter
	}()

	var (
		loc  = sess.Location
		opts []storage.UploadOption
	)

	err := os.Remove(filepath.Join(sess.Location, wsinit.WorkspaceReadyFile))
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
		tmpf     *os.File
		tmpfSize int64
	)

	err = retryIfErr(ctx, wso.config.Backup.Attempts, glog.WithFields(sess.OWI()).WithField("op", "create archive"), func(ctx context.Context) (err error) {
		tmpf, err = os.CreateTemp(wso.config.TmpDir, fmt.Sprintf("wsbkp-%s-*.tar", sess.InstanceID))
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

	err = retryIfErr(ctx, wso.config.Backup.Attempts, glog.WithFields(sess.OWI()).WithField("op", "upload layer"), func(ctx context.Context) (err error) {
		_, _, err = rs.Upload(ctx, tmpf.Name(), backupName, opts...)
		if err != nil {
			return
		}

		return
	})
	if err != nil {
		return xerrors.Errorf("cannot upload workspace content: %w", err)
	}

	return nil
}

// UpdateGitStatus attempts to update the LastGitStatus from the workspace's local working copy.
func (wsc *WorkspaceController) UpdateGitStatus(ctx context.Context, ws *workspacev1.Workspace, s *session.Workspace) (res *csapi.GitStatus, err error) {
	var loc string
	loc = s.Location
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

	glog.Infof("GIT LOCATION IS %v", loc)
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

	return lastGitStatus, err
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
