// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package content

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/opencontainers/runc/libcontainer/specconv"
	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/opentracing/opentracing-go"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	wsinit "github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// RunInitializerOpts configure RunInitializer
type RunInitializerOpts struct {
	// Command is the path to the initializer executable we'll run
	Command string
	// Args is a set of additional arguments to pass to the initializer executable
	Args []string
	// Options to use on untar
	IdMappings []archive.IDMapping

	UID uint32
	GID uint32

	OWI OWI
}

type OWI struct {
	Owner       string
	WorkspaceID string
	InstanceID  string
}

func (o OWI) Fields() map[string]interface{} {
	return log.OWI(o.Owner, o.WorkspaceID, o.InstanceID)
}

// errors to be tested with errors.Is
var (
	// cannot find snapshot
	errCannotFindSnapshot = errors.New("cannot find snapshot")
)

func collectRemoteContent(ctx context.Context, rs storage.DirectAccess, ps storage.PresignedAccess, workspaceOwner string, initializer *csapi.WorkspaceInitializer) (rc map[string]storage.DownloadInfo, err error) {
	rc = make(map[string]storage.DownloadInfo)

	backup, err := ps.SignDownload(ctx, rs.Bucket(workspaceOwner), rs.BackupObject(storage.DefaultBackup), &storage.SignedURLOptions{})
	if err == storage.ErrNotFound {
		// no backup found - that's fine
	} else if err != nil {
		return nil, err
	} else {
		rc[storage.DefaultBackup] = *backup
	}

	si := initializer.GetSnapshot()
	pi := initializer.GetPrebuild()
	if ci := initializer.GetComposite(); ci != nil {
		for _, c := range ci.Initializer {
			if c.GetSnapshot() != nil {
				si = c.GetSnapshot()
			}
			if c.GetPrebuild() != nil {
				pi = c.GetPrebuild()
			}
		}
	}
	if si != nil {
		bkt, obj, err := storage.ParseSnapshotName(si.Snapshot)
		if err != nil {
			return nil, err
		}
		info, err := ps.SignDownload(ctx, bkt, obj, &storage.SignedURLOptions{})
		if err == storage.ErrNotFound {
			return nil, errCannotFindSnapshot
		}
		if err != nil {
			return nil, xerrors.Errorf("cannot find snapshot: %w", err)
		}

		rc[si.Snapshot] = *info
	}
	if pi != nil && pi.Prebuild != nil && pi.Prebuild.Snapshot != "" {
		bkt, obj, err := storage.ParseSnapshotName(pi.Prebuild.Snapshot)
		if err != nil {
			return nil, err
		}
		info, err := ps.SignDownload(ctx, bkt, obj, &storage.SignedURLOptions{})
		if err == storage.ErrNotFound {
			// no prebuild found - that's fine
		} else if err != nil {
			return nil, xerrors.Errorf("cannot find prebuild: %w", err)
		} else {
			rc[pi.Prebuild.Snapshot] = *info
		}
	}

	return rc, nil
}

