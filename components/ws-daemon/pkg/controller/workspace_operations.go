// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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

	"github.com/gitpod-io/gitpod/common-go/log"
	glog "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/logs"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

type Metrics struct {
	BackupWaitingTimeHist       prometheus.Histogram
	BackupWaitingTimeoutCounter prometheus.Counter
	InitializerHistogram        *prometheus.HistogramVec
}

func registerConcurrentBackupMetrics(reg prometheus.Registerer, suffix string) (prometheus.Histogram, prometheus.Counter, error) {
	backupWaitingTime := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "concurrent_backup_waiting_seconds" + suffix,
		Help:    "waiting time for concurrent backups to finish",
		Buckets: []float64{5, 10, 30, 60, 120, 180, 300, 600, 1800},
	})

	err := reg.Register(backupWaitingTime)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot register Prometheus histogram for backup waiting time: %w", err)
	}

	waitingTimeoutCounter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "concurrent_backup_waiting_timeout_total" + suffix,
		Help: "total count of backup rate limiting timeouts",
	})
	err = reg.Register(waitingTimeoutCounter)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot register Prometheus counter for backup waiting timeouts: %w", err)
	}

	return backupWaitingTime, waitingTimeoutCounter, nil
}

//go:generate sh -c "go install github.com/golang/mock/mockgen@v1.6.0 && mockgen -destination=mock.go -package=controller . WorkspaceOperations"
type WorkspaceOperations interface {
	// InitWorkspace initializes the workspace content
	InitWorkspace(ctx context.Context, options InitOptions) (string, error)
	// BackupWorkspace backups the content of the workspace
	BackupWorkspace(ctx context.Context, opts BackupOptions) (*csapi.GitStatus, error)
	// DeleteWorkspace deletes the content of the workspace from disk
	DeleteWorkspace(ctx context.Context, instanceID string) error
	// WipeWorkspace deletes all references to the workspace. Does not fail if parts are already gone, or state is incosistent.
	WipeWorkspace(ctx context.Context, instanceID string) error
	// SnapshotIDs generates the name and url for a snapshot
	SnapshotIDs(ctx context.Context, instanceID string) (snapshotUrl, snapshotName string, err error)
	// Snapshot takes a snapshot of the workspace
	Snapshot(ctx context.Context, instanceID, snapshotName string) (err error)
	// Setup ensures that the workspace has been setup
	SetupWorkspace(ctx context.Context, instanceID string, imageInfo *workspacev1.WorkspaceImageInfo) error
}

type DefaultWorkspaceOperations struct {
	config                 content.Config
	provider               *WorkspaceProvider
	backupWorkspaceLimiter chan struct{}
	metrics                *Metrics
	dispatch               *dispatch.Dispatch
}

var _ WorkspaceOperations = (*DefaultWorkspaceOperations)(nil)

type WorkspaceMeta struct {
	Owner       string
	WorkspaceID string
	InstanceID  string
}

type InitOptions struct {
	Meta         WorkspaceMeta
	Initializer  *csapi.WorkspaceInitializer
	Headless     bool
	StorageQuota int
}

type BackupOptions struct {
	Meta              WorkspaceMeta
	BackupLogs        bool
	UpdateGitStatus   bool
	SnapshotName      string
	SkipBackupContent bool
}

func NewWorkspaceOperations(config content.Config, provider *WorkspaceProvider, reg prometheus.Registerer, dispatch *dispatch.Dispatch) (WorkspaceOperations, error) {
	waitingTimeHist, waitingTimeoutCounter, err := registerConcurrentBackupMetrics(reg, "_mk2")
	if err != nil {
		return nil, err
	}

	return &DefaultWorkspaceOperations{
		config:   config,
		provider: provider,
		metrics: &Metrics{
			BackupWaitingTimeHist:       waitingTimeHist,
			BackupWaitingTimeoutCounter: waitingTimeoutCounter,
		},
		// we permit five concurrent backups at any given time, hence the five in the channel
		backupWorkspaceLimiter: make(chan struct{}, 5),
		dispatch:               dispatch,
	}, nil
}

