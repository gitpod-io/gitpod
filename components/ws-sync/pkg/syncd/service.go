// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package syncd

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/cri"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-sync/api"
	"github.com/gitpod-io/gitpod/ws-sync/pkg/archive"
	"github.com/gitpod-io/gitpod/ws-sync/pkg/internal/session"
	"github.com/gitpod-io/gitpod/ws-sync/pkg/quota"
	"github.com/gitpod-io/gitpod/ws-sync/pkg/safetynet"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/opencontainers/go-digest"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// WorkspaceService implements the InitService and WorkspaceService
type WorkspaceService struct {
	config Configuration

	store       *session.Store
	stopService context.CancelFunc
	sandboxes   quota.SandboxProvider
	cric        cri.ContainerRuntimeInterface
}

// NewWorkspaceService creates a new workspce initialization service, starts housekeeping and the Prometheus integration
func NewWorkspaceService(ctx context.Context, cfg Configuration) (res *WorkspaceService, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "NewWorkspaceService")
	defer tracing.FinishSpan(span, &err)

	// connect to local container runtime
	var cric cri.ContainerRuntimeInterface
	if cfg.FullWorkspaceBackup.Enabled {
		cric, err = cri.FromConfig(cfg.FullWorkspaceBackup.CRI)
		if err != nil {
			return nil, xerrors.Errorf("cannot connect to container runtime: %w", err)
		}
		go func() {
			// TODO: handle this case more gracefully
			err := <-cric.Error()
			log.WithError(err).Fatal("container runtime interface error")
		}()
	}

	// create working area
	err = os.MkdirAll(cfg.WorkingArea, 0755)
	if err != nil {
		return nil, xerrors.Errorf("cannot create working area: %w", err)
	}

	// read all session json files
	store, err := session.NewStore(ctx, cfg.WorkingArea, workspaceLifecycleHooks(cfg))
	if err != nil {
		return nil, xerrors.Errorf("cannot create session store: %w", err)
	}
	ctx, stopService := context.WithCancel(ctx)
	store.StartHousekeeping(ctx, 5*time.Minute)
	if err := registerWorkingAreaDiskspaceGauge(cfg.WorkingArea); err != nil {
		log.WithError(err).Warn("cannot register Prometheus gauge for working area diskspace")
	}

	return &WorkspaceService{
		config:      cfg,
		store:       store,
		stopService: stopService,
		cric:        cric,
	}, nil
}

