// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package content

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/logs"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/iws"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
)

// Metrics combine custom metrics exported by WorkspaceService
type metrics struct {
	BackupWaitingTimeHist       prometheus.Histogram
	BackupWaitingTimeoutCounter prometheus.Counter
	InitializerHistogram        *prometheus.HistogramVec
}

// WorkspaceService implements the InitService and WorkspaceService
type WorkspaceService struct {
	config Config

	store       *session.Store
	ctx         context.Context
	stopService context.CancelFunc
	runtime     container.Runtime

	metrics *metrics

	// channel to limit the number of concurrent backups and uploads.
	backupWorkspaceLimiter chan struct{}

	api.UnimplementedInWorkspaceServiceServer
	api.UnimplementedWorkspaceContentServiceServer
}

// WorkspaceExistenceCheck is a check that can determine if a workspace container currently exists on this node.
type WorkspaceExistenceCheck func(instanceID string) bool

// NewWorkspaceService creates a new workspce initialization service, starts housekeeping and the Prometheus integration
func NewWorkspaceService(ctx context.Context, cfg Config, kubernetesNamespace string, runtime container.Runtime, wec WorkspaceExistenceCheck, uidmapper *iws.Uidmapper, cgroupMountPoint string, reg prometheus.Registerer) (res *WorkspaceService, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "NewWorkspaceService")
	defer tracing.FinishSpan(span, &err)

	// create working area
	err = os.MkdirAll(cfg.WorkingArea, 0755)
	if err != nil {
		return nil, xerrors.Errorf("cannot create working area: %w", err)
	}

	xfs, err := quota.NewXFS(cfg.WorkingArea)
	if err != nil {
		return nil, err
	}

	// read all session json files
	store, err := session.NewStore(ctx, cfg.WorkingArea, workspaceLifecycleHooks(cfg, kubernetesNamespace, wec, uidmapper, xfs, cgroupMountPoint))
	if err != nil {
		return nil, xerrors.Errorf("cannot create session store: %w", err)
	}
	ctx, stopService := context.WithCancel(ctx)

	if err := registerWorkingAreaDiskspaceGauge(cfg.WorkingArea, reg); err != nil {
		return nil, xerrors.Errorf("cannot register Prometheus gauge for working area diskspace: %w", err)
	}

	waitingTimeHist, err := registerConcurrentBackupWaitingTime(reg)
	if err != nil {
		return nil, xerrors.Errorf("cannot register Prometheus histogram for backup waiting time: %w", err)
	}
	waitingTimeoutCounter := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "concurrent_backup_waiting_timeout_total",
		Help: "total count of backup rate limiting timeouts",
	})
	err = reg.Register(waitingTimeoutCounter)
	if err != nil {
		return nil, xerrors.Errorf("cannot register Prometheus counter for backup waiting timeouts: %w", err)
	}

	initializerHistogram := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "initializer_bytes_second",
		Help:    "initializer speed in bytes per second",
		Buckets: prometheus.ExponentialBuckets(1024*1024, 2, 15),
	}, []string{"kind"})

	err = reg.Register(initializerHistogram)
	if err != nil {
		return nil, xerrors.Errorf("cannot register Prometheus counter for initializer speed per second: %w", err)
	}

	return &WorkspaceService{
		config:      cfg,
		store:       store,
		ctx:         ctx,
		stopService: stopService,
		runtime:     runtime,

		metrics: &metrics{
			BackupWaitingTimeHist:       waitingTimeHist,
			BackupWaitingTimeoutCounter: waitingTimeoutCounter,
			InitializerHistogram:        initializerHistogram,
		},
		// we permit five concurrent backups at any given time, hence the five in the channel
		backupWorkspaceLimiter: make(chan struct{}, 5),
	}, nil
}