func (wso *DefaultWorkspaceOperations) InitWorkspace(ctx context.Context, options InitOptions) (string, error) {
	ws, err := wso.provider.NewWorkspace(ctx, options.Meta.InstanceID, filepath.Join(wso.provider.Location, options.Meta.InstanceID),
		wso.creator(options.Meta.Owner, options.Meta.WorkspaceID, options.Meta.InstanceID, options.Initializer, false, options.StorageQuota))

	if err != nil {
		return "bug: cannot add workspace to store", xerrors.Errorf("cannot add workspace to store: %w", err)
	}

	rs, ok := ws.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return "bug: workspace has no remote storage", xerrors.Errorf("workspace has no remote storage")
	}
	ps, err := storage.NewPresignedAccess(&wso.config.Storage)
	if err != nil {
		return "bug: no presigned storage available", xerrors.Errorf("no presigned storage available: %w", err)
	}

	remoteContent, err := content.CollectRemoteContent(ctx, rs, ps, options.Meta.Owner, options.Initializer)
	if err != nil {
		return "remote content error", xerrors.Errorf("remote content error: %w", err)
	}

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
			WorkspaceID: options.Meta.WorkspaceID,
			InstanceID:  options.Meta.InstanceID,
		},
	}

	err = ensureCleanSlate(ws.Location)
	if err != nil {
		glog.WithFields(ws.OWI()).Warnf("cannot ensure clean slate for workspace %s (this might break content init): %v", ws.InstanceID, err)
	}

	err = content.RunInitializer(ctx, ws.Location, options.Initializer, remoteContent, opts)
	if err != nil {
		glog.WithFields(ws.OWI()).Infof("error running initializer %v", err)
		return err.Error(), err
	}

	err = ws.Persist()
	if err != nil {
		return "cannot persist workspace", err
	}

	glog.WithFields(ws.OWI()).Debug("content init done")

	return "", nil
}

func (wso *DefaultWorkspaceOperations) creator(owner, workspaceID, instanceID string, init *csapi.WorkspaceInitializer, storageDisabled bool, storageQuota int) WorkspaceFactory {
	var checkoutLocation string
	allLocations := csapi.GetCheckoutLocationsFromInitializer(init)
	if len(allLocations) > 0 {
		checkoutLocation = allLocations[0]
	}

	serviceDirName := instanceID + "-daemon"
	return func(ctx context.Context, location string) (res *session.Workspace, err error) {
		return &session.Workspace{
			Location:              location,
			CheckoutLocation:      checkoutLocation,
			CreatedAt:             time.Now(),
			Owner:                 owner,
			WorkspaceID:           workspaceID,
			InstanceID:            instanceID,
			RemoteStorageDisabled: storageDisabled,
			StorageQuota:          storageQuota,

			ServiceLocDaemon: filepath.Join(wso.config.WorkingArea, serviceDirName),
			ServiceLocNode:   filepath.Join(wso.config.WorkingAreaNode, serviceDirName),
		}, nil
	}
}

func (wso *DefaultWorkspaceOperations) SetupWorkspace(ctx context.Context, instanceID string, imageInfo *workspacev1.WorkspaceImageInfo) error {
	ws, err := wso.provider.GetAndConnect(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("cannot setup workspace %s: %w", instanceID, err)
	}
	err = wso.writeImageInfo(ctx, ws, imageInfo)
	if err != nil {
		glog.WithError(err).WithFields(ws.OWI()).Error("cannot write image info")
	}
	return nil
}

func (wso *DefaultWorkspaceOperations) BackupWorkspace(ctx context.Context, opts BackupOptions) (*csapi.GitStatus, error) {
	ws, err := wso.provider.GetAndConnect(ctx, opts.Meta.InstanceID)
	if err != nil {
		return nil, fmt.Errorf("cannot find workspace %s during DisposeWorkspace: %w", opts.Meta.InstanceID, err)
	}

	if ws.RemoteStorageDisabled {
		return nil, fmt.Errorf("workspace has no remote storage")
	}

	if opts.BackupLogs {
		err := wso.uploadWorkspaceLogs(ctx, opts, ws.Location)
		if err != nil {
			// we do not fail the workspace yet because we still might succeed with its content!
			glog.WithError(err).WithFields(ws.OWI()).Error("log backup failed")
		}
	}

	if opts.SkipBackupContent {
		return nil, nil
	}

	err = wso.uploadWorkspaceContent(ctx, ws, opts.SnapshotName)
	if err != nil {
		glog.WithError(err).WithFields(ws.OWI()).Error("final backup failed for workspace")
		return nil, fmt.Errorf("final backup failed for workspace %s", opts.Meta.InstanceID)
	}

	var repo *csapi.GitStatus
	if opts.UpdateGitStatus {
		// Update the git status prior to deleting the workspace
		repo, err = ws.UpdateGitStatus(ctx)
		if err != nil {
			// do not fail workspace because we were unable to get git status
			// which can happen for various reasons, including user corrupting his .git folder somehow
			// instead we log the error and continue cleaning up workspace
			// todo(pavel): it would be great if we can somehow bubble this up to user without failing workspace
			glog.WithError(err).WithFields(ws.OWI()).Warn("cannot get git status")
		}
	}

	return repo, nil
}

