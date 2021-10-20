// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package orchestrator

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/opentracing/opentracing-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/image-builder/api"
	protocol "github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/api/config"
	"github.com/gitpod-io/gitpod/image-builder/pkg/auth"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	// buildWorkspaceOwnerID is the owner ID we pass to ws-manager
	buildWorkspaceOwnerID = "image-builder"

	// maxBuildRuntime is the maximum time a build is allowed to take
	maxBuildRuntime = 60 * time.Minute

	// workspaceBuildProcessVersion controls how we build workspace images.
	// Incrementing this value will trigger a rebuild of all workspace images.
	workspaceBuildProcessVersion = 2
)

// NewOrchestratingBuilder creates a new orchestrating image builder
func NewOrchestratingBuilder(cfg config.Configuration) (res *Orchestrator, err error) {
	var authentication auth.RegistryAuthenticator
	if cfg.AuthFile != "" {
		fn := cfg.AuthFile
		if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
			fn = filepath.Join(tproot, fn)
		}

		authentication, err = auth.NewDockerConfigFileAuth(fn)
		if err != nil {
			return
		}
	}

	var builderAuthKey [32]byte
	if cfg.BuilderAuthKeyFile != "" {
		fn := cfg.BuilderAuthKeyFile
		if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
			fn = filepath.Join(tproot, fn)
		}

		var data []byte
		data, err = ioutil.ReadFile(fn)
		if err != nil {
			return
		}
		if len(data) != 32 {
			err = xerrors.Errorf("builder auth key must be exactly 32 bytes long")
			return
		}
		copy(builderAuthKey[:], data)
	}

	var wsman wsmanapi.WorkspaceManagerClient
	if c, ok := cfg.WorkspaceManager.Client.(wsmanapi.WorkspaceManagerClient); ok {
		wsman = c
	} else {
		grpcOpts := common_grpc.DefaultClientOptions()
		if cfg.WorkspaceManager.TLS.Authority != "" || cfg.WorkspaceManager.TLS.Certificate != "" && cfg.WorkspaceManager.TLS.PrivateKey != "" {
			tlsConfig, err := common_grpc.ClientAuthTLSConfig(
				cfg.WorkspaceManager.TLS.Authority, cfg.WorkspaceManager.TLS.Certificate, cfg.WorkspaceManager.TLS.PrivateKey,
				common_grpc.WithSetRootCAs(true),
				common_grpc.WithServerName("ws-manager"),
			)
			if err != nil {
				log.WithField("config", cfg.WorkspaceManager.TLS).Error("Cannot load ws-manager certs - this is a configuration issue.")
				return nil, xerrors.Errorf("cannot load ws-manager certs: %w", err)
			}

			grpcOpts = append(grpcOpts, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
		} else {
			grpcOpts = append(grpcOpts, grpc.WithInsecure())
		}
		conn, err := grpc.Dial(cfg.WorkspaceManager.Address, grpcOpts...)
		if err != nil {
			return nil, err
		}
		wsman = wsmanapi.NewWorkspaceManagerClient(conn)
	}

	o := &Orchestrator{
		Config: cfg,
		Auth:   authentication,
		AuthResolver: auth.Resolver{
			BaseImageRepository:      cfg.BaseImageRepository,
			WorkspaceImageRepository: cfg.WorkspaceImageRepository,
		},
		RefResolver: &resolve.StandaloneRefResolver{},

		wsman:          wsman,
		buildListener:  make(map[string]map[buildListener]struct{}),
		logListener:    make(map[string]map[logListener]struct{}),
		censorship:     make(map[string][]string),
		builderAuthKey: builderAuthKey,
		metrics:        newMetrics(),
	}
	o.monitor = newBuildMonitor(o, o.wsman)

	return o, nil
}

// Orchestrator runs image builds by orchestrating headless build workspaces
type Orchestrator struct {
	Config       config.Configuration
	Auth         auth.RegistryAuthenticator
	AuthResolver auth.Resolver
	RefResolver  resolve.DockerRefResolver

	wsman wsmanapi.WorkspaceManagerClient

	builderAuthKey [32]byte
	buildListener  map[string]map[buildListener]struct{}
	logListener    map[string]map[logListener]struct{}
	censorship     map[string][]string
	mu             sync.RWMutex

	monitor *buildMonitor

	metrics *metrics

	protocol.UnimplementedImageBuilderServer
}

// Start fires up the internals of this image builder
func (o *Orchestrator) Start(ctx context.Context) error {
	go o.monitor.Run()
	return nil
}