// registerWorkingAreaDiskspaceGauge registers a free disk space Prometheus gauge for a working area.
func registerWorkingAreaDiskspaceGauge(workingArea string, reg prometheus.Registerer) error {
	return reg.Register(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "working_area_free_bytes",
		Help: "Amount of free disk space in the working area",
		ConstLabels: map[string]string{
			"hostname": os.Getenv("NODENAME"),
		},
	}, func() float64 {
		var stat syscall.Statfs_t
		err := syscall.Statfs(workingArea, &stat)
		if err != nil {
			log.WithError(err).Warn("cannot get working area filesystem stats - not updating Prometheus gauge")
			return math.NaN()
		}

		bvail := stat.Bavail * uint64(stat.Bsize)
		return float64(bvail)
	}))
}

func registerConcurrentBackupWaitingTime(reg prometheus.Registerer) (prometheus.Histogram, error) {
	backupWaitingTime := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "concurrent_backup_waiting_seconds",
		Help:    "waiting time for concurrent backups to finish",
		Buckets: []float64{5, 10, 30, 60, 120, 180, 300, 600, 1800},
	})

	err := reg.Register(backupWaitingTime)
	if err != nil {
		return nil, err
	}

	return backupWaitingTime, nil
}

// Start starts this workspace service and returns when the service gets stopped.
// This function is intended to run as Go routine.
func (s *WorkspaceService) Start() {
	s.store.StartHousekeeping(s.ctx, 5*time.Minute)
}

// InitWorkspace intialises a new workspace folder in the working area
func (s *WorkspaceService) InitWorkspace(ctx context.Context, req *api.InitWorkspaceRequest) (resp *api.InitWorkspaceResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "InitWorkspace")
	tracing.LogRequestSafe(span, req)
	defer func() {
		tracing.FinishSpan(span, &err)

		if err != nil {
			log.WithError(err).WithFields(log.OWI("", "", req.Id)).Error("InitWorkspace failed")
		}

		if err != nil && status.Code(err) != codes.AlreadyExists {
			// the session failed - clean it up
			derr := s.store.Delete(ctx, req.Id)
			if err == nil && derr != nil {
				err = derr
			}
		}
	}()

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}
	if req.Metadata == nil {
		return nil, status.Error(codes.InvalidArgument, "metadata is missing")
	}
	owi := log.OWI(req.Metadata.Owner, req.Metadata.MetaId, req.Id)
	tracing.ApplyOWI(span, owi)
	log := log.WithFields(owi)
	log.Debug("InitWorkspace called")

	var (
		wsloc string
	)
	if req.FullWorkspaceBackup {
		var mf csapi.WorkspaceContentManifest
		if len(req.ContentManifest) == 0 {
			return nil, status.Errorf(codes.InvalidArgument, "content manifest is required")
		}
		err = json.Unmarshal(req.ContentManifest, &mf)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid content manifest: %s", err.Error())
		}
	} else {
		wsloc = filepath.Join(s.store.Location, req.Id)
	}

	workspace, err := s.store.NewWorkspace(ctx, req.Id, wsloc, s.creator(req))
	if err == session.ErrAlreadyExists {
		return nil, status.Error(codes.AlreadyExists, "workspace exists already")
	}
	if err != nil {
		return nil, err
	}

	if !req.FullWorkspaceBackup && !req.PersistentVolumeClaim {
		var remoteContent map[string]storage.DownloadInfo

		// some workspaces don't have remote storage enabled. For those workspaces we clearly
		// cannot collect remote content (i.e. the backup or prebuilds) and hence must not try.
		if !req.RemoteStorageDisabled {
			rs, ok := workspace.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
			if rs == nil || !ok {
				log.Error("workspace has no remote storage")
				return nil, status.Error(codes.FailedPrecondition, "workspace has no remote storage")
			}
			ps, err := storage.NewPresignedAccess(&s.config.Storage)
			if err != nil {
				log.WithError(err).Error("cannot create presigned storage")
				return nil, status.Error(codes.Internal, "no presigned storage available")
			}

			remoteContent, err = collectRemoteContent(ctx, rs, ps, workspace.Owner, req.Initializer)
			if err != nil && errors.Is(err, errCannotFindSnapshot) {
				log.WithError(err).Error("cannot find snapshot")
				return nil, status.Error(codes.NotFound, "cannot find snapshot")
			}
			if err != nil {
				log.WithError(err).Error("cannot collect remote content")
				return nil, status.Error(codes.Internal, "remote content error")
			}
		}

		// This task/call cannot be canceled. Once it's started it's brought to a conclusion, independent of the caller disconnecting
		// or not. To achieve this we need to wrap the context in something that alters the cancelation behaviour.
		ctx = &cannotCancelContext{Delegate: ctx}

		// Initialize workspace.
		// FWB workspaces initialize without the help of ws-daemon, but using their supervisor or the registry-facade.
		opts := RunInitializerOpts{
			Command: s.config.Initializer.Command,
			Args:    s.config.Initializer.Args,
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
			OWI: OWI{
				Owner:       req.Metadata.Owner,
				WorkspaceID: req.Metadata.MetaId,
				InstanceID:  req.Id,
			},
		}

		err = RunInitializer(ctx, workspace.Location, req.Initializer, remoteContent, opts)
		if err != nil {
			log.WithError(err).WithField("workspaceId", req.Id).Error("cannot initialize workspace")
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}

		s.recordInitializerMetrics(workspace.Location)
	}

	if req.PersistentVolumeClaim {
		// create a folder that is used to store data from running prestophook
		deamonDir := fmt.Sprintf("%s-daemon", req.Id)
		prestophookDir := filepath.Join(s.config.WorkingArea, deamonDir, "prestophookdata")
		err = os.MkdirAll(prestophookDir, 0755)
		if err != nil {
			log.WithError(err).WithField("workspaceId", req.Id).Error("cannot create prestophookdata folder")
			return nil, status.Error(codes.FailedPrecondition, fmt.Sprintf("cannot create prestophookdata: %v", err))
		}
		_, err = exec.CommandContext(ctx, "chown", "-R", fmt.Sprintf("%d:%d", wsinit.GitpodUID, wsinit.GitpodGID), prestophookDir).CombinedOutput()
		if err != nil {
			log.WithError(err).WithField("workspaceId", req.Id).Error("cannot chown prestophookdata folder")
			return nil, status.Error(codes.FailedPrecondition, fmt.Sprintf("cannot chown prestophookdata: %v", err))
		}
	}

	// Tell the world we're done
	err = workspace.MarkInitDone(ctx)
	if err != nil {
		log.WithError(err).WithField("workspaceId", req.Id).Error("cannot initialize workspace")
		return nil, status.Error(codes.FailedPrecondition, fmt.Sprintf("cannot finish workspace init: %v", err))
	}

	return &api.InitWorkspaceResponse{}, nil
}

