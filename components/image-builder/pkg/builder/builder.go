// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/armon/circbuf"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/volume"
	docker "github.com/docker/docker/client"
	"github.com/docker/docker/pkg/jsonmessage"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
)

const (
	// LabelProtected is applied to images/volumes/containers which must not be pruned
	LabelProtected = "gitpod.io/image-builder/protected"

	// LabelTemporary is applied to images/volumes/containers which can be pruned post-build
	LabelTemporary = "gitpod.io/image-builder/temporary"

	// maxBuildRuntime is the maximum time a build is allowed to take
	maxBuildRuntime = 60 * time.Minute

	// defaultMaxArtefactAge is the time at which we'll run the garbage collector
	defaultMaxArtefactAge = 2 * maxBuildRuntime
)

// NewDockerBuilder creates a new DockerBuilder
func NewDockerBuilder(cfg *Configuration, client *docker.Client) *DockerBuilder {
	return &DockerBuilder{
		Config:   cfg,
		Docker:   client,
		Resolver: &resolve.DockerRegistryResolver{Client: client},

		imgExistsCache: make(map[string]struct{}),
		builds:         make(map[string]*build),
		gc:             NewGarbageCollector(client),
	}
}

// DockerBuilder implements the image builder using Docker alone
type DockerBuilder struct {
	Config   *Configuration
	Docker   *docker.Client
	Auth     RegistryAuthenticator
	Resolver resolve.DockerRefResolver

	builderref  string
	gplayerHash string

	mu     sync.RWMutex
	builds map[string]*build

	imgExistsMu    sync.RWMutex
	imgExistsCache map[string]struct{}

	gc *GarbageCollector

	api.UnimplementedImageBuilderServer
}

// Start iniitializes the docker builder and starts its maintainance functions. This function must be called prior to calling
// any other function.
func (b *DockerBuilder) Start(ctx context.Context) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "Start")
	defer tracing.FinishSpan(span, &err)

	hash, err := computeGitpodLayerHash(b.Config.GitpodLayerLoc)
	if err != nil {
		log.WithError(err).Error("Gitpod Layer hash computation failed")
		return err
	}
	b.gplayerHash = hash
	log.WithField("gitpodLayer", b.Config.GitpodLayerLoc).WithField("hash", b.gplayerHash).Info("computed Gitpod layer hash")

	log.WithField("gitpodLayer", b.Config.GitpodLayerLoc).Info("running self-build")
	ref, err := SelfBuild(ctx, "gitpod.io/image-builder/selfbuild", b.Config.GitpodLayerLoc, b.Config.SelfBuildBaseImage, b.Config.AlpineImage, b.Docker)
	if err != nil {
		log.WithError(err).Error("self-build failed")
		return err
	}
	log.WithField("ref", ref).WithField("gitpodLayerHash", b.gplayerHash).Info("self-build succeeded")
	b.builderref = ref

	go b.gc.Start(context.Background(), defaultMaxArtefactAge)

	err = prometheus.Register(prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "image_builder_running_builds",
		Help: "Number of currently running builds",
	}, func() float64 {
		b.mu.RLock()
		defer b.mu.RUnlock()

		return float64(len(b.builds))
	}))
	if err != nil {
		log.WithError(err).Warn("unable to register Prometheus gauges")
	}

	return nil
}

// ResolveBaseImage returns information about a build configuration without actually attempting to build anything.
func (b *DockerBuilder) ResolveBaseImage(ctx context.Context, req *api.ResolveBaseImageRequest) (resp *api.ResolveBaseImageResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "ResolveBaseImage")
	defer tracing.FinishSpan(span, &err)

	tracing.LogRequestSafe(span, req)

	reqauth := b.resolveRequestAuth(req.Auth)

	refstr, err := b.getAbsoluteImageRef(ctx, req.Ref, reqauth)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot resolve base image ref: %v", err)
	}

	return &api.ResolveBaseImageResponse{
		Ref: refstr,
	}, nil
}