// ResolveBaseImage returns the "digest" form of a Docker image tag thereby making it absolute.
func (o *Orchestrator) ResolveBaseImage(ctx context.Context, req *protocol.ResolveBaseImageRequest) (resp *protocol.ResolveBaseImageResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "ResolveBaseImage")
	defer tracing.FinishSpan(span, &err)

	tracing.LogRequestSafe(span, req)

	reqauth := o.AuthResolver.ResolveRequestAuth(req.Auth)

	refstr, err := o.getAbsoluteImageRef(ctx, req.Ref, reqauth)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot resolve base image ref: %v", err)
	}

	return &protocol.ResolveBaseImageResponse{
		Ref: refstr,
	}, nil
}

// ResolveWorkspaceImage returns information about a build configuration without actually attempting to build anything.
func (o *Orchestrator) ResolveWorkspaceImage(ctx context.Context, req *protocol.ResolveWorkspaceImageRequest) (resp *protocol.ResolveWorkspaceImageResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "ResolveWorkspaceImage")
	defer tracing.FinishSpan(span, &err)
	tracing.LogRequestSafe(span, req)

	reqauth := o.AuthResolver.ResolveRequestAuth(req.Auth)
	baseref, err := o.getBaseImageRef(ctx, req.Source, reqauth)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot resolve base image: %s", err.Error())
	}
	refstr, err := o.getWorkspaceImageRef(ctx, baseref, reqauth)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "cannot produce image ref: %v", err)
	}
	span.LogKV("refstr", refstr, "baseref", baseref)

	// to check if the image exists we must have access to the image caching registry and the refstr we check here does not come
	// from the user. Thus we can safely use auth.AllowedAuthForAll here.
	auth, err := auth.AllowedAuthForAll.GetAuthFor(o.Auth, refstr)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace image authentication: %v", err)
	}
	exists, err := o.checkImageExists(ctx, refstr, auth)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot resolve workspace image: %s", err.Error())
	}

	var status protocol.BuildStatus
	if exists {
		status = protocol.BuildStatus_done_success
	} else {
		status = protocol.BuildStatus_unknown
	}

	return &protocol.ResolveWorkspaceImageResponse{
		Status: status,
		Ref:    refstr,
	}, nil
}