func (s *WorkspaceService) recordInitializerMetrics(path string) {
	readyFile := filepath.Join(path, wsinit.WorkspaceReadyFile)

	content, err := os.ReadFile(readyFile)
	if err != nil {
		log.WithError(err).Errorf("could not find ready file at %v", readyFile)
		return
	}

	var ready csapi.WorkspaceReadyMessage
	err = json.Unmarshal(content, &ready)
	if err != nil {
		log.WithError(err).Error("could not unmarshal ready")
		return
	}

	for _, m := range ready.Metrics {
		s.metrics.InitializerHistogram.WithLabelValues(m.Type).Observe(float64(m.Size) / m.Duration.Seconds())
	}
}

func (s *WorkspaceService) creator(req *api.InitWorkspaceRequest) session.WorkspaceFactory {
	var checkoutLocation string
	allLocations := csapi.GetCheckoutLocationsFromInitializer(req.Initializer)
	if len(allLocations) > 0 {
		checkoutLocation = allLocations[0]
	}
	return func(ctx context.Context, location string) (res *session.Workspace, err error) {
		return &session.Workspace{
			Location:              location,
			CheckoutLocation:      checkoutLocation,
			CreatedAt:             time.Now(),
			Owner:                 req.Metadata.Owner,
			WorkspaceID:           req.Metadata.MetaId,
			InstanceID:            req.Id,
			FullWorkspaceBackup:   req.FullWorkspaceBackup,
			PersistentVolumeClaim: req.PersistentVolumeClaim,
			ContentManifest:       req.ContentManifest,
			RemoteStorageDisabled: req.RemoteStorageDisabled,
			StorageQuota:          int(req.StorageQuotaBytes),

			ServiceLocDaemon: filepath.Join(s.config.WorkingArea, ServiceDirName(req.Id)),
			ServiceLocNode:   filepath.Join(s.config.WorkingAreaNode, ServiceDirName(req.Id)),
		}, nil
	}
}

