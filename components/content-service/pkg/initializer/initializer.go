// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	// WorkspaceReadyFile is the name of the ready file we're placing in a workspace
	WorkspaceReadyFile = ".gitpod/ready"

	// GitpodUID is the user ID of the gitpod user
	GitpodUID = 33333

	// GitpodGID is the group ID of the gitpod user group
	GitpodGID = 33333

	// otsDownloadAttempts is the number of times we'll attempt to download the one-time secret
	otsDownloadAttempts = 10
)

// Initializer can initialize a workspace with content
type Initializer interface {
	Run(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, error)
}

// EmptyInitializer does nothing
type EmptyInitializer struct{}

// Run does nothing
func (e *EmptyInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (csapi.WorkspaceInitSource, error) {
	return csapi.WorkspaceInitFromOther, nil
}

// NewFromRequest picks the initializer from the request but does not execute it.
// Returns gRPC errors.
func NewFromRequest(ctx context.Context, loc string, rs storage.DirectDownloader, req *csapi.WorkspaceInitializer) (i Initializer, err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "NewFromRequest")
	defer tracing.FinishSpan(span, &err)

	spec := req.Spec
	var initializer Initializer
	if _, ok := spec.(*csapi.WorkspaceInitializer_Empty); ok {
		initializer = &EmptyInitializer{}
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Git); ok {
		if ir.Git == nil {
			return nil, status.Error(codes.InvalidArgument, "missing Git initializer spec")
		}

		initializer, err = newGitInitializer(ctx, loc, ir.Git)
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Prebuild); ok {
		if ir.Prebuild == nil {
			return nil, status.Error(codes.InvalidArgument, "missing prebuild initializer spec")
		}
		if ir.Prebuild.Git == nil {
			return nil, status.Error(codes.InvalidArgument, "missing prebuild Git initializer spec")
		}

		gitinit, err := newGitInitializer(ctx, loc, ir.Prebuild.Git)
		if err != nil {
			return nil, err
		}
		var snapshot *SnapshotInitializer
		if ir.Prebuild.Prebuild != nil {
			snapshot, err = newSnapshotInitializer(loc, rs, ir.Prebuild.Prebuild)
			if err != nil {
				return nil, status.Error(codes.Internal, fmt.Sprintf("cannot setup prebuild init: %v", err))
			}
		}

		initializer = &PrebuildInitializer{
			Git:      gitinit,
			Prebuild: snapshot,
		}
	} else if ir, ok := spec.(*csapi.WorkspaceInitializer_Snapshot); ok {
		initializer, err = newSnapshotInitializer(loc, rs, ir.Snapshot)
	} else {
		initializer = &EmptyInitializer{}
	}
	if err != nil {
		return nil, status.Error(codes.Internal, fmt.Sprintf("cannot initialize workspace: %v", err))
	}

	return initializer, nil
}

// newGitInitializer creates a Git initializer based on the request.
// Returns gRPC errors.
func newGitInitializer(ctx context.Context, loc string, req *csapi.GitInitializer) (*GitInitializer, error) {
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
				return "", "", status.Error(codes.InvalidArgument, fmt.Sprintf("cannot get OTS"))
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
		},
		TargetMode:  targetMode,
		CloneTarget: req.CloneTaget,
	}, nil
}

func newSnapshotInitializer(loc string, rs storage.DirectDownloader, req *csapi.SnapshotInitializer) (*SnapshotInitializer, error) {
	return &SnapshotInitializer{
		Location: loc,
		Snapshot: req.Snapshot,
		Storage:  rs,
	}, nil
}

func downloadOTS(ctx context.Context, url string) (user, pwd string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "downloadOTS")
	defer tracing.FinishSpan(span, &err)
	span.LogKV("url", url)

	dl := func() (user, pwd string, err error) {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return "", "", err
		}
		opentracing.GlobalTracer().Inject(span.Context(), opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return "", "", xerrors.Errorf("non-OK OTS response: %s", resp.Status)
		}

		secret, err := ioutil.ReadAll(resp.Body)
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
		return "", "", err
	}

	return user, pwd, nil
}

// InitializeOpt configures the initialisation procedure
type InitializeOpt func(*initializeOpts)

