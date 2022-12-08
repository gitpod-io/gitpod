// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/opencontainers/go-digest"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

const (
	// WorkspaceReadyFile is the name of the ready file we're placing in a workspace
	WorkspaceReadyFile = ".gitpod/ready"

	// GitpodUID is the user ID of the gitpod user
	GitpodUID = 33333

	// GitpodGID is the group ID of the gitpod user group
	GitpodGID = 33333

	// otsDownloadAttempts is the number of times we'll attempt to download the one-time secret
	otsDownloadAttempts = 20
)

// Initializer can initialize a workspace with content
type Initializer interface {
	Run(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, csapi.InitializerMetrics, error)
}

// EmptyInitializer does nothing
type EmptyInitializer struct{}

// Run does nothing
func (e *EmptyInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, csapi.InitializerMetrics, error) {
	return csapi.WorkspaceInitFromOther, nil, nil
}

// CompositeInitializer does nothing
type CompositeInitializer []Initializer

// Run calls run on all child initializers
func (e CompositeInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (_ csapi.WorkspaceInitSource, _ csapi.InitializerMetrics, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "CompositeInitializer.Run")
	defer tracing.FinishSpan(span, &err)
	start := time.Now()
	initialSize, fsErr := getFsUsage()
	if fsErr != nil {
		log.WithError(fsErr).Error("could not get disk usage")
	}

	total := []csapi.InitializerMetric{}
	for _, init := range e {
		_, stats, err := init.Run(ctx, mappings)
		if err != nil {
			return csapi.WorkspaceInitFromOther, nil, err
		}
		total = append(total, stats...)
	}

	if fsErr == nil {
		currentSize, fsErr := getFsUsage()
		if fsErr != nil {
			log.WithError(fsErr).Error("could not get disk usage")
		}

		total = append(total, csapi.InitializerMetric{
			Type:     "composite",
			Duration: time.Since(start),
			Size:     currentSize - initialSize,
		})
	}

	return csapi.WorkspaceInitFromOther, total, nil
}

// NewFromRequestOpts configures the initializer produced from a content init request
type NewFromRequestOpts struct {
	// ForceGitpodUserForGit forces gitpod:gitpod ownership on all files produced by the Git initializer.
	// For FWB workspaces the content init is run from supervisor which runs as UID 0. Using this flag, the
	// Git content is forced to the Gitpod user. All other content (backup, prebuild, snapshot) will already
	// have the correct user.
	ForceGitpodUserForGit bool
}

// NewFromRequest picks the initializer from the request but does not execute it.
// Returns gRPC errors.
func NewFromRequest(ctx context.Context, loc string, rs storage.DirectDownloader, req *csapi.WorkspaceInitializer, opts NewFromRequestOpts) (i Initializer, err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "NewFromRequest")
	defer tracing.FinishSpan(span, &err)
	span.LogKV("opts", opts)

	spec := req.Spec
	var initializer Initializer
	if _, ok := spec.(*csapi.WorkspaceInitializer_Empty); ok {
		initializer = &EmptyInitializer{}
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Composite); ok {
		initializers := make([]Initializer, len(ir.Composite.Initializer))
		for i, init := range ir.Composite.Initializer {
			initializers[i], err = NewFromRequest(ctx, loc, rs, init, opts)
			if err != nil {
				return nil, err
			}
		}
		initializer = CompositeInitializer(initializers)
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Git); ok {
		if ir.Git == nil {
			return nil, status.Error(codes.InvalidArgument, "missing Git initializer spec")
		}

		initializer, err = newGitInitializer(ctx, loc, ir.Git, opts.ForceGitpodUserForGit)
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Prebuild); ok {
		if ir.Prebuild == nil {
			return nil, status.Error(codes.InvalidArgument, "missing prebuild initializer spec")
		}
		var snapshot *SnapshotInitializer
		if ir.Prebuild.Prebuild != nil {
			snapshot, err = newSnapshotInitializer(loc, rs, ir.Prebuild.Prebuild)
			if err != nil {
				return nil, status.Error(codes.Internal, fmt.Sprintf("cannot setup prebuild init: %v", err))
			}
		}
		var gits []*GitInitializer
		for _, gi := range ir.Prebuild.Git {
			gitinit, err := newGitInitializer(ctx, loc, gi, opts.ForceGitpodUserForGit)
			if err != nil {
				return nil, err
			}
			gits = append(gits, gitinit)
		}
		initializer = &PrebuildInitializer{
			Prebuild: snapshot,
			Git:      gits,
		}
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Snapshot); ok {
		initializer, err = newSnapshotInitializer(loc, rs, ir.Snapshot)
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Download); ok {
		initializer, err = newFileDownloadInitializer(loc, ir.Download)
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Backup); ok {
		initializer, err = newFromBackupInitializer(loc, rs, ir.Backup)
	} else {
		initializer = &EmptyInitializer{}
	}
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	return initializer, nil
}