func (wso *DefaultWorkspaceOperations) DeleteWorkspace(ctx context.Context, instanceID string) error {
	ws, err := wso.provider.GetAndConnect(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("cannot find workspace %s during DisposeWorkspace: %w", instanceID, err)
	}

	if err = ws.Dispose(ctx, wso.provider.hooks[session.WorkspaceDisposed]); err != nil {
		glog.WithError(err).WithFields(ws.OWI()).Error("cannot dispose session")
		return err
	}

	// remove workspace daemon directory in the node
	if err := os.RemoveAll(ws.ServiceLocDaemon); err != nil {
		glog.WithError(err).WithFields(ws.OWI()).Error("cannot delete workspace daemon directory")
		return err
	}
	wso.provider.Remove(ctx, instanceID)

	return nil
}

func (wso *DefaultWorkspaceOperations) WipeWorkspace(ctx context.Context, instanceID string) error {
	log := log.New().WithContext(ctx)

	ws, err := wso.provider.GetAndConnect(ctx, instanceID)
	if err != nil {
		// we have to assume everything is fine, and this workspace has already been completely wiped
		return nil
	}
	log = log.WithFields(ws.OWI())

	// mark this session as being wiped
	ws.DoWipe = true

	if err = ws.Dispose(ctx, wso.provider.hooks[session.WorkspaceDisposed]); err != nil {
		log.WithError(err).Error("cannot dispose session")
		return err
	}

	// dispose all running "dispatch handlers", e.g. all code running on the "pod informer"-triggered part of ws-daemon
	wso.dispatch.DisposeWorkspace(ctx, instanceID)

	// remove workspace daemon directory in the node
	removedChan := make(chan struct{}, 1)
	go func() {
		defer close(removedChan)

		if err := os.RemoveAll(ws.ServiceLocDaemon); err != nil {
			log.WithError(err).Warn("cannot delete workspace daemon directory, leaving it dangling...")
		}
	}()

	// We never want the "RemoveAll" to block the workspace from being delete, so we'll resort to make this a best-effort approach, and time out after 10s.
	timeout := time.NewTicker(10 * time.Second)
	defer timeout.Stop()
	select {
	case <-timeout.C:
	case <-removedChan:
		log.Debug("successfully removed workspace daemon directory")
	}

	// remove the reference from the WorkspaceProvider, e.g. the "workspace controller" part of ws-daemon
	wso.provider.Remove(ctx, instanceID)

	return nil
}

func (wso *DefaultWorkspaceOperations) SnapshotIDs(ctx context.Context, instanceID string) (snapshotUrl, snapshotName string, err error) {
	sess, err := wso.provider.GetAndConnect(ctx, instanceID)
	if err != nil {
		return "", "", fmt.Errorf("cannot find workspace %s during SnapshotName: %w", instanceID, err)
	}

	baseName := fmt.Sprintf("snapshot-%d", time.Now().UnixNano())
	snapshotName = baseName + ".tar"

	rs, ok := sess.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return "", "", fmt.Errorf("no remote storage configured")
	}

	return rs.Qualify(snapshotName), snapshotName, nil
}

func (wso *DefaultWorkspaceOperations) Snapshot(ctx context.Context, workspaceID, snapshotName string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "TakeSnapshot")
	span.SetTag("workspace", workspaceID)
	defer tracing.FinishSpan(span, &err)

	if workspaceID == "" {
		return fmt.Errorf("workspaceID is required")
	}

	ws, err := wso.provider.GetAndConnect(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("cannot find workspace %s during DisposeWorkspace", workspaceID)
	}

	if ws.RemoteStorageDisabled {
		return fmt.Errorf("workspace has no remote storage")
	}

	err = wso.uploadWorkspaceContent(ctx, ws, snapshotName)
	if err != nil {
		glog.WithError(err).WithFields(ws.OWI()).Error("snapshot failed for workspace")
		return fmt.Errorf("snapshot failed for workspace %s", workspaceID)
	}

	return nil
}