// ResolveWorkspaceImage returns information about a build configuration without actually attempting to build anything.
func (b *DockerBuilder) ResolveWorkspaceImage(ctx context.Context, req *api.ResolveWorkspaceImageRequest) (resp *api.ResolveWorkspaceImageResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "ResolveWorkspaceImage")
	defer tracing.FinishSpan(span, &err)
	tracing.LogRequestSafe(span, req)

	reqauth := b.resolveRequestAuth(req.Auth)
	baseref, err := b.getBaseImageRef(ctx, req.Source, reqauth)
	if err != nil {
		return nil, dockerErrToGRPC(err, "cannot resolve base image")
	}
	refstr, err := b.getWorkspaceImageRef(ctx, baseref, b.gplayerHash, reqauth)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "cannot produce image ref: %v", err)
	}
	span.LogKV("refstr", refstr, "baseref", baseref)

	// to check if the image exists we must have access to the image caching registry and the refstr we check here does not come
	// from the user. Thus we can safely use allowedAuthForAll here.
	auth, err := allowedAuthForAll.getAuthFor(b.Auth, refstr)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "cannot get workspace image authentication: %v", err)
	}
	exists, err := b.checkImageExists(ctx, refstr, auth)
	if err != nil {
		return nil, dockerErrToGRPC(err, "cannot resolve workspace image")
	}

	var status api.BuildStatus
	if exists {
		status = api.BuildStatus_done_success
	} else {
		status = api.BuildStatus_unknown
	}

	return &api.ResolveWorkspaceImageResponse{
		Status: status,
		Ref:    refstr,
	}, nil
}