// RunInitializer runs a content initializer in a user, PID and mount namespace to isolate it from ws-daemon
func RunInitializer(ctx context.Context, destination string, initializer *csapi.WorkspaceInitializer, remoteContent map[string]storage.DownloadInfo, opts RunInitializerOpts) (err error) {
	//nolint:ineffassign,staticcheck
	span, ctx := opentracing.StartSpanFromContext(ctx, "RunInitializer")
	defer tracing.FinishSpan(span, &err)

	// it's possible the destination folder doesn't exist yet, because the kubelet hasn't created it yet.
	// If we fail to create the folder, it either already exists, or we'll fail when we try and mount it.
	err = os.MkdirAll(destination, 0755)
	if err != nil && !os.IsExist(err) {
		return xerrors.Errorf("cannot mkdir destination: %w", err)
	}

	init, err := proto.Marshal(initializer)
	if err != nil {
		return err
	}

	if opts.GID == 0 {
		opts.GID = wsinit.GitpodGID
	}
	if opts.UID == 0 {
		opts.UID = wsinit.GitpodUID
	}

	tmpdir, err := os.MkdirTemp("", "content-init")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpdir)

	err = os.MkdirAll(filepath.Join(tmpdir, "rootfs"), 0755)
	if err != nil {
		return err
	}

	msg := msgInitContent{
		Destination:   "/dst",
		Initializer:   init,
		RemoteContent: remoteContent,
		TraceInfo:     tracing.GetTraceID(span),
		IDMappings:    opts.IdMappings,
		GID:           int(opts.GID),
		UID:           int(opts.UID),
		OWI:           opts.OWI.Fields(),
	}
	fc, err := json.MarshalIndent(msg, "", "  ")
	if err != nil {
		return err
	}
	err = os.WriteFile(filepath.Join(tmpdir, "rootfs", "content.json"), fc, 0644)
	if err != nil {
		return err
	}

	spec := specconv.Example()

	// we assemble the root filesystem from the ws-daemon container
	for _, d := range []string{"app", "bin", "dev", "etc", "lib", "opt", "sbin", "sys", "usr", "var", "lib32", "lib64", "tmp"} {
		spec.Mounts = append(spec.Mounts, specs.Mount{
			Destination: "/" + d,
			Source:      "/" + d,
			Type:        "bind",
			Options:     []string{"rbind", "rprivate"},
		})
	}
	spec.Mounts = append(spec.Mounts, specs.Mount{
		Destination: "/dst",
		Source:      destination,
		Type:        "bind",
		Options:     []string{"bind", "rprivate"},
	})

	spec.Hostname = "content-init"
	spec.Process.Terminal = false
	spec.Process.NoNewPrivileges = true
	spec.Process.User.UID = opts.UID
	spec.Process.User.GID = opts.GID
	spec.Process.Args = []string{"/app/content-initializer"}
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "JAEGER_") || strings.HasPrefix(e, "GIT_SSL_CAPATH=") || strings.HasPrefix(e, "GIT_SSL_CAINFO=") {
			spec.Process.Env = append(spec.Process.Env, e)
		}
	}

	// TODO(cw): make the initializer work without chown
	spec.Process.Capabilities.Ambient = append(spec.Process.Capabilities.Ambient, "CAP_CHOWN", "CAP_FOWNER", "CAP_MKNOD", "CAP_SETFCAP")
	spec.Process.Capabilities.Bounding = append(spec.Process.Capabilities.Bounding, "CAP_CHOWN", "CAP_FOWNER", "CAP_MKNOD", "CAP_SETFCAP")
	spec.Process.Capabilities.Effective = append(spec.Process.Capabilities.Effective, "CAP_CHOWN", "CAP_FOWNER", "CAP_MKNOD", "CAP_SETFCAP")
	spec.Process.Capabilities.Inheritable = append(spec.Process.Capabilities.Inheritable, "CAP_CHOWN", "CAP_FOWNER", "CAP_MKNOD", "CAP_SETFCAP")
	spec.Process.Capabilities.Permitted = append(spec.Process.Capabilities.Permitted, "CAP_CHOWN", "CAP_FOWNER", "CAP_MKNOD", "CAP_SETFCAP")
	// TODO(cw): setup proper networking in a netns, rather than relying on ws-daemons network
	n := 0
	for _, x := range spec.Linux.Namespaces {
		if x.Type == specs.NetworkNamespace {
			continue
		}

		spec.Linux.Namespaces[n] = x
		n++
	}
	spec.Linux.Namespaces = spec.Linux.Namespaces[:n]

	fc, err = json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}
	err = os.WriteFile(filepath.Join(tmpdir, "config.json"), fc, 0644)
	if err != nil {
		return err
	}

	args := []string{"--root", "state"}

	if log.Log.Logger.IsLevelEnabled(logrus.DebugLevel) {
		args = append(args, "--debug")
	}

	var name string
	if opts.OWI.InstanceID == "" {
		id, err := uuid.NewRandom()
		if err != nil {
			return err
		}
		name = "init-rnd-" + id.String()
	} else {
		name = "init-ws-" + opts.OWI.InstanceID
	}

	args = append(args, "--log-format", "json", "run")
	args = append(args, "--preserve-fds", "1")
	args = append(args, name)

	errIn, errOut, err := os.Pipe()
	if err != nil {
		return err
	}
	errch := make(chan []byte, 1)
	go func() {
		errmsg, _ := ioutil.ReadAll(errIn)
		errch <- errmsg
	}()

	var cmdOut bytes.Buffer
	cmd := exec.Command("runc", args...)
	cmd.Dir = tmpdir
	cmd.Stdout = &cmdOut
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	cmd.ExtraFiles = []*os.File{errOut}
	err = cmd.Run()
	log.FromBuffer(&cmdOut, log.WithFields(opts.OWI.Fields()))
	errOut.Close()

	var errmsg []byte
	select {
	case errmsg = <-errch:
	case <-time.After(1 * time.Second):
		errmsg = []byte("failed to read content initializer response")
	}
	if err != nil {
		if exiterr, ok := err.(*exec.ExitError); ok {
			// The program has exited with an exit code != 0. If it's FAIL_CONTENT_INITIALIZER_EXIT_CODE, it was deliberate.
			if status, ok := exiterr.Sys().(syscall.WaitStatus); ok && status.ExitStatus() == FAIL_CONTENT_INITIALIZER_EXIT_CODE {
				log.WithError(err).WithField("exitCode", status.ExitStatus()).WithField("args", args).Error("content init failed")
				return xerrors.Errorf(string(errmsg))
			}
		}

		return err
	}

	return nil
}