type initializeOpts struct {
	Initializer Initializer
	CleanSlate  bool
	InWorkspace bool
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

// WithInWorkspace makes the initialization process behave well when running within a workspace
func WithInWorkspace(o *initializeOpts) {
	o.InWorkspace = true
}

// WithChown sets a custom UID/GID the content will have after initialisation
func WithChown(uid, gid int) InitializeOpt {
	return func(o *initializeOpts) {
		o.UID = uid
		o.GID = gid
	}
}

// InitializeWorkspace initializes a workspace from backup or an initializer
func InitializeWorkspace(ctx context.Context, location string, remoteStorage storage.DirectDownloader, opts ...InitializeOpt) (src csapi.WorkspaceInitSource, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "InitializeWorkspace")
	span.SetTag("location", location)
	defer tracing.FinishSpan(span, &err)

	cfg := initializeOpts{
		Initializer: &EmptyInitializer{},
		CleanSlate:  false,
		InWorkspace: false,
		GID:         GitpodGID,
		UID:         GitpodUID,
	}
	for _, o := range opts {
		o(&cfg)
	}

	src = csapi.WorkspaceInitFromOther

	if cfg.CleanSlate {
		// 1. Clean out the workspace directory
		if _, err := os.Stat(location); os.IsNotExist(err) {
			// in the very unlikely event that the workspace Pod did not mount (and thus create) the workspace directory, create it
			err = os.Mkdir(location, 0755)
			if os.IsExist(err) {
				log.WithError(err).WithField("location", location).Debug("ran into non-atomic workspce location existence check")
				span.SetTag("exists", true)
			} else if err != nil {
				return src, xerrors.Errorf("cannot create workspace: %w", err)
			}
		}
		fs, err := ioutil.ReadDir(location)
		if err != nil {
			return src, xerrors.Errorf("cannot clean workspace folder: %w", err)
		}
		for _, f := range fs {
			err := os.RemoveAll(filepath.Join(location, f.Name()))
			if err != nil {
				return src, xerrors.Errorf("cannot clean workspace folder: %w", err)
			}
		}

		// Chown the workspace directory
		err = os.Chown(location, cfg.UID, cfg.GID)
		if err != nil {
			return src, xerrors.Errorf("cannot create workspace: %w", err)
		}
	}

	// Run the initializer
	hasBackup, err := remoteStorage.Download(ctx, location, storage.DefaultBackup, cfg.mappings)
	if err != nil {
		return src, xerrors.Errorf("cannot restore backup: %w", err)
	}

	span.SetTag("hasBackup", hasBackup)
	if hasBackup {
		src = csapi.WorkspaceInitFromBackup
	} else {
		src, err = cfg.Initializer.Run(ctx, cfg.mappings)
		if err != nil {
			return src, xerrors.Errorf("cannot initialize workspace: %w", err)
		}
	}

	return
}

// PlaceWorkspaceReadyFile writes a file in the workspace which indicates that the workspace has been initialized
func PlaceWorkspaceReadyFile(ctx context.Context, wspath string, initsrc csapi.WorkspaceInitSource, uid, gid int) (err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "placeWorkspaceReadyFile")
	span.SetTag("source", initsrc)
	defer tracing.FinishSpan(span, &err)

	content := csapi.WorkspaceReadyMessage{
		Source: initsrc,
	}
	fc, err := json.Marshal(content)
	if err != nil {
		return xerrors.Errorf("cannot marshal workspace ready message: %w", err)
	}

	gitpodDir := filepath.Join(wspath, filepath.Dir(WorkspaceReadyFile))
	err = os.MkdirAll(gitpodDir, 0777)
	if err != nil {
		return xerrors.Errorf("cannot write workspace ready file: %w", err)
	}
	err = os.Chown(gitpodDir, uid, gid)
	if err != nil {
		return xerrors.Errorf("cannot write workspace-ready file: %w", err)
	}

	tempWorkspaceReadyFile := WorkspaceReadyFile + ".tmp"
	fn := filepath.Join(wspath, tempWorkspaceReadyFile)
	err = ioutil.WriteFile(fn, []byte(fc), 0644)
	if err != nil {
		return xerrors.Errorf("cannot write workspace ready file: %w", err)
	}
	err = os.Chown(fn, uid, gid)
	if err != nil {
		return xerrors.Errorf("cannot write workspace ready file: %w", err)
	}

	// Theia will listen for a rename event as trigger to start the tasks. This is a rename event
	// because we're writing to the file and this is the most convenient way we can tell Theia that we're done writing.
	err = os.Rename(fn, filepath.Join(wspath, WorkspaceReadyFile))
	if err != nil {
		return xerrors.Errorf("cannot write workspace ready file: %w", err)
	}

	return nil
}