// Build initiates the build of a Docker image using a build configuration
func (b *DockerBuilder) Build(req *api.BuildRequest, resp api.ImageBuilder_BuildServer) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(resp.Context(), "Build")
	defer tracing.FinishSpan(span, &err)
	tracing.LogRequestSafe(span, req)

	if b.builderref == "" {
		return status.Error(codes.FailedPrecondition, "no selfbuild available - this image-builder is really broken (missing Start() call)")
	}

	// resolve build request authentication
	reqauth := b.resolveRequestAuth(req.Auth)

	baseref, err := b.getBaseImageRef(ctx, req.Source, reqauth)
	if err != nil {
		return dockerErrToGRPC(err, "cannot resolve base image")
	}
	wsrefstr, err := b.getWorkspaceImageRef(ctx, baseref, b.gplayerHash, reqauth)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot produce workspace image ref: %v", err)
	}
	wsrefAuth, err := allowedAuthForAll.getAuthFor(b.Auth, wsrefstr)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot get workspace image authentication: %v", err)
	}

	forceRebuid := req.GetForceRebuild()

	if !forceRebuid {
		// check if needs build -> early return
		exists, err := b.checkImageExists(ctx, wsrefstr, wsrefAuth)
		if err != nil {
			return dockerErrToGRPC(err, "cannot check if image is already built")
		}
		if exists {
			// If the workspace image exists, so should the baseimage if we've built it.
			// If we didn't build it and the base image doesn't exist anymore, getWorkspaceImageRef will have failed to resolve the baseref.
			baserefAbsolute, err := b.getAbsoluteImageRef(ctx, baseref, allowedAuthForAll)
			if err != nil {
				return status.Errorf(codes.Internal, "cannot resolve base image ref: %v", err)
			}

			// image has already been built - no need for us to start building
			err = resp.Send(&api.BuildResponse{
				Status:  api.BuildStatus_done_success,
				Ref:     wsrefstr,
				BaseRef: baserefAbsolute,
			})
			if err != nil {
				return err
			}
			return nil
		}
	}

	// Once a build is running we don't want it cancelled becuase the server disconnected i.e. during deployment.
	// Instead we want to impose our own timeout/lifecycle on the build. Using context.WithTimeout does not shadow its parent's
	// cancelation (see https://play.golang.org/p/N3QBIGlp8Iw for an example/experiment).
	ctx, cancel := context.WithTimeout(&parentCantCancelContext{Delegate: ctx}, maxBuildRuntime)
	defer cancel()

	b.mu.Lock()
	bld, exists := b.builds[wsrefstr]
	if exists {
		b.mu.Unlock()

		// someone else has already started this build and we'll just "listen in"
		err = resp.Send(&api.BuildResponse{
			Status:  api.BuildStatus_running,
			Ref:     wsrefstr,
			BaseRef: baseref,
		})
		if err != nil {
			return err
		}

		stus := bld.Wait()
		baserefAbsolute, err := b.getAbsoluteImageRef(ctx, baseref, allowedAuthForAll)
		if err != nil {
			return status.Errorf(codes.Internal, "cannot resolve base image ref: %v", err)
		}
		err = resp.Send(&api.BuildResponse{
			Status:  stus,
			Ref:     wsrefstr,
			BaseRef: baserefAbsolute,
		})
		if err != nil {
			return err
		}

		return nil
	}

	// we're building this - setup log distribution
	thisBuild := newBuild(wsrefstr)
	b.builds[wsrefstr] = thisBuild
	log.WithField("buildRef", thisBuild.Ref).Info("registering build")
	b.mu.Unlock()

	// make sure that when we're done we're cleaning things up and tell our client
	var baserefAbsolute string
	defer func(baseref *string, perr *error) {
		err := *perr
		var (
			sts api.BuildStatus
			msg string
		)
		if err == nil {
			sts = api.BuildStatus_done_success
		} else {
			sts = api.BuildStatus_done_failure
			msg = fmt.Sprintf("build failed: %v", err)
			log.WithError(err).WithField("buildRef", thisBuild.Ref).Warn("build failed")
		}

		b.mu.Lock()
		log.WithField("status", api.BuildStatus_name[int32(sts)]).WithField("buildRef", thisBuild.Ref).Info("deregistering build")
		delete(b.builds, wsrefstr)
		b.mu.Unlock()

		err = thisBuild.Close(sts)
		if err != nil {
			log.WithError(err).Error("cannot close build session")
		}

		err = resp.Send(&api.BuildResponse{
			Status:  sts,
			Ref:     wsrefstr,
			BaseRef: *baseref,
			Message: msg,
		})
		if err != nil {
			if status.Code(err) == codes.Unavailable {
				// client has disconnect since ... that's ok
				log.WithError(err).Debug("client has disconnected prematurely")
			} else {
				log.WithError(err).Error("cannot send build status update")
			}
		}
	}(&baserefAbsolute, &err)

	// we have just started this build and need to give clients a chance to listen in
	err = resp.Send(&api.BuildResponse{
		Status: api.BuildStatus_running,
		Ref:    wsrefstr,
	})
	if err != nil {
		if status.Code(err) == codes.Unavailable {
			// client has disconnect since ... that's ok
			log.WithError(err).Debug("client has disconnected prematurely")
		} else {
			log.WithError(err).Error("cannot send build status update")
		}
	}

	// create build volume
	buildVolume, err := b.createBuildVolume(ctx, thisBuild.ID)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot create build volume: %v", err)
	}
	thisBuild.buildVolume = buildVolume

	// TLDR; the getBaseImageRef call with request auth prevents users from pulling from our base image cache registry (e.g. eu.gcr.io/gitpod-dev)
	//
	// Authentication here is a bit tricky: we need to (a) ensure that users cannot use images from registries
	// they have no authentication for, and (b) make sure we can still pull from our base image cache registry,
	// to which the user might not have explicit authentication for either.
	//
	// Those two cases differ by their build source. In the former case the source is a reference which points to
	// a "forbidden" registry. Enforce proper auth restrictions there we use the request auth for resolving this base image,
	// which requires registry access. Thus, if the request auth prohibits access to that registry, resolving will fail.
	//
	// The latter case (base image is stored in the base image cache registry) can only happen if the build source
	// is a Dockerfile. In this case the getBaseImage ref works no matter the authentication, but we need to elevate the
	// auth to allow checking for its existence.

	// Resolving the base image will fail if the user is trying to use an image they have no permission to use
	baserefAuth, err := reqauth.Elevate(baseref).getAuthFor(b.Auth, baseref)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot get base image authentication: %v", err)
	}

	log.WithField("baserefstr", baseref).WithField("buildRef", thisBuild.Ref).Debug("checking if base image exists")
	baseExists, err := b.checkImageExists(ctx, baseref, baserefAuth)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot check base image exists: %v", err)
	}

	var isRefSource bool
	switch req.Source.From.(type) {
	case *api.BuildSource_Ref:
		isRefSource = true
	default:
		isRefSource = false
	}
	if baseExists && (!forceRebuid || isRefSource) {
		if strings.HasPrefix(baseref, b.Config.BaseImageRepository) {
			// the base image we're about to pull is one that we've built before.
			// In that case we enter the workspace phase prematurely to give the censor
			// a chance to censor the pull.
			thisBuild.EnterPhase(buildPhaseWorkspace)
		}

		// base exists but me might have to pull it ... let's do that
		err = b.pullImage(ctx, thisBuild, baseref, baserefAuth)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "cannot pull base image: %v", err)
		}
	} else {
		if req.Source.GetFile() == nil {
			return status.Errorf(codes.NotFound, "base image does not exist: %v", baseref)
		}

		basesrc := req.Source.GetFile()
		err = b.buildBaseImage(ctx, thisBuild, basesrc, baseref, reqauth)
		if err != nil {
			return err
		}
	}

	// Get digest form of the image (absolute ref) so that we can compute the the workspace ref if one were to pass the (digest form) baseref back as base image.
	// This way users of the image builder can Resolve/Build a workspace image using the baseref we return from this build without us having to build this image again.
	baserefAbsolute, err = b.getAbsoluteImageRef(ctx, baseref, allowedAuthForNone.Elevate(baseref))
	if err != nil {
		return status.Errorf(codes.Internal, "cannot resolve base image ref: %v", err)
	}
	abswsrefstr, err := b.getWorkspaceImageRef(ctx, baserefAbsolute, b.gplayerHash, reqauth)
	if err != nil {
		return status.Errorf(codes.Internal, "cannot produce workspace image ref: %v", err)
	}

	// build workspace image
	err = b.buildWorkspaceImage(ctx, thisBuild, baseref, []string{wsrefstr, abswsrefstr}, reqauth)
	if err != nil {
		return err
	}

	return nil
}