// Build initiates the build of a Docker image using a build configuration. If a build of this
// configuration is already ongoing no new build will be started.
func (o *Orchestrator) Build(req *protocol.BuildRequest, resp protocol.ImageBuilder_BuildServer) (err error) {
	span, ctx := opentracing.StartSpanFromContext(resp.Context(), "Build")
	defer tracing.FinishSpan(span, &err)
	tracing.LogRequestSafe(span, req)

	if req.Source == nil {
		return status.Errorf(codes.InvalidArgument, "build source is missing")
	}

	// resolve build request authentication
	reqauth := o.AuthResolver.ResolveRequestAuth(req.Auth)

	baseref, err := o.getBaseImageRef(ctx, req.Source, reqauth)
	if xerrors.Is(err, resolve.ErrNotFound) {
		return status.Error(codes.NotFound, "cannot resolve base image")
	}
	if err != nil {
		return status.Errorf(codes.Internal, "cannot resolve base image: %q", err)
	}
	wsrefstr, err := o.getWorkspaceImageRef(ctx, baseref, reqauth)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot produce workspace image ref: %q", err)
	}
	wsrefAuth, err := auth.AllowedAuthForAll.GetAuthFor(o.Auth, wsrefstr)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot get workspace image authentication: %q", err)
	}

	// check if needs build -> early return
	exists, err := o.checkImageExists(ctx, wsrefstr, wsrefAuth)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot check if image is already built: %q", err)
	}
	if exists && !req.GetForceRebuild() {
		// If the workspace image exists, so should the baseimage if we've built it.
		// If we didn't build it and the base image doesn't exist anymore, getWorkspaceImageRef will have failed to resolve the baseref.
		baserefAbsolute, err := o.getAbsoluteImageRef(ctx, baseref, auth.AllowedAuthForAll)
		if err != nil {
			return status.Errorf(codes.Internal, "cannot resolve base image ref: %q", err)
		}

		// image has already been built - no need for us to start building
		err = resp.Send(&protocol.BuildResponse{
			Status:  protocol.BuildStatus_done_success,
			Ref:     wsrefstr,
			BaseRef: baserefAbsolute,
		})
		if err != nil {
			return err
		}
		return nil
	}

	// Once a build is running we don't want it cancelled becuase the server disconnected i.e. during deployment.
	// Instead we want to impose our own timeout/lifecycle on the build. Using context.WithTimeout does not shadow its parent's
	// cancelation (see https://play.golang.org/p/N3QBIGlp8Iw for an example/experiment).
	ctx, cancel := context.WithTimeout(&parentCantCancelContext{Delegate: ctx}, maxBuildRuntime)
	defer cancel()

	randomUUID, err := uuid.NewRandom()
	if err != nil {
		return
	}

	var (
		buildID        = randomUUID.String()
		buildBase      = "false"
		contextPath    = "."
		dockerfilePath = "Dockerfile"
	)
	var initializer *csapi.WorkspaceInitializer = &csapi.WorkspaceInitializer{
		Spec: &csapi.WorkspaceInitializer_Empty{
			Empty: &csapi.EmptyInitializer{},
		},
	}
	if fsrc := req.Source.GetFile(); fsrc != nil {
		buildBase = "true"
		initializer = fsrc.Source
		contextPath = fsrc.ContextPath
		dockerfilePath = fsrc.DockerfilePath
	}
	dockerfilePath = filepath.Join("/workspace", dockerfilePath)

	if contextPath == "" {
		contextPath = filepath.Dir(dockerfilePath)
	}
	contextPath = filepath.Join("/workspace", strings.TrimPrefix(contextPath, "/workspace"))

	baseLayerAuth, err := o.getAuthFor(reqauth)
	if err != nil {
		return
	}
	gplayerAuth, err := o.getAuthFor(reqauth.ExplicitlyAll(), wsrefstr, baseref)
	if err != nil {
		return
	}

	o.censor(buildID, []string{
		wsrefstr,
		baseref,
		strings.Split(wsrefstr, ":")[0],
		strings.Split(baseref, ":")[0],
	})

	// push some log to the client before starting the job, just in case the build workspace takes a while to start up
	o.PublishLog(buildID, "starting image build")

	retryIfUnavailable1 := func(err error) bool {
		if st, ok := status.FromError(err); ok && st.Code() == codes.Unavailable {
			return true
		}
		return false
	}

	var swr *wsmanapi.StartWorkspaceResponse
	err = retry(ctx, func(ctx context.Context) (err error) {
		swr, err = o.wsman.StartWorkspace(ctx, &wsmanapi.StartWorkspaceRequest{
			Id:            buildID,
			ServicePrefix: buildID,
			Metadata: &wsmanapi.WorkspaceMetadata{
				MetaId: buildID,
				Annotations: map[string]string{
					annotationRef:     wsrefstr,
					annotationBaseRef: baseref,
				},
				// TODO(cw): use the actual image build owner here and move to annotation based filter
				//           when retrieving running image builds.
				Owner: buildWorkspaceOwnerID,
			},
			Spec: &wsmanapi.StartWorkspaceSpec{
				CheckoutLocation:  ".",
				Initializer:       initializer,
				Timeout:           maxBuildRuntime.String(),
				WorkspaceImage:    o.Config.BuilderImage,
				IdeImage:          o.Config.BuilderImage,
				WorkspaceLocation: contextPath,
				Envvars: []*wsmanapi.EnvironmentVariable{
					{Name: "BOB_TARGET_REF", Value: wsrefstr},
					{Name: "BOB_BASE_REF", Value: baseref},
					{Name: "BOB_BUILD_BASE", Value: buildBase},
					{Name: "BOB_BASELAYER_AUTH", Value: baseLayerAuth},
					{Name: "BOB_WSLAYER_AUTH", Value: gplayerAuth},
					{Name: "BOB_DOCKERFILE_PATH", Value: dockerfilePath},
					{Name: "BOB_CONTEXT_DIR", Value: contextPath},
					{Name: "BOB_AUTH_KEY", Value: string(o.builderAuthKey[:])},
					{Name: "GITPOD_TASKS", Value: `[{"name": "build", "init": "sudo -E /app/bob build"}]`},
					{Name: "SUPERVISOR_DEBUG_ENABLE", Value: fmt.Sprintf("%v", log.Log.Logger.IsLevelEnabled(logrus.DebugLevel))},
				},
			},
			Type: wsmanapi.WorkspaceType_IMAGEBUILD,
		})
		return
	}, retryIfUnavailable1, 1*time.Second, 10)
	if status.Code(err) == codes.AlreadyExists {
		// build is already running - do not add it to the list of builds
	} else if errors.Is(err, errOutOfRetries) {
		return status.Error(codes.Unavailable, "workspace services are currently unavailable")
	} else if err != nil {
		return status.Errorf(codes.Internal, "cannot start build: %q", err)
	} else {
		o.monitor.RegisterNewBuild(buildID, wsrefstr, baseref, swr.Url, swr.OwnerToken)
		o.PublishLog(buildID, "starting image build ...\n")
	}

	updates, cancel := o.registerBuildListener(buildID)
	defer cancel()
	for {
		update := <-updates
		if update == nil {
			// channel was closed unexpectatly
			return status.Error(codes.Aborted, "subscription canceled - please try again")
		}

		// The failed condition of ws-manager is not stable, hence we might wrongly report that the
		// build was successful when in fact it wasn't. This would break workspace startup with a strange
		// "cannot pull from reg.gitpod.io" error message. Instead the image-build should fail properly.
		// To do this, we resolve the built image afterwards to ensure it was actually built.
		if update.Status == protocol.BuildStatus_done_success {
			exists, err := o.checkImageExists(ctx, wsrefstr, wsrefAuth)
			if err != nil {
				update.Status = protocol.BuildStatus_done_failure
				update.Message = fmt.Sprintf("cannot check if workspace image exists after the build: %v", err)
			} else if !exists {
				update.Status = protocol.BuildStatus_done_failure
				update.Message = "image build did not produce a workspace image"
			}
		}

		err := resp.Send(update)
		if err != nil {
			log.WithError(err).Error("cannot forward build update - dropping listener")
			return status.Errorf(codes.Unknown, "cannot send update: %v", err)
		}

		if update.Status == protocol.BuildStatus_done_failure || update.Status == protocol.BuildStatus_done_success {
			// build is done
			o.clearListener(buildID)
			break
		}
	}

	return nil
}