// ServiceDirName produces the directory name for a workspace
func ServiceDirName(instanceID string) string {
	return instanceID + "-daemon"
}

// DisposeWorkspace cleans up a workspace, possibly after taking a final backup
func (s *WorkspaceService) DisposeWorkspace(ctx context.Context, req *api.DisposeWorkspaceRequest) (resp *api.DisposeWorkspaceResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "DisposeWorkspace")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	tracing.LogRequestSafe(span, req)
	defer tracing.FinishSpan(span, &err)

	log.WithField("req", req.String()).WithFields(log.OWI("", "", req.Id)).Debug("DisposeWorkspace called")

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}

	sess := s.store.Get(req.Id)
	if sess == nil {
		return nil, status.Error(codes.NotFound, fmt.Sprintf("cannot find workspace %s during DisposeWorkspace", req.Id))
	}

	// We were asked to do a backup of a session that was never ready. There seems to have been some state drift here - tell the caller.
	if req.Backup && !sess.IsReady() {
		return nil, status.Error(codes.FailedPrecondition, "workspace content was never ready")
	}

	// update log to contain OWI information
	log := log.WithFields(sess.OWI())

	// Maybe there's someone else already trying to dispose the workspace.
	// In that case we'll simply wait for that to happen.
	done, repo, err := sess.WaitOrMarkForDisposal(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	resp = &api.DisposeWorkspaceResponse{}
	if repo != nil {
		resp.GitStatus = repo
	}
	if done {
		return resp, nil
	}

	span.SetTag("backupLogs", req.BackupLogs)
	if req.BackupLogs {
		if sess.RemoteStorageDisabled {
			return nil, status.Errorf(codes.FailedPrecondition, "workspace has no remote storage")
		}

		// Ok, we have to do all the work
		err = s.uploadWorkspaceLogs(ctx, sess)
		if err != nil {
			log.WithError(err).Error("log backup failed")
			// atm we do not fail the workspace here, yet, because we still might succeed with its content!
		}
	}

	span.SetTag("backup", req.Backup)
	if req.Backup {
		if sess.RemoteStorageDisabled {
			return nil, status.Errorf(codes.FailedPrecondition, "workspace has no remote storage")
		}

		var (
			backupName = storage.DefaultBackup
			mfName     = storage.DefaultBackupManifest
		)
		if sess.FullWorkspaceBackup {
			backupName = fmt.Sprintf(storage.FmtFullWorkspaceBackup, time.Now().UnixNano())
		}

		err = s.uploadWorkspaceContent(ctx, sess, backupName, mfName)
		if err != nil {
			log.WithError(err).Error("final backup failed")
			return nil, status.Error(codes.DataLoss, "final backup failed")
		}
	}

	// Update the git status prior to deleting the workspace
	repo, err = sess.UpdateGitStatus(ctx, sess.PersistentVolumeClaim)
	if err != nil {
		// do not fail workspace because we were unable to get git status
		// which can happen for various reasons, including user corrupting his .git folder somehow
		// instead we log the error and continue cleaning up workspace
		// todo(pavel): it would be great if we can somehow bubble this up to user without failing workspace
		log.WithError(err).Warn("cannot get git status")
		span.LogKV("error", err.Error())
	}
	if repo != nil {
		resp.GitStatus = repo
	}

	err = s.store.Delete(ctx, req.Id)
	if err != nil {
		log.WithError(err).Error("cannot delete workspace from store")
		span.LogKV("error", err.Error())
		return nil, status.Error(codes.Internal, "cannot delete workspace from store")
	}

	// remove workspace daemon directory in the node
	if err := os.RemoveAll(sess.ServiceLocDaemon); err != nil {
		log.WithError(err).Error("cannot delete workspace daemon directory")
	}

	return resp, nil
}