func (b *DockerBuilder) createBuildVolume(ctx context.Context, buildID string) (vol string, err error) {
	// Create build volume
	buildVolName := "build-" + buildID
	_, err = b.Docker.VolumeCreate(ctx, volume.VolumeCreateBody{
		Name:   buildVolName,
		Driver: "local",
		Labels: map[string]string{
			LabelTemporary: "true",
		},
	})
	if err != nil {
		return "", xerrors.Errorf("cannot create build volume: %w", err)
	}

	containerName := "prep-" + buildID
	initcontainer, err := b.Docker.ContainerCreate(ctx, &container.Config{
		Image:        b.builderref,
		AttachStdout: true,
		AttachStdin:  false,
		AttachStderr: true,
		Cmd:          []string{"sh", "-c", "cp -Rfv /gitpod-layer/scripts /workspace/scripts"},
		Tty:          false,
		Labels: map[string]string{
			LabelTemporary: "true",
		},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: buildVolName, Target: "/workspace"},
		},
	}, nil, nil, containerName)
	if err != nil {
		return "", xerrors.Errorf("cannot create build volume: %w", err)
	}
	logs := bytes.NewBuffer(nil)
	err = b.runContainer(ctx, logs, initcontainer.ID)
	if err != nil {
		return "", xerrors.Errorf("cannot create build volume: %v", logs.String())
	}

	return buildVolName, nil
}