// publishStatus broadcasts a build status update to all listeners
func (o *Orchestrator) PublishStatus(buildID string, resp *api.BuildResponse) {
	o.mu.RLock()
	listener, ok := o.buildListener[buildID]
	o.mu.RUnlock()

	// we don't have any log listener for this build
	if !ok {
		return
	}

	log.WithField("buildID", buildID).WithField("resp", resp).Debug("publishing status")

	for l := range listener {
		select {
		case l <- resp:
			continue

		case <-time.After(5 * time.Second):
			log.Warn("timeout while forwarding status to listener - dropping listener")
			o.mu.Lock()
			ll := o.buildListener[buildID]
			// In the meantime the listener list may have been removed/cleared by a call to clearListener.
			// We don't have to do any work in this case.
			if ll != nil {
				close(l)
				delete(ll, l)
			}
			o.mu.Unlock()
		}
	}
}

// Logs listens to the build output of an ongoing Docker build identified build the build ID
func (o *Orchestrator) Logs(req *protocol.LogsRequest, resp protocol.ImageBuilder_LogsServer) (err error) {
	span, ctx := opentracing.StartSpanFromContext(resp.Context(), "Logs")
	defer tracing.FinishSpan(span, &err)
	tracing.LogRequestSafe(span, req)

	rb, err := o.monitor.GetAllRunningBuilds(ctx)
	var buildID string
	for _, bld := range rb {
		if bld.Info.Ref == req.BuildRef {
			buildID = bld.Info.BuildId
			break
		}
	}
	if buildID == "" {
		return status.Error(codes.NotFound, "build not found")
	}

	logs, cancel := o.registerLogListener(buildID)
	defer cancel()
	for {
		update := <-logs
		if update == nil {
			break
		}

		err := resp.Send(update)
		if err != nil {
			log.WithError(err).Error("cannot forward log output - dropping listener")
			return status.Errorf(codes.Unknown, "cannot send log output: %v", err)
		}
	}

	return
}

// ListBuilds returns a list of currently running builds
func (o *Orchestrator) ListBuilds(ctx context.Context, req *protocol.ListBuildsRequest) (resp *protocol.ListBuildsResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "ListBuilds")
	defer tracing.FinishSpan(span, &err)

	builds, err := o.monitor.GetAllRunningBuilds(ctx)
	if err != nil {
		return
	}

	res := make([]*protocol.BuildInfo, 0, len(builds))
	for _, ws := range builds {
		res = append(res, &ws.Info)
	}

	return &protocol.ListBuildsResponse{Builds: res}, nil
}