func (s *WorkspaceService) uploadWorkspaceContent(ctx context.Context, sess *session.Workspace, backupName, mfName string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "uploadWorkspaceContent")
	span.SetTag("workspace", sess.WorkspaceID)
	span.SetTag("instance", sess.InstanceID)
	span.SetTag("backupName", backupName)
	span.SetTag("manifest", mfName)
	span.SetTag("full", sess.FullWorkspaceBackup)
	span.SetTag("pvc", sess.PersistentVolumeClaim)
	defer tracing.FinishSpan(span, &err)

	// TODO: remove once we migrate to PVCs
	// Avoid too many simultaneous backups in order to avoid excessive memory utilization.
	waitStart := time.Now()
	select {
	case s.backupWorkspaceLimiter <- struct{}{}:
	case <-time.After(15 * time.Minute):
		// we timed out on the rate limit - let's upload anyways, because we don't want to actually block
		// an upload. If we reach this point, chances are other things are broken. No upload should ever
		// take this long.
		s.metrics.BackupWaitingTimeoutCounter.Inc()
	}

	s.metrics.BackupWaitingTimeHist.Observe(time.Since(waitStart).Seconds())

	defer func() {
		<-s.backupWorkspaceLimiter
	}()

	var (
		loc  = sess.Location
		opts []storage.UploadOption
		mf   csapi.WorkspaceContentManifest
	)

	if sess.PersistentVolumeClaim {
		// currently not supported (will be done differently via snapshots)
		return status.Error(codes.FailedPrecondition, "uploadWorkspaceContent not supported yet when PVC feature is enabled")
	}

	if sess.FullWorkspaceBackup {
		// Backup any change located in the upper overlay directory of the workspace in the node
		loc = filepath.Join(sess.ServiceLocDaemon, "upper")

		err = json.Unmarshal(sess.ContentManifest, &mf)
		if err != nil {
			return xerrors.Errorf("cannot unmarshal original content manifest: %w", err)
		}
	}

	err = os.Remove(filepath.Join(sess.Location, wsinit.WorkspaceReadyFile))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		// We'll still upload the backup, well aware that the UX during restart will be broken.
		// But it's better to have a backup with all files (albeit one too many), than having no backup at all.
		log.WithError(err).WithFields(sess.OWI()).Warn("cannot remove workspace ready file")
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
	err = retryIfErr(ctx, s.config.Backup.Attempts, log.WithFields(sess.OWI()).WithField("op", "create archive"), func(ctx context.Context) (err error) {
		tmpf, err = os.CreateTemp(s.config.TmpDir, fmt.Sprintf("wsbkp-%s-*.tar", sess.InstanceID))
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

		err = BuildTarbal(ctx, loc, tmpf.Name(), sess.FullWorkspaceBackup, opts...)
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
		log.WithField("size", tmpfSize).WithField("location", tmpf.Name()).WithFields(sess.OWI()).Debug("created temp file for workspace backup upload")

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
	err = retryIfErr(ctx, s.config.Backup.Attempts, log.WithFields(sess.OWI()).WithField("op", "upload layer"), func(ctx context.Context) (err error) {
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

	err = retryIfErr(ctx, s.config.Backup.Attempts, log.WithFields(sess.OWI()).WithField("op", "upload manifest"), func(ctx context.Context) (err error) {
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
		log.WithFields(sess.OWI()).WithField("manifest", mf).Debug("uploading content manifest")

		tmpmf, err := os.CreateTemp(s.config.TmpDir, fmt.Sprintf("mf-%s-*.json", sess.InstanceID))
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

func (s *WorkspaceService) uploadWorkspaceLogs(ctx context.Context, sess *session.Workspace) (err error) {
	rs, ok := sess.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		return xerrors.Errorf("no remote storage configured")
	}

	logLocation := sess.Location
	if sess.PersistentVolumeClaim {
		logLocation = filepath.Join(sess.ServiceLocDaemon, "prestophookdata")
	}
	// currently we're only uploading prebuild log files
	logFiles, err := logs.ListPrebuildLogFiles(ctx, logLocation)
	if err != nil {
		return err
	}
	for _, absLogPath := range logFiles {
		taskID, parseErr := logs.ParseTaskIDFromPrebuildLogFilePath(absLogPath)
		if parseErr != nil {
			log.WithError(parseErr).Warn("cannot parse headless workspace log file name")
			continue
		}

		err = retryIfErr(ctx, s.config.Backup.Attempts, log.WithFields(sess.OWI()).WithField("op", "upload log"), func(ctx context.Context) (err error) {
			_, _, err = rs.UploadInstance(ctx, absLogPath, logs.UploadedHeadlessLogPath(taskID))
			if err != nil {
				return
			}

			return
		})
		if err != nil {
			return xerrors.Errorf("cannot upload workspace content: %w", err)
		}
	}
	return err
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

// WaitForInit waits until a workspace is fully initialized.
func (s *WorkspaceService) WaitForInit(ctx context.Context, req *api.WaitForInitRequest) (resp *api.WaitForInitResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "WaitForInit")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}

	session := s.store.Get(req.Id)
	if session == nil {
		return nil, status.Error(codes.NotFound, fmt.Sprintf("cannot find workspace %s during WaitForInit", req.Id))
	}

	// the next call will block until the workspace is initialized
	ready := session.WaitForInit(ctx)
	if !ready {
		return nil, status.Error(codes.FailedPrecondition, "workspace is not initializing or ready")
	}

	return &api.WaitForInitResponse{}, nil
}

// IsWorkspaceExists checks if ws-daemon is aware of this workspace.
func (s *WorkspaceService) IsWorkspaceExists(ctx context.Context, req *api.IsWorkspaceExistsRequest) (resp *api.IsWorkspaceExistsResponse, err error) {
	//nolint:ineffassign
	span, _ := opentracing.StartSpanFromContext(ctx, "IsWorkspaceExists")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}

	session := s.store.Get(req.Id)
	exists := false
	if session != nil {
		exists = true
	}

	return &api.IsWorkspaceExistsResponse{
		Exists: exists,
	}, nil
}

// TakeSnapshot creates a backup/snapshot of a workspace
func (s *WorkspaceService) TakeSnapshot(ctx context.Context, req *api.TakeSnapshotRequest) (res *api.TakeSnapshotResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "TakeSnapshot")
	span.SetTag("workspace", req.Id)
	defer tracing.FinishSpan(span, &err)

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}

	sess := s.store.Get(req.Id)
	if sess == nil {
		return nil, status.Error(codes.NotFound, fmt.Sprintf("cannot find workspace %s during TakeSnapshot", req.Id))
	}
	if !sess.IsReady() {
		return nil, status.Error(codes.FailedPrecondition, "workspace is not ready")
	}
	if sess.RemoteStorageDisabled {
		return nil, status.Error(codes.FailedPrecondition, "workspace has no remote storage")
	}
	if sess.PersistentVolumeClaim {
		return nil, status.Error(codes.FailedPrecondition, "snapshots are not support yet when persistent volume claim feature is enabled")
	}
	rs, ok := sess.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		log.WithFields(sess.OWI()).WithError(err).Error("cannot upload snapshot: no remote storage configured")
		return nil, status.Error(codes.Internal, "workspace has no remote storage")
	}

	var (
		baseName     = fmt.Sprintf("snapshot-%d", time.Now().UnixNano())
		backupName   = baseName + ".tar"
		mfName       = baseName + ".mf.json"
		snapshotName string
	)
	if sess.FullWorkspaceBackup {
		snapshotName = rs.Qualify(mfName)
	} else {
		snapshotName = rs.Qualify(backupName)
	}

	if req.ReturnImmediately {
		go func() {
			ctx := context.Background()
			err := s.uploadWorkspaceContent(ctx, sess, backupName, mfName)
			if err != nil {
				log.WithError(err).WithField("workspaceId", req.Id).Error("snapshot upload failed")
			}
		}()
	} else {
		err = s.uploadWorkspaceContent(ctx, sess, backupName, mfName)
		if err != nil {
			log.WithError(err).WithField("workspaceId", req.Id).Error("snapshot upload failed")
			return nil, status.Error(codes.Internal, "cannot upload snapshot")
		}
	}

	return &api.TakeSnapshotResponse{
		Url: snapshotName,
	}, nil
}