func (b *DockerBuilder) buildBaseImage(ctx context.Context, bld *build, src *api.BuildSourceDockerfile, ref string, allowedAuth allowedAuthFor) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "buildBaseImage")
	defer tracing.FinishSpan(span, &err)

	bld.EnterPhase(buildPhaseBase)

	// Start bob and initialize workspace.
	fmt.Fprintln(bld, "\ninitializing base image context")
	rawInitcfg, err := proto.Marshal(src)
	if err != nil {
		return xerrors.Errorf("cannot remarshal baseimage source: %w", err)
	}
	initcfg := base64.RawStdEncoding.EncodeToString(rawInitcfg)

	syncContainerName := "init-" + bld.ID
	initcontainer, err := b.Docker.ContainerCreate(ctx, &container.Config{
		Image:        b.builderref,
		AttachStdout: true,
		AttachStdin:  false,
		AttachStderr: true,
		Cmd:          []string{"/bob", "bob", "init-base", "/workspace", initcfg},
		Tty:          false,
		Labels: map[string]string{
			LabelTemporary: "true",
		},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: bld.buildVolume, Target: "/workspace"},
		},
	}, nil, nil, syncContainerName)
	if err != nil {
		return xerrors.Errorf("cannot create initializer: %w", err)
	}
	err = b.runContainer(ctx, bld, initcontainer.ID)
	if err != nil {
		return xerrors.Errorf("cannot run context initializer: %w", err)
	}

	// Run build
	fmt.Fprintln(bld, "running base image build")
	buildauth, err := allowedAuth.getImageBuildAuthFor(b.Auth, []string{ref})
	if err != nil {
		return xerrors.Errorf("cannot get build authentication: %w", err)
	}
	r, w := io.Pipe()
	ctxsrvChan, buildChan := make(chan error), make(chan error)
	go func() {
		ctxsrvChan <- b.serveContext(ctx, bld, bld.buildVolume, "/workspace/context", w)
		log.WithField("buildRef", bld.Ref).Debug("base image context sent")
	}()
	go func() {
		log.WithField("buildRef", bld.Ref).Debug("base image build started")

		resp, err := b.Docker.ImageBuild(ctx, r, types.ImageBuildOptions{
			Tags:        []string{ref},
			PullParent:  true,
			Dockerfile:  "Dockerfile",
			AuthConfigs: buildauth,
			Labels: map[string]string{
				LabelTemporary: "true",
			},
		})
		if err != nil {
			buildChan <- err
			return
		}

		err = jsonmessage.DisplayJSONMessagesStream(resp.Body, bld, 0, bld.isTTY, nil)
		resp.Body.Close()
		buildChan <- err

		log.WithField("buildRef", bld.Ref).Debug("base image build done")
	}()

	var done bool
	for !done {
		var err error
		select {
		case err = <-ctxsrvChan:
		case err = <-buildChan:
			done = true
		}

		if err != nil {
			log.WithError(err).WithField("done", done).WithField("buildRef", bld.Ref).Error("base image build error")
			return xerrors.Errorf("cannot build base image: %w", err)
		}
	}

	// Push image
	fmt.Fprintln(bld, "\npushing base image")
	auth, err := allowedAuthForAll.getAuthFor(b.Auth, ref)
	if err != nil {
		return xerrors.Errorf("cannot authenticate base image push: %w", err)
	}
	if len(auth) == 0 {
		// prevent missing X-Registry-Auth header for push when no auth is needed
		// see https://github.com/moby/moby/issues/10983#issuecomment-85892396
		auth = "nobody"
	}
	pushresp, err := b.Docker.ImagePush(ctx, ref, types.ImagePushOptions{
		RegistryAuth: auth,
	})
	if err != nil {
		return xerrors.Errorf("cannot push base image: %w", err)
	}
	err = jsonmessage.DisplayJSONMessagesStream(pushresp, bld, 0, bld.isTTY, nil)
	pushresp.Close()
	if err != nil {
		return xerrors.Errorf("cannot push base image: %w", err)
	}

	return nil
}

var (
	// msgPushingWorkspaceImage is printed after a successful workspace image build. We have this as a "constant" so that
	// we can exclude this message from the log censor.
	msgPushingWorkspaceImage = []byte("pushing workspace image")
)