// RunInitializerChild is the function that's expected to run when we call `/proc/self/exe content-initializer`
func RunInitializerChild() (err error) {
	fc, err := os.ReadFile("/content.json")
	if err != nil {
		return err
	}

	var initmsg msgInitContent
	err = json.Unmarshal(fc, &initmsg)
	if err != nil {
		return err
	}
	log.Log = logrus.WithFields(initmsg.OWI)

	defer func() {
		if err != nil {
			log.WithError(err).WithFields(initmsg.OWI).Error("content init failed")
		}
	}()

	span := opentracing.StartSpan("RunInitializerChild", opentracing.ChildOf(tracing.FromTraceID(initmsg.TraceInfo)))
	defer tracing.FinishSpan(span, &err)
	ctx := opentracing.ContextWithSpan(context.Background(), span)

	var req csapi.WorkspaceInitializer
	err = proto.Unmarshal(initmsg.Initializer, &req)
	if err != nil {
		return err
	}

	rs := &remoteContentStorage{RemoteContent: initmsg.RemoteContent}

	dst := initmsg.Destination
	initializer, err := wsinit.NewFromRequest(ctx, dst, rs, &req, wsinit.NewFromRequestOpts{ForceGitpodUserForGit: false})
	if err != nil {
		return err
	}

	initSource, stats, err := wsinit.InitializeWorkspace(ctx, dst, rs,
		wsinit.WithInitializer(initializer),
		wsinit.WithMappings(initmsg.IDMappings),
		wsinit.WithChown(initmsg.UID, initmsg.GID),
		wsinit.WithCleanSlate,
	)
	if err != nil {
		return err
	}

	// some workspace content may have a `/dst/.gitpod` file or directory. That would break
	// the workspace ready file placement (see https://github.com/gitpod-io/gitpod/issues/7694).
	err = wsinit.EnsureCleanDotGitpodDirectory(ctx, dst)
	if err != nil {
		return err
	}

	// Place the ready file to make Theia "open its gates"
	err = wsinit.PlaceWorkspaceReadyFile(ctx, dst, initSource, stats, initmsg.UID, initmsg.GID)
	if err != nil {
		return err
	}

	return nil
}

