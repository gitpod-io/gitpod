// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	docker "github.com/docker/docker/client"
	"github.com/docker/docker/pkg/jsonmessage"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
)

// pullImage pulls a docker image from a registry and forwards the log output to out
func (b *DockerBuilder) pullImage(ctx context.Context, out io.Writer, ref, auth string) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "pullImage")
	defer tracing.FinishSpan(span, &err)

	resp, err := b.Docker.ImagePull(ctx, ref, types.ImagePullOptions{
		RegistryAuth: auth,
	})
	if err != nil {
		return err
	}
	defer resp.Close()

	if out == nil {
		// we don't care for the output
		_, err = io.Copy(io.Discard, resp)
		if err != nil {
			return err
		}

		return nil
	}

	err = jsonmessage.DisplayJSONMessagesStream(resp, out, 0, false, nil)
	if err != nil {
		return err
	}

	return nil
}

// runContainer starts a container, forwards the log output and returns when the container ends.
func (b *DockerBuilder) runContainer(ctx context.Context, logs io.Writer, containerID string) (err error) {
	var logr io.Reader
	if logs != nil {
		containerLog, err := b.Docker.ContainerAttach(ctx, containerID, types.ContainerAttachOptions{
			Stream: true,
			Stdout: true,
			Stderr: true,
		})
		if err != nil {
			return err
		}
		defer containerLog.Close()

		logr = containerLog.Reader
	}

	err = b.Docker.ContainerStart(ctx, containerID, types.ContainerStartOptions{})
	if err != nil {
		return err
	}

	if logs != nil {
		_, err = io.Copy(logs, logr)
		if err != nil {
			return err
		}
	}

	initrn, errchan := b.Docker.ContainerWait(ctx, containerID, container.WaitConditionNotRunning)
	select {
	case res := <-initrn:
		if res.StatusCode != 0 {
			return xerrors.Errorf("container exited with non-zero exit code: %v", res.StatusCode)
		}
	case err := <-errchan:
		return err
	}

	return nil
}

// checkImageExists checks if an image already exists in the registry. Returns gRPC errors if there are any.
func (b *DockerBuilder) checkImageExists(ctx context.Context, refstr, auth string) (exists bool, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "checkImageExists")
	defer tracing.FinishSpan(span, &err)
	span.SetTag("ref", refstr)

	// asking a registry is an expensive operation, hence we cache using the assumption that once an image exists
	// it is never deleted. If for whatever reason that's not true, one needs to restart the image builder to clear
	// this cache.
	b.imgExistsMu.RLock()
	_, exists = b.imgExistsCache[refstr]
	b.imgExistsMu.RUnlock()
	if exists {
		return exists, nil
	}

	// cachemiss - let's ask the registry
	_, err = b.Docker.DistributionInspect(ctx, refstr, auth)
	if err != nil && status.Code(dockerErrToGRPC(err, "")) == codes.NotFound {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if strings.HasPrefix(refstr, b.Config.BaseImageRepository) || strings.HasPrefix(refstr, b.Config.WorkspaceImageRepository) {
		// We only cache "checkExists" for images we build ourselves due to the assumption that once an image exists it exists forever.
		// This assumption is already shakey in the image-builder registry context, but too unreliable in the general case.
		b.imgExistsMu.Lock()
		b.imgExistsCache[refstr] = struct{}{}
		b.imgExistsMu.Unlock()
	}
	return true, nil
}