func ensureCleanSlate(location string) error {
	// do not remove the location itself but only
	// the children
	files, err := os.ReadDir(location)
	if err != nil {
		return err
	}

	for _, f := range files {
		path := filepath.Join(location, f.Name())
		err = os.RemoveAll(path)
		if err != nil {
			return err
		}
	}

	return nil
}

func (wso *DefaultWorkspaceOperations) uploadWorkspaceLogs(ctx context.Context, opts BackupOptions, location string) (err error) {
	// currently we're only uploading prebuild log files
	logFiles, err := logs.ListPrebuildLogFiles(ctx, location)
	if err != nil {
		return err
	}

	rs, err := storage.NewDirectAccess(&wso.config.Storage)
	if err != nil {
		return xerrors.Errorf("cannot use configured storage: %w", err)
	}

	err = rs.Init(ctx, opts.Meta.Owner, opts.Meta.WorkspaceID, opts.Meta.InstanceID)
	if err != nil {
		return xerrors.Errorf("cannot use configured storage: %w", err)
	}

	err = rs.EnsureExists(ctx)
	if err != nil {
		return err
	}

	for _, absLogPath := range logFiles {
		taskID, parseErr := logs.ParseTaskIDFromPrebuildLogFilePath(absLogPath)
		owi := glog.OWI(opts.Meta.Owner, opts.Meta.WorkspaceID, opts.Meta.InstanceID)
		if parseErr != nil {
			glog.WithError(parseErr).WithFields(owi).Warn("cannot parse headless workspace log file name")
			continue
		}

		err = retryIfErr(ctx, 5, glog.WithField("op", "upload log").WithFields(owi), func(ctx context.Context) (err error) {
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

func (wso *DefaultWorkspaceOperations) uploadWorkspaceContent(ctx context.Context, sess *session.Workspace, backupName string) error {
	// Avoid too many simultaneous backups in order to avoid excessive memory utilization.
	var timedOut bool
	waitStart := time.Now()
	select {
	case wso.backupWorkspaceLimiter <- struct{}{}:
	case <-time.After(15 * time.Minute):
		// we timed out on the rate limit - let's upload anyways, because we don't want to actually block
		// an upload. If we reach this point, chances are other things are broken. No upload should ever
		// take this long.
		timedOut = true
		wso.metrics.BackupWaitingTimeoutCounter.Inc()
	}

	waitTime := time.Since(waitStart)
	wso.metrics.BackupWaitingTimeHist.Observe(waitTime.Seconds())

	defer func() {
		// timeout -> we did not add to the limiter
		if timedOut {
			return
		}

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

	defer func() {
		if tmpf != nil {
			os.Remove(tmpf.Name())
		}
	}()

	err = retryIfErr(ctx, wso.config.Backup.Attempts, glog.WithFields(sess.OWI()).WithField("op", "create archive"), func(ctx context.Context) (err error) {
		tmpf, err = os.CreateTemp(wso.config.TmpDir, fmt.Sprintf("wsbkp-%s-*.tar", sess.InstanceID))
		if err != nil {
			return
		}

		defer func() {
			tmpf.Close()
			if err != nil {
				os.Remove(tmpf.Name())
			}
		}()

		var opts []archive.TarOption
		opts = append(opts)
		mappings := []archive.IDMapping{
			{ContainerID: 0, HostID: wsinit.GitpodUID, Size: 1},
			{ContainerID: 1, HostID: 100000, Size: 65534},
		}
		opts = append(opts,
			archive.WithUIDMapping(mappings),
			archive.WithGIDMapping(mappings),
		)

		err = content.BuildTarbal(ctx, loc, tmpf.Name(), opts...)
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

func (wso *DefaultWorkspaceOperations) writeImageInfo(_ context.Context, ws *session.Workspace, imageInfo *workspacev1.WorkspaceImageInfo) error {
	if imageInfo == nil {
		return nil
	}

	b, err := json.Marshal(imageInfo)
	if err != nil {
		return fmt.Errorf("cannot marshal image info: %w", err)
	}
	uid := (wsinit.GitpodUID + 100000 - 1)
	gid := (wsinit.GitpodGID + 100000 - 1)
	fp := filepath.Join(ws.Location, ".gitpod/image")
	err = os.WriteFile(fp, b, 0644)
	if err != nil {
		return fmt.Errorf("cannot write image info: %w", err)
	}
	os.Chown(fp, uid, gid)
	return nil
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