// newFileDownloadInitializer creates a download initializer for a request
func newFileDownloadInitializer(loc string, req *csapi.FileDownloadInitializer) (*fileDownloadInitializer, error) {
	fileInfos := make([]fileInfo, len(req.Files))
	for i, f := range req.Files {
		dgst, err := digest.Parse(f.Digest)
		if err != nil {
			return nil, xerrors.Errorf("invalid digest %s: %w", f.Digest, err)
		}
		fileInfos[i] = fileInfo{
			URL:    f.Url,
			Path:   f.FilePath,
			Digest: dgst,
		}
	}
	initializer := &fileDownloadInitializer{
		FilesInfos:     fileInfos,
		TargetLocation: filepath.Join(loc, req.TargetLocation),
		HTTPClient:     http.DefaultClient,
		RetryTimeout:   1 * time.Second,
	}
	return initializer, nil
}

// newFromBackupInitializer creates a backup restoration initializer for a request
func newFromBackupInitializer(loc string, rs storage.DirectDownloader, req *csapi.FromBackupInitializer) (*fromBackupInitializer, error) {
	return &fromBackupInitializer{
		Location:           loc,
		RemoteStorage:      rs,
		FromVolumeSnapshot: req.FromVolumeSnapshot,
	}, nil
}

type fromBackupInitializer struct {
	Location           string
	RemoteStorage      storage.DirectDownloader
	FromVolumeSnapshot bool
}

func (bi *fromBackupInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, stats csapi.InitializerMetrics, err error) {
	if bi.FromVolumeSnapshot {
		return csapi.WorkspaceInitFromBackup, nil, nil
	}

	start := time.Now()
	initialSize, fsErr := getFsUsage()
	if fsErr != nil {
		log.WithError(fsErr).Error("could not get disk usage")
	}

	hasBackup, err := bi.RemoteStorage.Download(ctx, bi.Location, storage.DefaultBackup, mappings)
	if !hasBackup {
		if err != nil {
			return src, nil, xerrors.Errorf("no backup found, error: %w", err)
		}
		return src, nil, xerrors.Errorf("no backup found")
	}
	if err != nil {
		return src, nil, xerrors.Errorf("cannot restore backup: %w", err)
	}

	if fsErr == nil {
		currentSize, fsErr := getFsUsage()
		if fsErr != nil {
			log.WithError(fsErr).Error("could not get disk usage")
		}

		stats = csapi.InitializerMetrics{csapi.InitializerMetric{
			Type:     "fromBackup",
			Duration: time.Since(start),
			Size:     currentSize - initialSize,
		}}
	}

	return csapi.WorkspaceInitFromBackup, stats, nil
}

// newGitInitializer creates a Git initializer based on the request.
// Returns gRPC errors.
func newGitInitializer(ctx context.Context, loc string, req *csapi.GitInitializer, forceGitpodUser bool) (*GitInitializer, error) {
	if req.Config == nil {
		return nil, status.Error(codes.InvalidArgument, "Git initializer misses config")
	}

	var targetMode CloneTargetMode
	switch req.TargetMode {
	case csapi.CloneTargetMode_LOCAL_BRANCH:
		targetMode = LocalBranch
	case csapi.CloneTargetMode_REMOTE_BRANCH:
		targetMode = RemoteBranch
	case csapi.CloneTargetMode_REMOTE_COMMIT:
		targetMode = RemoteCommit
	case csapi.CloneTargetMode_REMOTE_HEAD:
		targetMode = RemoteHead
	default:
		return nil, status.Error(codes.InvalidArgument, fmt.Sprintf("invalid target mode: %v", req.TargetMode))
	}

	var authMethod = git.BasicAuth
	if req.Config.Authentication == csapi.GitAuthMethod_NO_AUTH {
		authMethod = git.NoAuth
	}

	// the auth provider must cache the OTS because it may be used several times,
	// but can download the one-time-secret only once.
	authProvider := git.CachingAuthProvider(func() (user string, pwd string, err error) {
		switch req.Config.Authentication {
		case csapi.GitAuthMethod_BASIC_AUTH:
			user = req.Config.AuthUser
			pwd = req.Config.AuthPassword
		case csapi.GitAuthMethod_BASIC_AUTH_OTS:
			user, pwd, err = downloadOTS(ctx, req.Config.AuthOts)
			if err != nil {
				log.WithField("location", loc).WithError(err).Error("cannot download Git auth OTS")
				return "", "", status.Error(codes.InvalidArgument, "cannot get OTS")
			}
		case csapi.GitAuthMethod_NO_AUTH:
		default:
			return "", "", status.Error(codes.InvalidArgument, fmt.Sprintf("invalid Git authentication method: %v", req.Config.Authentication))
		}

		return
	})

	log.WithField("location", loc).Debug("using Git initializer")
	return &GitInitializer{
		Client: git.Client{
			Location:          filepath.Join(loc, req.CheckoutLocation),
			RemoteURI:         req.RemoteUri,
			UpstreamRemoteURI: req.Upstream_RemoteUri,
			Config:            req.Config.CustomConfig,
			AuthMethod:        authMethod,
			AuthProvider:      authProvider,
			RunAsGitpodUser:   forceGitpodUser,
		},
		TargetMode:  targetMode,
		CloneTarget: req.CloneTaget,
		Chown:       false,
	}, nil
}