var _ storage.DirectAccess = &remoteContentStorage{}

type remoteContentStorage struct {
	RemoteContent map[string]storage.DownloadInfo
}

// Init does nothing
func (rs *remoteContentStorage) Init(ctx context.Context, owner, workspace, instance string) error {
	return nil
}

// EnsureExists does nothing
func (rs *remoteContentStorage) EnsureExists(ctx context.Context) error {
	return nil
}

// Download always returns false and does nothing
func (rs *remoteContentStorage) Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (exists bool, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "remoteContentStorage.Download")
	span.SetTag("destination", destination)
	span.SetTag("name", name)
	defer tracing.FinishSpan(span, &err)

	info, exists := rs.RemoteContent[name]
	if !exists {
		return false, nil
	}

	span.SetTag("URL", info.URL)

	// create a temporal file to download the content
	tempFile, err := os.CreateTemp("", "remote-content-*")
	if err != nil {
		return true, xerrors.Errorf("cannot create temporal file: %w", err)
	}
	tempFile.Close()

	args := []string{
		"-s10", "-x16", "-j12",
		"--retry-wait=5",
		"--log-level=error",
		"--allow-overwrite=true", // rewrite temporal empty file
		info.URL,
		"-o", tempFile.Name(),
	}

	cmd := exec.Command("aria2c", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.WithError(err).WithField("out", string(out)).Error("unexpected error downloading file")
		return true, xerrors.Errorf("unexpected error downloading file")
	}

	tempFile, err = os.Open(tempFile.Name())
	if err != nil {
		return true, xerrors.Errorf("unexpected error downloading file")
	}

	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	err = archive.ExtractTarbal(ctx, tempFile, destination, archive.WithUIDMapping(mappings), archive.WithGIDMapping(mappings))
	if err != nil {
		return true, xerrors.Errorf("tar %s: %s", destination, err.Error())
	}

	return true, nil
}

// DownloadSnapshot always returns false and does nothing
func (rs *remoteContentStorage) DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (bool, error) {
	return rs.Download(ctx, destination, name, mappings)
}

// ListObjects returns all objects found with the given prefix. Returns an empty list if the bucket does not exuist (yet).
func (rs *remoteContentStorage) ListObjects(ctx context.Context, prefix string) (objects []string, err error) {
	return []string{}, nil
}

// Qualify just returns the name
func (rs *remoteContentStorage) Qualify(name string) string {
	return name
}

// Upload does nothing
func (rs *remoteContentStorage) Upload(ctx context.Context, source string, name string, opts ...storage.UploadOption) (string, string, error) {
	return "", "", xerrors.Errorf("not implemented")
}

// UploadInstance takes all files from a local location and uploads it to the remote storage
func (rs *remoteContentStorage) UploadInstance(ctx context.Context, source string, name string, options ...storage.UploadOption) (bucket, obj string, err error) {
	return "", "", xerrors.Errorf("not implemented")
}

// Bucket returns an empty string
func (rs *remoteContentStorage) Bucket(string) string {
	return ""
}

// BackupObject returns a backup's object name that a direct downloader would download
func (rs *remoteContentStorage) BackupObject(name string) string {
	return ""
}

// InstanceObject returns a instance's object name that a direct downloader would download
func (rs *remoteContentStorage) InstanceObject(workspaceID string, instanceID string, name string) string {
	return ""
}

// SnapshotObject returns a snapshot's object name that a direct downloer would download
func (rs *remoteContentStorage) SnapshotObject(name string) string {
	return ""
}

type msgInitContent struct {
	Destination   string
	RemoteContent map[string]storage.DownloadInfo
	Initializer   []byte
	UID, GID      int
	IDMappings    []archive.IDMapping

	TraceInfo string
	OWI       map[string]interface{}
}