func (o *Orchestrator) checkImageExists(ctx context.Context, ref string, authentication *auth.Authentication) (exists bool, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "checkImageExists")
	defer tracing.FinishSpan(span, &err)
	span.SetTag("ref", ref)

	_, err = o.RefResolver.Resolve(ctx, ref, resolve.WithAuthentication(authentication))
	if err == resolve.ErrNotFound {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

// getAbsoluteImageRef returns the "digest" form of an image, i.e. contains no mutable image tags
func (o *Orchestrator) getAbsoluteImageRef(ctx context.Context, ref string, allowedAuth auth.AllowedAuthFor) (res string, err error) {
	auth, err := allowedAuth.GetAuthFor(o.Auth, ref)
	if err != nil {
		return "", xerrors.Errorf("cannt resolve base image ref: %w", err)
	}

	return o.RefResolver.Resolve(ctx, ref, resolve.WithAuthentication(auth))
}

func (o *Orchestrator) getBaseImageRef(ctx context.Context, bs *protocol.BuildSource, allowedAuth auth.AllowedAuthFor) (res string, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "getBaseImageRef")
	defer tracing.FinishSpan(span, &err)

	switch src := bs.From.(type) {
	case *protocol.BuildSource_Ref:
		return o.getAbsoluteImageRef(ctx, src.Ref.Ref, allowedAuth)

	case *protocol.BuildSource_File:
		manifest := map[string]string{
			"DockerfilePath":    src.File.DockerfilePath,
			"DockerfileVersion": src.File.DockerfileVersion,
			"ContextPath":       src.File.ContextPath,
		}
		// workspace starter will only ever send us Git sources. Should that ever change, we'll need to add
		// manifest support for the other initializer types.
		if src.File.Source.GetGit() != nil {
			fsrc := src.File.Source.GetGit()
			manifest["Source"] = "git"
			manifest["CloneTarget"] = fsrc.CloneTaget
			manifest["RemoteURI"] = fsrc.RemoteUri
		} else {
			return "", xerrors.Errorf("unsupported context initializer")
		}
		// Go maps do NOT maintain their order - we must sort the keys to maintain a stable order
		var keys []string
		for k := range manifest {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
		var dfl string
		for _, k := range keys {
			dfl += fmt.Sprintf("%s: %s\n", k, manifest[k])
		}
		span.LogKV("manifest", dfl)

		hash := sha256.New()
		n, err := hash.Write([]byte(dfl))
		if err != nil {
			return "", xerrors.Errorf("cannot compute src image ref: %w", err)
		}
		if n < len(dfl) {
			return "", xerrors.Errorf("cannot compute src image ref: short write")
		}

		// the mkII image builder supported an image hash salt. That salt broke other assumptions,
		// which is why this mkIII implementation does not support it anymore. We need to stay compatible
		// with the previous means of computing the hash though. This is why we add an extra breakline here,
		// basically defaulting to an empty salt string.
		_, err = fmt.Fprintln(hash, "")
		if err != nil {
			return "", xerrors.Errorf("cannot compute src image ref: %w", err)
		}

		return fmt.Sprintf("%s:%x", o.Config.BaseImageRepository, hash.Sum([]byte{})), nil

	default:
		return "", xerrors.Errorf("invalid base image")
	}
}

func (o *Orchestrator) getWorkspaceImageRef(ctx context.Context, baseref string, allowedAuth auth.AllowedAuthFor) (ref string, err error) {
	cnt := []byte(fmt.Sprintf("%s\n%d\n", baseref, workspaceBuildProcessVersion))
	hash := sha256.New()
	n, err := hash.Write(cnt)
	if err != nil {
		return "", xerrors.Errorf("cannot produce workspace image name: %w", err)
	}
	if n < len(cnt) {
		return "", xerrors.Errorf("cannot produce workspace image name: %w", io.ErrShortWrite)
	}

	dst := hash.Sum([]byte{})
	return fmt.Sprintf("%s:%x", o.Config.WorkspaceImageRepository, dst), nil
}

// parentCantCancelContext is a bit of a hack. We have some operations which we want to keep alive even after clients
// disconnect. gRPC cancels the context once a client disconnects, thus we intercept the cancelation and act as if
// nothing had happened.
//
// This cannot be the best way to do this. Ideally we'd like to intercept client disconnect, but maintain the usual
// cancelation mechanism such as deadlines, timeouts, explicit cancelation.
type parentCantCancelContext struct {
	Delegate context.Context
	done     chan struct{}
}

func (*parentCantCancelContext) Deadline() (deadline time.Time, ok bool) {
	// return ok==false which means there's no deadline set
	return time.Time{}, false
}

func (c *parentCantCancelContext) Done() <-chan struct{} {
	return c.done
}

func (c *parentCantCancelContext) Err() error {
	err := c.Delegate.Err()
	if err == context.Canceled {
		return nil
	}

	return err
}

func (c *parentCantCancelContext) Value(key interface{}) interface{} {
	return c.Delegate.Value(key)
}

// source: https://astaxie.gitbooks.io/build-web-application-with-golang/en/09.6.html
func encrypt(plaintext []byte, key [32]byte) ([]byte, error) {
	c, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(c)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func (o *Orchestrator) getAuthFor(inp auth.AllowedAuthFor, refs ...string) (res string, err error) {
	buildauth, err := inp.GetImageBuildAuthFor(o.Auth, refs)
	if err != nil {
		return
	}
	resb, err := json.MarshalIndent(buildauth, "", " ")
	if err != nil {
		return
	}

	res = base64.RawStdEncoding.EncodeToString(resb)

	if len(o.builderAuthKey) > 0 {
		resb, err = encrypt(resb, o.builderAuthKey)
		if err != nil {
			return
		}

		res = base64.RawStdEncoding.EncodeToString(resb)
	}

	return
}

type buildListener chan *api.BuildResponse

type logListener chan *api.LogsResponse

func (o *Orchestrator) registerBuildListener(buildID string) (c <-chan *api.BuildResponse, cancel func()) {
	o.mu.Lock()
	defer o.mu.Unlock()

	l := make(buildListener)
	ls := o.buildListener[buildID]
	if ls == nil {
		ls = make(map[buildListener]struct{})
	}
	ls[l] = struct{}{}
	o.buildListener[buildID] = ls

	cancel = func() {
		o.mu.Lock()
		defer o.mu.Unlock()
		ls := o.buildListener[buildID]
		if ls == nil {
			return
		}
		delete(ls, l)
		o.buildListener[buildID] = ls
	}
	return l, cancel
}

func (o *Orchestrator) registerLogListener(buildID string) (c <-chan *api.LogsResponse, cancel func()) {
	o.mu.Lock()
	defer o.mu.Unlock()

	l := make(logListener)
	ls := o.logListener[buildID]
	if ls == nil {
		ls = make(map[logListener]struct{})
	}
	ls[l] = struct{}{}
	o.logListener[buildID] = ls
	log.WithField("buildID", buildID).WithField("listener", len(ls)).Debug("registered log listener")

	cancel = func() {
		o.mu.Lock()
		defer o.mu.Unlock()
		ls := o.logListener[buildID]
		if ls == nil {
			return
		}
		delete(ls, l)
		o.logListener[buildID] = ls

		log.WithField("buildID", buildID).WithField("listener", len(ls)).Debug("deregistered log listener")
	}
	return l, cancel
}

// clearListener removes all listener for a particular build
func (o *Orchestrator) clearListener(buildID string) {
	o.mu.Lock()
	defer o.mu.Unlock()

	delete(o.buildListener, buildID)
	delete(o.logListener, buildID)
	delete(o.censorship, buildID)
}

// censor registers tokens that are censored in the log output
func (o *Orchestrator) censor(buildID string, words []string) {
	o.mu.Lock()
	defer o.mu.Unlock()

	o.censorship[buildID] = words
}

// PublishLog broadcasts log output to all registered listener
func (o *Orchestrator) PublishLog(buildID string, message string) {
	o.mu.RLock()
	listener, ok := o.logListener[buildID]
	o.mu.RUnlock()

	// we don't have any log listener for this build
	if !ok {
		return
	}

	o.mu.RLock()
	wds := o.censorship[buildID]
	o.mu.RUnlock()
	for _, w := range wds {
		message = strings.ReplaceAll(message, w, "")
	}

	for l := range listener {
		select {
		case l <- &api.LogsResponse{
			Content: []byte(message),
		}:
			continue

		case <-time.After(5 * time.Second):
			log.WithField("buildID", buildID).Warn("timeout while forwarding log to listener - dropping listener")
			o.mu.Lock()
			ll := o.logListener[buildID]
			// In the meantime the listener list may have been removed/cleared by a call to clearListener.
			// We don't have to do any work in this case.
			if ll != nil {
				close(l)
				delete(ll, l)
			}
			o.mu.Unlock()
		}
	}
}