func (b *DockerBuilder) buildWorkspaceImage(ctx context.Context, bld *build, baseref string, targetref []string, allowedAuth allowedAuthFor) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "buildWorkspaceImage")
	defer tracing.FinishSpan(span, &err)

	bld.EnterPhase(buildPhaseWorkspace)

	// TODO: rather than running those scripts as root we might want to create the directories they need and chown them to gitpod when creating the build volume

	// Run base image with detect-distro.sh
	detectdistContainer, err := b.Docker.ContainerCreate(ctx, &container.Config{
		Image:        baseref,
		AttachStdout: true,
		AttachStdin:  false,
		AttachStderr: true,
		User:         "root",
		Entrypoint:   []string{"/bin/sh"},
		Cmd:          []string{"/workspace/scripts/detect-distro.sh"},
		Tty:          false,
		Labels: map[string]string{
			LabelTemporary: "true",
		},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: bld.buildVolume, Target: "/workspace"},
		},
	}, nil, nil, "detectdist-"+bld.ID)
	if err != nil {
		return xerrors.Errorf("cannot build base image: %w", err)
	}
	err = b.runContainer(ctx, bld, detectdistContainer.ID)
	if err != nil {
		return xerrors.Errorf("cannot run base image: %w", err)
	}

	// Run Dockerfile generator
	ctxpth := "/workspace/wsctx"
	dfgenContainer, err := b.Docker.ContainerCreate(ctx, &container.Config{
		Image:        b.builderref,
		AttachStdout: true,
		AttachStdin:  false,
		AttachStderr: true,
		User:         "root",
		Cmd:          []string{"/gitpod-layer/scripts/generate-dockerfile.sh", baseref},
		WorkingDir:   ctxpth,
		Tty:          false,
		Labels: map[string]string{
			LabelTemporary: "true",
		},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: bld.buildVolume, Target: "/workspace"},
		},
	}, nil, nil, "dfgen-"+bld.ID)
	if err != nil {
		return xerrors.Errorf("cannot build workspace image: %w", err)
	}
	err = b.runContainer(ctx, bld, dfgenContainer.ID)
	if err != nil {
		return xerrors.Errorf("cannot run workspace image: %w", err)
	}

	// Run build
	fmt.Fprintln(bld, "running workspace image build")
	// Note: we intentionally filter the auth using authFor. At this point the base image was already pulled,
	//       thus we don't need to access our cache registry here.
	buildauth, err := allowedAuth.getImageBuildAuthFor(b.Auth, []string{baseref})
	if err != nil {
		return xerrors.Errorf("cannot get build authentication: %w", err)
	}
	r, w := io.Pipe()
	ctxsrvChan, buildChan := make(chan error), make(chan error)
	go func() {
		ctxsrvChan <- b.serveContext(ctx, bld, bld.buildVolume, ctxpth, w)
		log.WithField("buildRef", bld.Ref).Debug("workspace image context sent")
	}()
	go func() {
		log.WithField("buildRef", bld.Ref).Debug("workspace image build started")

		resp, err := b.Docker.ImageBuild(ctx, r, types.ImageBuildOptions{
			Tags:        targetref,
			PullParent:  false,
			Dockerfile:  "Dockerfile",
			AuthConfigs: buildauth,
			Labels: map[string]string{
				LabelTemporary: "true",
			},
		})
		if err != nil {
			buildChan <- err
			return
		}

		err = jsonmessage.DisplayJSONMessagesStream(resp.Body, bld, 0, bld.isTTY, nil)
		resp.Body.Close()
		buildChan <- err

		log.WithField("buildRef", bld.Ref).Debug("workspace image build done")
	}()

	var done bool
	for !done {
		var err error
		select {
		case err = <-ctxsrvChan:
		case err = <-buildChan:
			done = true
		}

		if err != nil {
			log.WithError(err).WithField("done", done).WithField("buildRef", bld.Ref).Error("workspace image build error")
			return xerrors.Errorf("cannot build workspace image: %w", err)
		}
	}

	// Push image
	fmt.Fprintf(bld, "\n%s\n", string(msgPushingWorkspaceImage))
	for _, tag := range targetref {
		auth, err := allowedAuthForAll.getAuthFor(b.Auth, tag)
		if err != nil {
			return xerrors.Errorf("cannot authenticate workspace image push: %w", err)
		}
		if len(auth) == 0 {
			// prevent missing X-Registry-Auth header for push when no auth is needed
			// see https://github.com/moby/moby/issues/10983#issuecomment-85892396
			auth = "nobody"
		}
		pushresp, err := b.Docker.ImagePush(ctx, tag, types.ImagePushOptions{
			RegistryAuth: auth,
		})
		if err != nil {
			return xerrors.Errorf("cannot push workspace image: %w", err)
		}
		err = jsonmessage.DisplayJSONMessagesStream(pushresp, bld, 0, bld.isTTY, nil)
		pushresp.Close()
		if err != nil {
			return xerrors.Errorf("cannot push workspace image: %w", err)
		}
	}

	return nil
}

// Logs listens to the build output of an ongoing Docker build identified build the build ID
func (b *DockerBuilder) Logs(req *api.LogsRequest, resp api.ImageBuilder_LogsServer) (err error) {
	span, _ := opentracing.StartSpanFromContext(resp.Context(), "Logs")
	span.SetTag("buildRef", req.BuildRef)
	defer tracing.FinishSpan(span, &err)

	tracing.LogRequestSafe(span, req)

	b.mu.RLock()
	bld, exists := b.builds[req.BuildRef]
	b.mu.RUnlock()
	if !exists {
		return status.Error(codes.NotFound, "build not found")
	}

	logs := bld.Listen()
	log.WithField("buildRef", req.BuildRef).Info("started listening to build logs")
	defer func(perr *error) {
		err := logs.Close()
		if err != nil {
			log.WithError(err).WithField("buildRef", req.BuildRef).Info("cannot close log listener")
		}

		err = *perr
		if status.Code(err) == codes.Unavailable {
			// client has disconnect since ... that's ok
			log.WithError(err).WithField("buildRef", req.BuildRef).Debug("client has disconnected prematurely while listening to logs")
		} else {
			log.WithError(err).WithField("buildRef", req.BuildRef).Warn("error listening to build logs")
		}

		log.WithField("buildRef", req.BuildRef).Info("done listening to build logs")
	}(&err)

	var censored io.Reader
	if req.Censored {
		censored = defaultLogCensor(bld, [][]byte{
			[]byte(b.Config.BaseImageRepository),
			[]byte(b.Config.WorkspaceImageRepository),
			[]byte(b.builderref),
		}, logs)
	} else {
		censored = logs
	}

	var lr api.LogsResponse
	buf := make([]byte, 4096)
	for {
		n, err := censored.Read(buf)
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if n == 0 {
			continue
		}
		lr.Content = buf[:n]

		err = resp.Send(&lr)
		if err != nil {
			return err
		}
	}

	return nil
}