func newSnapshotInitializer(loc string, rs storage.DirectDownloader, req *csapi.SnapshotInitializer) (*SnapshotInitializer, error) {
	return &SnapshotInitializer{
		Location:           loc,
		Snapshot:           req.Snapshot,
		Storage:            rs,
		FromVolumeSnapshot: req.FromVolumeSnapshot,
	}, nil
}

func downloadOTS(ctx context.Context, url string) (user, pwd string, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "downloadOTS")
	defer tracing.FinishSpan(span, &err)
	span.LogKV("url", url)

	dl := func() (user, pwd string, err error) {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return "", "", err
		}
		_ = opentracing.GlobalTracer().Inject(span.Context(), opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return "", "", xerrors.Errorf("non-OK OTS response: %s", resp.Status)
		}

		secret, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", "", err
		}

		pwd = string(secret)
		if segs := strings.Split(pwd, ":"); len(segs) >= 2 {
			user = segs[0]
			pwd = strings.Join(segs[1:], ":")
		}
		return
	}
	for i := 0; i < otsDownloadAttempts; i++ {
		span.LogKV("attempt", i)
		if i > 0 {
			time.Sleep(time.Second)
		}

		user, pwd, err = dl()
		if err == context.Canceled || err == context.DeadlineExceeded {
			return
		}
		if err == nil {
			break
		}
		log.WithError(err).WithField("attempt", i).Warn("cannot download OTS")
	}
	if err != nil {
		log.WithError(err).Warn("failed to download OTS")
		return "", "", err
	}

	return user, pwd, nil
}

// InitializeOpt configures the initialisation procedure
type InitializeOpt func(*initializeOpts)

type initializeOpts struct {
	Initializer Initializer
	CleanSlate  bool
	UID         int
	GID         int
	mappings    []archive.IDMapping
}

// WithMappings configures the UID mappings that're used during content initialization
func WithMappings(mappings []archive.IDMapping) InitializeOpt {
	return func(o *initializeOpts) {
		o.mappings = mappings
	}
}

// WithInitializer configures the initializer that's used during content initialization
func WithInitializer(initializer Initializer) InitializeOpt {
	return func(o *initializeOpts) {
		o.Initializer = initializer
	}
}

// WithCleanSlate ensures there's no prior content in the workspace location
func WithCleanSlate(o *initializeOpts) {
	o.CleanSlate = true
}

// WithChown sets a custom UID/GID the content will have after initialisation
func WithChown(uid, gid int) InitializeOpt {
	return func(o *initializeOpts) {
		o.UID = uid
		o.GID = gid
	}
}

// InitializeWorkspace initializes a workspace from backup or an initializer
func InitializeWorkspace(ctx context.Context, location string, remoteStorage storage.DirectDownloader, opts ...InitializeOpt) (src csapi.WorkspaceInitSource, stats csapi.InitializerMetrics, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "InitializeWorkspace")
	span.SetTag("location", location)
	defer tracing.FinishSpan(span, &err)

	cfg := initializeOpts{
		Initializer: &EmptyInitializer{},
		CleanSlate:  false,
		GID:         GitpodGID,
		UID:         GitpodUID,
	}
	for _, o := range opts {
		o(&cfg)
	}

	src = csapi.WorkspaceInitFromOther

	// Note: it's important that CleanSlate does not remove the location itself, but merely its content.
	//       If the location were removed that might break the filesystem quota we have put in place prior.
	if cfg.CleanSlate {
		// 1. Clean out the workspace directory
		if _, err := os.Stat(location); errors.Is(err, fs.ErrNotExist) {
			// in the very unlikely event that the workspace Pod did not mount (and thus create) the workspace directory, create it
			err = os.Mkdir(location, 0755)
			if os.IsExist(err) {
				log.WithError(err).WithField("location", location).Debug("ran into non-atomic workspace location existence check")
				span.SetTag("exists", true)
			} else if err != nil {
				return src, nil, xerrors.Errorf("cannot create workspace: %w", err)
			}
		}
		fs, err := os.ReadDir(location)
		if err != nil {
			return src, nil, xerrors.Errorf("cannot clean workspace folder: %w", err)
		}
		for _, f := range fs {
			path := filepath.Join(location, f.Name())
			err := os.RemoveAll(path)
			if err != nil {
				return src, nil, xerrors.Errorf("cannot clean workspace folder: %w", err)
			}
		}

		// Chown the workspace directory
		err = os.Chown(location, cfg.UID, cfg.GID)
		if err != nil {
			return src, nil, xerrors.Errorf("cannot create workspace: %w", err)
		}
	}

	// Run the initializer
	hasBackup, err := remoteStorage.Download(ctx, location, storage.DefaultBackup, cfg.mappings)
	if err != nil {
		return src, nil, xerrors.Errorf("cannot restore backup: %w", err)
	}

	span.SetTag("hasBackup", hasBackup)
	if hasBackup {
		src = csapi.WorkspaceInitFromBackup
	} else {
		src, stats, err = cfg.Initializer.Run(ctx, cfg.mappings)
		if err != nil {
			return src, nil, xerrors.Errorf("cannot initialize workspace: %w", err)
		}
	}

	return
}