// BackupWorkspace creates a backup of a workspace, if possible
func (s *WorkspaceService) BackupWorkspace(ctx context.Context, req *api.BackupWorkspaceRequest) (res *api.BackupWorkspaceResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "BackupWorkspace")
	span.SetTag("workspace", req.Id)
	defer tracing.FinishSpan(span, &err)

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}

	sess := s.store.Get(req.Id)
	if sess == nil {
		// TODO(rl): do we want to fake a session just to see if we can access the location
		// Potentiall fragile but we are probably using the backup in dire straits :shrug:
		// i.e. location = /mnt/disks/ssd0/workspaces- + req.Id
		// It would also need to setup the remote storagej
		// ... but in the worse case we *could* backup locally and then upload manually
		return nil, status.Error(codes.NotFound, fmt.Sprintf("cannot find workspace %s during BackupWorkspace", req.Id))
	}
	if sess.RemoteStorageDisabled {
		return nil, status.Errorf(codes.FailedPrecondition, "workspace has no remote storage")
	}
	if sess.PersistentVolumeClaim {
		return nil, status.Errorf(codes.FailedPrecondition, "workspace backup not supported yet when persistent volume claim feature is enabled")
	}
	rs, ok := sess.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		log.WithFields(sess.OWI()).WithError(err).Error("cannot take backup: no remote storage configured")
		return nil, status.Error(codes.Internal, "workspace has no remote storage")
	}

	backupName := storage.DefaultBackup
	var mfName = storage.DefaultBackupManifest
	// TODO: do we want this always in the worse case?
	if sess.FullWorkspaceBackup {
		backupName = fmt.Sprintf(storage.FmtFullWorkspaceBackup, time.Now().UnixNano())
	}
	log.WithField("workspaceId", sess.WorkspaceID).WithField("instanceID", sess.InstanceID).WithField("backupName", backupName).Info("backing up")

	err = s.uploadWorkspaceContent(ctx, sess, backupName, mfName)
	if err != nil {
		log.WithError(err).WithFields(sess.OWI()).Error("final backup failed")
		return nil, status.Error(codes.DataLoss, "final backup failed")
	}

	var qualifiedName string
	if sess.FullWorkspaceBackup {
		qualifiedName = rs.Qualify(mfName)
	} else {
		qualifiedName = rs.Qualify(backupName)
	}
	return &api.BackupWorkspaceResponse{
		Url: qualifiedName,
	}, nil
}

// Close ends this service and its housekeeping
func (s *WorkspaceService) Close() error {
	s.stopService()
	return nil
}

// cannotCancelContext is a bit of a hack. We have some operations which we want to keep alive even after clients
// disconnect. gRPC cancels the context once a client disconnects, thus we intercept the cancelation and act as if
// nothing had happened.
//
// This cannot be the best way to do this. Ideally we'd like to intercept client disconnect, but maintain the usual
// cancelation mechanism such as deadlines, timeouts, explicit cancelation.
type cannotCancelContext struct {
	Delegate context.Context
	done     chan struct{}
}

func (*cannotCancelContext) Deadline() (deadline time.Time, ok bool) {
	// return ok==false which means there's no deadline set
	return time.Time{}, false
}

func (c *cannotCancelContext) Done() <-chan struct{} {
	return c.done
}

func (c *cannotCancelContext) Err() error {
	err := c.Delegate.Err()
	if err == context.Canceled {
		return nil
	}

	return err
}

func (c *cannotCancelContext) Value(key interface{}) interface{} {
	return c.Delegate.Value(key)
}