func defaultLogCensor(bld *build, forbiddenStrings [][]byte, in io.Reader) io.Reader {
	r, w := io.Pipe()

	scanner := bufio.NewScanner(in)
	scanner.Split(bufio.ScanLines)
	go func() {
		var dots int
		for scanner.Scan() {
			line := scanner.Bytes()

			if bld.Phase() == buildPhaseWorkspace &&
				!bytes.Contains(line, msgPushingWorkspaceImage) {

				line = []byte(".")
				dots++

				if dots > 10 {
					dots = 0
					line = append(line, '\n')
				}
			} else {
				for _, fs := range forbiddenStrings {
					// TODO: use slices and IndexOf rather than copy through ReplaceAll
					line = bytes.ReplaceAll(line, fs, []byte{})
				}
				line = append(line, '\n')
			}

			_, err := w.Write(line)
			if err != nil {
				r.Close()
				return
			}
		}
	}()

	return r
}

// ListBuilds returns a list of currently running builds
func (b *DockerBuilder) ListBuilds(ctx context.Context, req *api.ListBuildsRequest) (resp *api.ListBuildsResponse, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "ListBuilds")
	defer tracing.FinishSpan(span, &err)

	b.mu.RLock()
	defer b.mu.RUnlock()

	var builds []*api.BuildInfo
	for _, build := range b.builds {
		builds = append(builds, &api.BuildInfo{
			Ref:       build.Ref,
			Status:    build.status,
			StartedAt: build.StartedAt.Unix(),
		})
	}

	return &api.ListBuildsResponse{
		Builds: builds,
	}, nil
}

type listenerSet map[*buildListener]struct{}

func newBuild(targetRef string) *build {
	r := &build{
		Ref:       targetRef,
		ID:        fmt.Sprintf("%x-%d", sha256.Sum256([]byte(targetRef)), time.Now().Unix()),
		StartedAt: time.Now(),
		listener:  make(listenerSet),
		status:    api.BuildStatus_running,
	}
	r.cond = sync.NewCond(&r.mu)
	return r
}

type buildPhase int

const (
	buildPhaseBase buildPhase = iota
	buildPhaseWorkspace
)

type build struct {
	Ref       string
	ID        string
	StartedAt time.Time

	buildVolume string
	isTTY       bool

	phase    buildPhase
	listener listenerSet
	closed   bool
	status   api.BuildStatus
	mu       sync.RWMutex
	cond     *sync.Cond

	logs *circbuf.Buffer
}

func (s *build) EnterPhase(p buildPhase) {
	// DO NOT write to s in a locked section - this will cause a deadlock as Write acquires a Read lock on mu
	if p == buildPhaseBase {
		fmt.Fprintf(s, "building base image\n")
	} else if p == buildPhaseWorkspace {
		fmt.Fprintf(s, "adding Gitpod layer\n")
	}

	s.mu.Lock()
	s.phase = p
	s.mu.Unlock()
}

func (s *build) Phase() buildPhase {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.phase
}

// Wait waits for the build to finish
func (s *build) Wait() (resp api.BuildStatus) {
	s.mu.Lock()
	for {
		s.cond.Wait()
		resp = s.status
		if resp == api.BuildStatus_done_failure || resp == api.BuildStatus_done_success {
			break
		}
	}
	s.mu.Unlock()

	return
}