// registerWorkingAreaDiskspaceGauge registers a free disk space Prometheus gauge for a working area.
func registerWorkingAreaDiskspaceGauge(workingArea string) error {
	return prometheus.Register(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
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

// InitWorkspace intialises a new workspace folder in the working area
func (s *WorkspaceService) InitWorkspace(ctx context.Context, req *api.InitWorkspaceRequest) (resp *api.InitWorkspaceResponse, err error) {
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
	log.Info("InitWorkspace called")

	var (
		wsloc    string
		upperdir string
	)
	if req.FullWorkspaceBackup {
		if s.cric == nil {
			return nil, status.Errorf(codes.FailedPrecondition, "full workspace backup is not available - not connected to container runtime")
		}
		var mf csapi.WorkspaceContentManifest
		if len(req.ContentManifest) == 0 {
			return nil, status.Errorf(codes.InvalidArgument, "content manifest is required")
		}
		err = json.Unmarshal(req.ContentManifest, &mf)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid content manifest: %s", err.Error())
		}

		wscont, err := s.cric.WaitForContainer(ctx, req.Id)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "cannot find workspace container: %s", err.Error())
		}
		upperdir, err = s.cric.ContainerUpperdir(ctx, wscont)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "cannot find workspace upperdir: %s", err.Error())
		}
		log.WithField("cid", wscont).WithField("upperdir", upperdir).Debug("workspace container found")

		// This this point the workspace content is present and initialized because it was part of the container image.
		// There is no need to wait for the ready file here.
	} else {
		wsloc = filepath.Join(s.store.Location, req.Id)

		// This task/call cannot be canceled. Once it's started it's brought to a conclusion, independent of the caller disconnecting
		// or not. To achieve this we need to wrap the context in something that alters the cancelation behaviour.
		ctx = &cannotCancelContext{Delegate: ctx}
	}

	workspace, err := s.store.NewWorkspace(ctx, req.Id, wsloc, s.creator(req, upperdir))
	if err == session.ErrAlreadyExists {
		return nil, status.Error(codes.AlreadyExists, "workspace exists already")
	}
	if err != nil {
		return nil, err
	}

	rs, ok := workspace.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		log.Error("workspace has no remote storage")
		return nil, status.Error(codes.Internal, "workspace has no remote storage")
	}

	if !req.FullWorkspaceBackup {
		// Initialize workspace.
		// FWB workspaces initialize without the help of ws-sync, but using their supervisor or the registry-facade.
		initializer, err := wsinit.NewFromRequest(ctx, workspace.Location, rs, req.Initializer)
		if err != nil {
			log.WithError(err).WithField("instanceId", req.Id).Error("cannot initialize workspace")
			return nil, err
		}
		initSource, err := wsinit.InitializeWorkspace(ctx, workspace.Location, rs, wsinit.WithInitializer(initializer), wsinit.WithCleanSlate)
		if err != nil {
			log.WithError(err).WithField("workspaceId", req.Id).Error("cannot initialize workspace")
			return nil, status.Error(codes.Internal, fmt.Sprintf("cannot initialize workspace: %s", err.Error()))
		}

		// Place the ready file to make Theia "open its gates"
		err = wsinit.PlaceWorkspaceReadyFile(ctx, workspace.Location, initSource)
		if err != nil {
			tracing.LogError(span, err)
			log.WithField("workspaceId", req.Id).WithError(err).Warn("did not place auth token - workspace will have no access to our service")
		}
	}

	// Tell the world we're done
	err = workspace.MarkInitDone(ctx)
	if err != nil {
		log.WithError(err).WithField("workspaceId", req.Id).Error("cannot initialize workspace")
		return nil, status.Error(codes.Internal, fmt.Sprintf("cannot finish workspace init: %v", err))
	}

	return &api.InitWorkspaceResponse{}, nil
}

func (s *WorkspaceService) creator(req *api.InitWorkspaceRequest, upperdir string) session.WorkspaceFactory {
	return func(ctx context.Context, location string) (res *session.Workspace, err error) {
		err = s.createSandbox(ctx, req, location)
		if err != nil {
			return nil, err
		}

		return &session.Workspace{
			Location:            location,
			UpperdirLocation:    upperdir,
			CheckoutLocation:    getCheckoutLocation(req),
			CreatedAt:           time.Now(),
			Owner:               req.Metadata.Owner,
			WorkspaceID:         req.Metadata.MetaId,
			InstanceID:          req.Id,
			FullWorkspaceBackup: req.FullWorkspaceBackup,
			ContentManifest:     req.ContentManifest,
		}, nil
	}
}

func (s *WorkspaceService) createSandbox(ctx context.Context, req *api.InitWorkspaceRequest, location string) (err error) {
	if s.config.WorkspaceSizeLimit == 0 {
		return
	}

	span, ctx := opentracing.StartSpanFromContext(ctx, "createSandbox")
	defer tracing.FinishSpan(span, &err)

	owi := log.OWI(req.Metadata.Owner, req.Metadata.MetaId, req.Id)
	if req.FullWorkspaceBackup {
		msg := "cannot create sandboxes for workspaces with full workspace backup - skipping sandbox"
		span.LogKV("warning", msg)
		log.WithFields(owi).Warn(msg)
		return
	}

	// Create and mount sandbox
	mode := os.FileMode(0755)
	sandbox := filepath.Join(s.store.Location, req.Id+".sandbox")
	err = s.sandboxes.Create(ctx, sandbox, s.config.WorkspaceSizeLimit)
	if err != nil {
		log.WithFields(owi).WithField("sandbox", sandbox).WithField("location", location).WithError(err).Error("cannot create sandbox")
		return status.Error(codes.Internal, "cannot create sandbox")
	}
	if _, err := os.Stat(location); os.IsNotExist(err) {
		// in the very unlikely event that the workspace Pod did not mount (and thus create) the workspace directory, create it
		err = os.Mkdir(location, mode)
		if os.IsExist(err) {
			log.WithError(err).WithField("location", location).Debug("ran into non-atomic workspce location existence check")
		} else if err != nil {
			log.WithFields(owi).WithError(err).Error("cannot create workspace mount point")
			return status.Error(codes.Internal, "cannot create workspace")
		}
	}
	err = s.sandboxes.Mount(ctx, sandbox, location)
	if err != nil {
		log.WithFields(owi).WithField("sandbox", sandbox).WithField("location", location).WithError(err).Error("cannot mount sandbox")
		return status.Error(codes.Internal, "cannot mount sandbox")
	}
	return nil
}