// serveContext serves /workspace/context within a volume as gzipped-tar stream on the out writer.
// This is useful for sending context which was prepared in a volume to a Docker build.
func (b *DockerBuilder) serveContext(ctx context.Context, bld *build, volume, path string, out io.WriteCloser) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "serveContext")
	defer tracing.FinishSpan(span, &err)

	defer out.Close()

	containerName := fmt.Sprintf("serve-%s-%d", bld.ID, time.Now().UnixNano())
	log.WithField("buildRef", bld.Ref).WithField("container", containerName).WithField("path", path).Debug("serving context for image build")
	serverContainer, err := b.Docker.ContainerCreate(ctx, &container.Config{
		Image:        b.builderref,
		AttachStdout: true,
		AttachStdin:  true,
		AttachStderr: false,
		Cmd:          []string{"sh", "-c", "tar cz . | base64 -w 0"},
		WorkingDir:   path,
		Tty:          true,
		Labels: map[string]string{
			LabelTemporary: "true",
		},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: volume, Target: "/workspace"},
		},
	}, nil, containerName)
	if err != nil {
		return xerrors.Errorf("cannot create context server: %w", err)
	}
	contextstream, err := b.Docker.ContainerAttach(ctx, serverContainer.ID, types.ContainerAttachOptions{
		Stream: true,
		Stdout: true,
		Stderr: false,
		Stdin:  true,
	})
	if err != nil {
		return xerrors.Errorf("cannot attach to context server: %w", err)
	}
	defer contextstream.Close()

	go io.Copy(out, base64.NewDecoder(base64.RawStdEncoding, contextstream.Reader))

	err = b.Docker.ContainerStart(ctx, serverContainer.ID, types.ContainerStartOptions{})
	if err != nil {
		return xerrors.Errorf("cannot run context server: %w", err)
	}
	defer b.Docker.ContainerStop(ctx, serverContainer.ID, nil)

	// wait for the context server to finish
	okchan, errchan := b.Docker.ContainerWait(ctx, serverContainer.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errchan:
		if err != nil {
			return xerrors.Errorf("cannot run context server: %w", err)
		}
	case <-ctx.Done():
		return ctx.Err()
	case <-okchan:
	}

	return nil
}

// getAbsoluteImageRef returns the "digest" form of an image, i.e. contains no mutable image tags
func (b *DockerBuilder) getAbsoluteImageRef(ctx context.Context, ref string, allowedAuth allowedAuthFor) (res string, err error) {
	auth, err := allowedAuth.getAuthFor(b.Auth, ref)
	if err != nil {
		return "", xerrors.Errorf("cannt resolve base image ref: %w", err)
	}

	return b.Resolver.Resolve(ctx, ref, resolve.WithAuthentication(auth))
}

func (b *DockerBuilder) getBaseImageRef(ctx context.Context, bs *api.BuildSource, allowedAuth allowedAuthFor) (res string, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "getBaseImageRef")
	defer tracing.FinishSpan(span, &err)

	switch src := bs.From.(type) {
	case *api.BuildSource_Ref:
		return b.getAbsoluteImageRef(ctx, src.Ref.Ref, allowedAuth)

	case *api.BuildSource_File:
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
		} else if n < len(dfl) {
			return "", xerrors.Errorf("cannot compute src image ref: short write")
		}

		_, err = fmt.Fprintln(hash, b.Config.ImageBuildSalt)
		if err != nil {
			return "", xerrors.Errorf("cannot compute src image ref: %w", err)
		}

		return fmt.Sprintf("%s:%x", b.Config.BaseImageRepository, hash.Sum([]byte{})), nil

	default:
		return "", xerrors.Errorf("invalid base image")
	}
}

func (b *DockerBuilder) getWorkspaceImageRef(ctx context.Context, baseref string, gitpodLayerHash string, allowedAuth allowedAuthFor) (ref string, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "getWorkspaceImageRef")
	defer tracing.FinishSpan(span, &err)

	cnt := []byte(fmt.Sprintf("%s\n%s\n%s", baseref, gitpodLayerHash, b.Config.ImageBuildSalt))
	hash := sha256.New()
	n, err := hash.Write(cnt)
	if err != nil {
		return "", xerrors.Errorf("cannot produce workspace image name: %w", err)
	}
	if n < len(cnt) {
		return "", xerrors.Errorf("cannot produce workspace image name: %w", io.ErrShortWrite)
	}

	dst := hash.Sum([]byte{})
	return fmt.Sprintf("%s:%x", b.Config.WorkspaceImageRepository, dst), nil
}

func dockerErrToGRPC(err error, msg string) error {
	if err == nil {
		return nil
	}

	var dockerErrResp = "Error response from daemon: "

	if docker.IsErrConnectionFailed(err) {
		return status.Error(codes.Unavailable, msg+": daemon is not available")
	}
	if docker.IsErrNotFound(err) || strings.Contains(err.Error(), dockerErrResp+"manifest unknown") || strings.Contains(err.Error(), dockerErrResp+"name unknown") {
		return status.Error(codes.NotFound, msg+": not found")
	}
	if docker.IsErrUnauthorized(err) {
		return status.Error(codes.PermissionDenied, msg+": not authorized")
	}

	return status.Error(codes.Internal, msg+": "+err.Error())
}