// Listens for log output of the build
func (s *build) Listen() io.ReadCloser {
	l := &buildListener{
		B:      s,
		Reader: make(chan []byte),
		Ack:    make(chan struct{}),
	}

	s.mu.Lock()
	s.listener[l] = struct{}{}
	s.mu.Unlock()

	return l
}

type buildListener struct {
	B *build

	Reader chan []byte
	Ack    chan struct{}

	remainder []byte
}

func (l *buildListener) Read(b []byte) (n int, err error) {
	l.B.mu.RLock()
	if _, open := l.B.listener[l]; !open {
		l.B.mu.RUnlock()
		return 0, io.EOF
	}
	l.B.mu.RUnlock()

	// Note: a single read is not guaranteed to consume all the data we receive on the channel.
	//       In that case we store the remainder and offer it up on the next call of Read. Only when the remainder
	//       is gone do we start receiving on the channel again.
	if len(l.remainder) > 0 {
		n = copy(b, l.remainder)
		l.remainder = l.remainder[n:]
		return n, nil
	}

	nd := <-l.Reader
	if nd == nil {
		l.Close()
		return 0, io.EOF
	}

	n = copy(b, nd)
	lnr := len(nd) - n
	if lnr > 0 {
		l.remainder = make([]byte, lnr)
		copy(l.remainder, nd[n:])
	}
	l.Ack <- struct{}{}

	return n, nil
}

func (l *buildListener) Close() error {
	log.Debug("closing build listener")
	l.B.mu.Lock()
	if _, open := l.B.listener[l]; open {
		close(l.Reader)
		close(l.Ack)

		delete(l.B.listener, l)
	}
	l.B.mu.Unlock()

	return nil
}

const (
	// maxLogSize is the maximum size of log output in bytes which we'll store in memory.
	// If a build log grows beyond this point we'll begin dropping bytes from the beginning of the the log.
	maxLogSize = 1 * 1024 * 1024
)

// Write writes bytes to all listeners ... if a listener can't keep up the messages are dropped
func (s *build) Write(p []byte) (n int, err error) {
	s.mu.RLock()
	if s.closed {
		s.mu.RUnlock()
		return 0, io.ErrClosedPipe
	}

	if s.logs == nil {
		s.logs, err = circbuf.NewBuffer(maxLogSize)
		if err != nil {
			return 0, err
		}
	}

	_, err = s.logs.Write(p)
	if err != nil {
		return 0, err
	}

	const timeout = 1500 * time.Millisecond

	var brokenListener []*buildListener
	for l := range s.listener {
		// Beware: this is a blocking write to the listner. The listener is likely to forward this data to a gRPC
		//         client, all of which is blocking. This means that we're intentionally relating the backpressure of
		//         this forwarding mechanism to the caller.
		//
		// To make this backpressure mechanism work we use a separate Ack channel. If we didn't do this we'd have
		// to copy p on ever write call and send the copy down the channel. Otherwise the receiving listener might
		// still hold p over the lifetime of this write call which would violate the io.Writer contract and leads
		// to corrupted log output (I've been there).
		//
		// TODO: Using two time.After for each write seems really wasteful and might bring too much load on the GC.
		//       We should observe the behaviour under load.
		select {
		case l.Reader <- p:
		case <-time.After(timeout):
			brokenListener = append(brokenListener, l)
			continue
		}

		select {
		case <-l.Ack:
		case <-time.After(timeout):
			brokenListener = append(brokenListener, l)
			continue
		}
	}
	s.mu.RUnlock()

	// We must call Close() outside of the readlock to avoid deadlock
	for _, bl := range brokenListener {
		bl.Close()
	}

	return len(p), nil
}

func (s *build) Close(status api.BuildStatus) (err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return io.ErrClosedPipe
	}

	s.closed = true
	s.status = status
	s.cond.Broadcast()

	for l := range s.listener {
		close(l.Reader)
		close(l.Ack)
		delete(s.listener, l)
	}

	if status == api.BuildStatus_done_failure || status == api.BuildStatus_unknown {
		// build did not succeed - we keep the logs around to facilitate later debugging
		log := log.WithField("status", status)

		// it's possible that the build failed before it produced any log output. In that case logs is nil.
		if s.logs != nil {
			log = log.WithField("logs", string(s.logs.Bytes()))
		} else {
			log.WithField("no-logs", "no logs produced")
		}
		log.WithField("status", status).Info("build was closed but not successful")
	}
	// make sure we release the logs to not leak memory
	s.logs = nil

	return nil
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