// getCheckoutLocation returns the first checkout location found of any Git initializer configured by this request
func getCheckoutLocation(req *api.InitWorkspaceRequest) string {
	spec := req.Initializer.Spec
	if ir, ok := spec.(*csapi.WorkspaceInitializer_Git); ok {
		if ir.Git != nil {
			return ir.Git.CheckoutLocation
		}
	}
	if ir, ok := spec.(*csapi.WorkspaceInitializer_Prebuild); ok {
		if ir.Prebuild != nil && ir.Prebuild.Git != nil {
			return ir.Prebuild.Git.CheckoutLocation
		}
	}
	return ""
}

// DisposeWorkspace cleans up a workspace, possibly after taking a final backup
func (s *WorkspaceService) DisposeWorkspace(ctx context.Context, req *api.DisposeWorkspaceRequest) (resp *api.DisposeWorkspaceResponse, err error) {
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
		return nil, status.Error(codes.NotFound, "workspace does not exist")
	}

	// We were asked to do a backup of a session that was never ready. There seems to have been some state drift here - tell the caller.
	if req.Backup && !sess.IsReady() {
		return nil, status.Error(codes.FailedPrecondition, "workspace content was never ready")
	}

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

	// Ok, we have to do all the work
	if req.Backup {
		var (
			backupName = storage.DefaultBackup
			mfName     = storage.DefaultBackupManifest
		)
		if sess.FullWorkspaceBackup {
			backupName = fmt.Sprintf(storage.FmtFullWorkspaceBackup, time.Now().UnixNano())
		}

		err = s.uploadWorkspaceContent(ctx, sess, backupName, mfName)
		if err != nil {
			log.WithError(err).WithFields(sess.OWI()).Error("final backup failed")
			return nil, status.Error(codes.DataLoss, "final backup failed")
		}
	}

	// Update the git status prior to deleting the workspace
	repo, err = sess.UpdateGitStatus(ctx)
	if err != nil {
		log.WithError(err).WithField("workspaceId", req.Id).Error("cannot get git status")
		span.LogKV("error", err)
		return nil, status.Error(codes.Internal, "cannot get git status")
	}
	if repo != nil {
		resp.GitStatus = repo
	}

	if s.config.WorkspaceSizeLimit > 0 && !sess.FullWorkspaceBackup {
		// We can delete the sandbox here (rather than in the store) because WaitOrMarkForDisposal
		// ensures we're doing this exclusively for this workspace.
		err = s.sandboxes.Dispose(ctx, sess.Location)
		if err != nil {
			log.WithError(err).WithField("workspaceId", req.Id).Error("cannot dispose sandbox")
			span.LogKV("error", err)
			return nil, status.Error(codes.Internal, "cannot dispose sandbox")
		}
	}

	err = s.store.Delete(ctx, req.Id)
	if err != nil {
		log.WithError(err).WithField("workspaceId", req.Id).Error("cannot delete workspace from store")
		span.LogKV("error", err)
		return nil, status.Error(codes.Internal, "cannot delete workspace from store")
	}

	return resp, nil
}