// Some workspace content may have a `/dst/.gitpod` file or directory. That would break
// the workspace ready file placement (see https://github.com/gitpod-io/gitpod/issues/7694).
// This function ensures that workspaces do not have a `.gitpod` file or directory present.
func EnsureCleanDotGitpodDirectory(ctx context.Context, wspath string) error {
	var mv func(src, dst string) error
	if git.IsWorkingCopy(wspath) {
		c := &git.Client{
			Location: wspath,
		}
		mv = func(src, dst string) error {
			return c.Git(ctx, "mv", src, dst)
		}
	} else {
		mv = os.Rename
	}

	dotGitpod := filepath.Join(wspath, ".gitpod")
	stat, err := os.Stat(dotGitpod)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if stat.IsDir() {
		// we need this to be a directory, we're probably ok
		return nil
	}

	candidateFN := filepath.Join(wspath, ".gitpod.yaml")
	if _, err := os.Stat(candidateFN); err == nil {
		// Our candidate file already exists, hence we cannot just move things.
		// As fallback we'll delete the .gitpod entry.
		return os.RemoveAll(dotGitpod)
	}

	err = mv(dotGitpod, candidateFN)
	if err != nil {
		return err
	}

	return nil
}

// PlaceWorkspaceReadyFile writes a file in the workspace which indicates that the workspace has been initialized
func PlaceWorkspaceReadyFile(ctx context.Context, wspath string, initsrc csapi.WorkspaceInitSource, metrics csapi.InitializerMetrics, uid, gid int) (err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "placeWorkspaceReadyFile")
	span.SetTag("source", initsrc)
	defer tracing.FinishSpan(span, &err)

	content := csapi.WorkspaceReadyMessage{
		Source:  initsrc,
		Metrics: metrics,
	}
	fc, err := json.Marshal(content)
	if err != nil {
		return xerrors.Errorf("cannot marshal workspace ready message: %w", err)
	}

	gitpodDir := filepath.Join(wspath, filepath.Dir(WorkspaceReadyFile))
	err = os.MkdirAll(gitpodDir, 0777)
	if err != nil {
		return xerrors.Errorf("cannot create directory for workspace ready file: %w", err)
	}
	err = os.Chown(gitpodDir, uid, gid)
	if err != nil {
		return xerrors.Errorf("cannot chown directory for workspace ready file: %w", err)
	}

	tempWorkspaceReadyFile := WorkspaceReadyFile + ".tmp"
	fn := filepath.Join(wspath, tempWorkspaceReadyFile)
	err = os.WriteFile(fn, []byte(fc), 0644)
	if err != nil {
		return xerrors.Errorf("cannot write workspace ready file content: %w", err)
	}
	err = os.Chown(fn, uid, gid)
	if err != nil {
		return xerrors.Errorf("cannot chown workspace ready file: %w", err)
	}

	// Theia will listen for a rename event as trigger to start the tasks. This is a rename event
	// because we're writing to the file and this is the most convenient way we can tell Theia that we're done writing.
	err = os.Rename(fn, filepath.Join(wspath, WorkspaceReadyFile))
	if err != nil {
		return xerrors.Errorf("cannot rename workspace ready file: %w", err)
	}

	return nil
}

func getFsUsage() (uint64, error) {
	var stat syscall.Statfs_t

	err := syscall.Statfs("/dst", &stat)
	if os.IsNotExist(err) {
		err = syscall.Statfs("/workspace", &stat)
	}

	if err != nil {
		return 0, err
	}

	size := uint64(stat.Blocks) * uint64(stat.Bsize)
	free := uint64(stat.Bfree) * uint64(stat.Bsize)

	return size - free, nil
}