func (s *WorkspaceService) uploadWorkspaceContent(ctx context.Context, sess *session.Workspace, backupName, mfName string) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "uploadWorkspaceContent")
	defer tracing.FinishSpan(span, &err)

	var (
		loc  = sess.Location
		opts []storage.UploadOption
		mf   csapi.WorkspaceContentManifest
	)
	if sess.FullWorkspaceBackup {
		lb, ok := sess.NonPersistentAttrs[session.AttrLiveBackup].(*safetynet.LiveWorkspaceBackup)
		if lb == nil || !ok {
			return xerrors.Errorf("workspace has no live backup configured")
		}

		loc, err = lb.Latest()
		if err != nil {
			return xerrors.Errorf("no live backup available: %w", err)
		}

		err = json.Unmarshal(sess.ContentManifest, &mf)
		if err != nil {
			return xerrors.Errorf("cannot unmarshal original content manifest: %w", err)
		}
	}

	err = os.Remove(filepath.Join(loc, wsinit.WorkspaceReadyFile))
	if err != nil && !os.IsNotExist(err) {
		// We'll still upload the backup, well aware that the UX during restart will be broken.
		// But it's better to have a backup with all files (albeit one too many), than having no backup at all.
		log.WithError(err).WithFields(sess.OWI()).Warn("cannot remove workspace ready file")
	}

	if s.config.Storage.BackupTrail.Enabled && !sess.FullWorkspaceBackup {
		opts = append(opts, storage.WithBackupTrail("trail", s.config.Storage.BackupTrail.MaxLength))
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
		tmpf, err = ioutil.TempFile(s.config.TmpDir, fmt.Sprintf("wsbkp-%s-*.tar", sess.InstanceID))
		if err != nil {
			return
		}
		defer func() {
			tmpf.Close()
			if err != nil {
				os.Remove(tmpf.Name())
			}
		}()

		err = archive.BuildTarbal(ctx, loc, tmpf.Name())
		if err != nil {
			return
		}
		tmpf.Sync()
		tmpf.Seek(0, 0)
		tmpfDigest, err = digest.FromReader(tmpf)
		if err != nil {
			return
		}

		stat, err := tmpf.Stat()
		if err != nil {
			return
		}
		tmpfSize = stat.Size()
		log.WithField("size", tmpfSize).WithFields(sess.OWI()).Debug("created temp file for workspace backup upload")

		return
	})
	if err != nil {
		return xerrors.Errorf("cannot create archive: %w", err)
	}
	defer func() {
		if err == nil && tmpf != nil {
			// we only remove the layer archive when there was no error during
			// upload, just as some sort of safety net.
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
		span.LogKV("manifest", mf)

		tmpmf, err := ioutil.TempFile(s.config.TmpDir, fmt.Sprintf("mf-%s-*.json", sess.InstanceID))
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

func retryIfErr(ctx context.Context, attempts int, log *logrus.Entry, op func(ctx context.Context) error) (err error) {
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
		span.LogKV("error", err)
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
	span, ctx := opentracing.StartSpanFromContext(ctx, "WaitForInit")
	tracing.ApplyOWI(span, log.OWI("", "", req.Id))
	defer tracing.FinishSpan(span, &err)

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "ID is required")
	}

	session := s.store.Get(req.Id)
	if session == nil {
		return nil, status.Error(codes.NotFound, "workspace does not exist")
	}

	// the next call will block until the workspace is initialized
	ready := session.WaitForInit(ctx)
	if !ready {
		return nil, status.Error(codes.FailedPrecondition, "workspace is not initializing or ready")
	}

	return &api.WaitForInitResponse{}, nil
}

// TakeSnapshot creates a backup/snapshot of a workspace
func (s *WorkspaceService) TakeSnapshot(ctx context.Context, req *api.TakeSnapshotRequest) (res *api.TakeSnapshotResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "TakeSnapshot")
	span.SetTag("workspace", req.Id)
	defer tracing.FinishSpan(span, &err)

	sess := s.store.Get(req.Id)
	if sess == nil {
		return nil, status.Error(codes.NotFound, "workspace does not exist")
	}
	if !sess.IsReady() {
		return nil, status.Error(codes.FailedPrecondition, "workspace is not ready")
	}
	rs, ok := sess.NonPersistentAttrs[session.AttrRemoteStorage].(storage.DirectAccess)
	if rs == nil || !ok {
		log.WithFields(sess.OWI()).WithError(err).Error("cannot upload snapshot: no remote storage configured")
		return nil, status.Error(codes.Internal, "workspace has no remote storage")
	}
	if sess.FullWorkspaceBackup {
		lb, ok := sess.NonPersistentAttrs[session.AttrLiveBackup].(*safetynet.LiveWorkspaceBackup)
		if lb == nil || !ok {
			log.WithFields(sess.OWI()).WithError(err).Error("cannot upload snapshot: no live backup available")
			return nil, status.Error(codes.Internal, "workspace has no live backup")
		}
		_, err = lb.Backup()
		if err != nil {
			log.WithFields(sess.OWI()).WithError(err).Error("cannot upload snapshot: live backup failed")
			return nil, status.Error(codes.Internal, "cannot upload snapshot")
		}
	}

	var (
		baseName     = fmt.Sprintf("snapshot-%d", time.Now().UnixNano())
		backupName   = baseName + ".tar"
		mfName       = baseName + ".mf.json"
		snapshotName string
	)
	if sess.FullWorkspaceBackup {
		snapshotName = rs.Qualify(mfName)

		// TODO: pause theia
	} else {
		snapshotName = rs.Qualify(backupName)
	}

	err = s.uploadWorkspaceContent(ctx, sess, backupName, mfName)
	if err != nil {
		log.WithError(err).WithField("workspaceId", req.Id).Error("snapshot upload failed")
		return nil, status.Error(codes.Internal, "cannot upload snapshot")
	}

	return &api.TakeSnapshotResponse{
		Url: snapshotName,
	}, nil
}

// Stop ends this service and its housekeeping
func (s *WorkspaceService) Stop() {
	s.stopService()
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

func workspaceLifecycleHooks(cfg Configuration) map[session.WorkspaceState][]session.WorkspaceLivecycleHook {
	var setupWorkspace session.WorkspaceLivecycleHook = func(ctx context.Context, ws *session.Workspace) error {
		if _, ok := ws.NonPersistentAttrs[session.AttrRemoteStorage]; !ok {
			remoteStorage, err := storage.NewDirectAccess(&cfg.Storage)
			if err != nil {
				return xerrors.Errorf("cannot use configured storage: %w", err)
			}

			err = remoteStorage.Init(ctx, ws.Owner, ws.WorkspaceID)
			if err != nil {
				return xerrors.Errorf("cannot use configured storage: %w", err)
			}

			err = remoteStorage.EnsureExists(ctx)
			if err != nil {
				return xerrors.Errorf("cannot use configured storage: %w", err)
			}

			ws.NonPersistentAttrs[session.AttrRemoteStorage] = remoteStorage
		}

		if _, ok := ws.NonPersistentAttrs[session.AttrLiveBackup]; ws.FullWorkspaceBackup && !ok {
			lb, err := cfg.FullWorkspaceBackup.NewLiveBackup(ws.InstanceID, ws.UpperdirLocation)
			if err != nil {
				return xerrors.Errorf("cannot create live backup: %w", err)
			}
			ws.NonPersistentAttrs[session.AttrLiveBackup] = lb
		}

		return nil
	}
	var startLiveBackup session.WorkspaceLivecycleHook = func(ctx context.Context, ws *session.Workspace) (err error) {
		if !ws.FullWorkspaceBackup {
			return
		}

		lbr, ok := ws.NonPersistentAttrs[session.AttrLiveBackup]
		if lbr == nil || !ok {
			log.WithFields(log.OWI(ws.Owner, ws.WorkspaceID, ws.InstanceID)).Warn("workspace is ready but did not have a live backup")

			lbr, err = cfg.FullWorkspaceBackup.NewLiveBackup(ws.InstanceID, ws.UpperdirLocation)
			if err != nil {
				return xerrors.Errorf("cannot create live backup: %w", err)
			}
			ws.NonPersistentAttrs[session.AttrLiveBackup] = lbr
		}

		lb, ok := lbr.(*safetynet.LiveWorkspaceBackup)
		if lbr == nil || !ok {
			return xerrors.Errorf("cannot start live backup - expected *LiveWorkspaceBackup")
		}

		return lb.Start()
	}

	return map[session.WorkspaceState][]session.WorkspaceLivecycleHook{
		session.WorkspaceInitializing: {setupWorkspace},
		session.WorkspaceReady:        {setupWorkspace, startLiveBackup, serveWorkspace(cfg.KubernetesNamespace)},
		session.WorkspaceDisposing:    {stopServingWorkspace},
	}
}
