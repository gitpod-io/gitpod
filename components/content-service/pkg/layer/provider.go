// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package layer

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/executor"
	"github.com/gitpod-io/gitpod/content-service/pkg/initializer"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"

	"github.com/opencontainers/go-digest"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
)

const (
	// BEWARE:
	// these formats duplicate naming conventions embedded in the remote storage implementations or ws-daemon.
	fmtWorkspaceManifest = "workspaces/%s/wsfull.json"
	fmtLegacyBackupName  = "workspaces/%s/full.tar"
)

// NewProvider produces a new content layer provider
func NewProvider(cfg *storage.Config) (*Provider, error) {
	s, err := storage.NewPresignedAccess(cfg)
	if err != nil {
		return nil, err
	}
	return &Provider{
		Storage: s,
		Client:  &http.Client{},
	}, nil
}

// Provider provides access to a workspace's content
type Provider struct {
	Storage storage.PresignedAccess
	Client  *http.Client
}

var errUnsupportedContentType = xerrors.Errorf("unsupported workspace content type")

func (s *Provider) downloadContentManifest(ctx context.Context, bkt, obj string) (manifest *csapi.WorkspaceContentManifest, info *storage.DownloadInfo, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "downloadContentManifest")
	defer func() {
		if manifest != nil {
			r, _ := json.Marshal(manifest)
			span.LogKV("manifest", string(r))

			lerr := err
			if lerr == storage.ErrNotFound {
				span.LogKV("found", false)
				lerr = nil
			}
			tracing.FinishSpan(span, &lerr)
		}
	}()

	info, err = s.Storage.SignDownload(ctx, bkt, obj, &storage.SignedURLOptions{})
	if err != nil {
		return
	}
	if info.Meta.ContentType != csapi.ContentTypeManifest {
		err = errUnsupportedContentType
		return
	}

	mfreq, err := http.NewRequestWithContext(ctx, "GET", info.URL, nil)
	if err != nil {
		return
	}
	mfresp, err := s.Client.Do(mfreq)
	if err != nil {
		return
	}
	if mfresp.StatusCode != http.StatusOK {
		err = xerrors.Errorf("cannot get %s: status %d", info.URL, mfresp.StatusCode)
		return
	}
	if mfresp.Body == nil {
		err = xerrors.Errorf("empty response")
		return
	}
	defer mfresp.Body.Close()

	mfr, err := ioutil.ReadAll(mfresp.Body)
	if err != nil {
		return
	}
	span.LogKV("manifest", string(mfr))

	var mf csapi.WorkspaceContentManifest
	err = json.Unmarshal(mfr, &mf)
	if err != nil {
		return
	}
	manifest = &mf

	if mf.Type != csapi.TypeFullWorkspaceContentV1 {
		err = errUnsupportedContentType
		return
	}

	return
}

// GetContentLayer provides the content layer for a workspace
func (s *Provider) GetContentLayer(ctx context.Context, owner, workspaceID string, initializer *csapi.WorkspaceInitializer) (l []Layer, manifest *csapi.WorkspaceContentManifest, err error) {
	span, ctx := tracing.FromContext(ctx, "GetContentLayer")
	defer tracing.FinishSpan(span, &err)
	tracing.ApplyOWI(span, log.OWI(owner, workspaceID, ""))

	defer func() {
		// we never return a nil manifest, just maybe an empty one
		if manifest == nil {
			manifest = &csapi.WorkspaceContentManifest{
				Type: csapi.TypeFullWorkspaceContentV1,
			}
		}
	}()

	// check if workspace has an FWB
	var (
		bucket = s.Storage.Bucket(owner)
		mfobj  = fmt.Sprintf(fmtWorkspaceManifest, workspaceID)
	)
	span.LogKV("bucket", bucket, "mfobj", mfobj)
	manifest, _, err = s.downloadContentManifest(ctx, bucket, mfobj)
	if err != nil && err != storage.ErrNotFound {
		return nil, nil, err
	}
	if manifest != nil {
		span.LogKV("backup found", "full workspace backup")

		l, err = s.layerFromContentManifest(ctx, manifest, csapi.WorkspaceInitFromBackup, true)
		return l, manifest, err
	}

	// check if legacy workspace backup is present
	var layer *Layer
	info, err := s.Storage.SignDownload(ctx, bucket, fmt.Sprintf(fmtLegacyBackupName, workspaceID), &storage.SignedURLOptions{})
	if err != nil && !xerrors.Is(err, storage.ErrNotFound) {
		return nil, nil, err
	}
	if err == nil {
		span.LogKV("backup found", "legacy workspace backup")

		cdesc, err := executor.PrepareFromBackup(info.URL)
		if err != nil {
			return nil, nil, err
		}

		layer, err = contentDescriptorToLayer(cdesc)
		if err != nil {
			return nil, nil, err
		}

		l = []Layer{*layer}
		return l, manifest, nil
	}

	// At this point we've found neither a full-workspace-backup, nor a legacy backup.
	// It's time to use the initializer.
	if gis := initializer.GetSnapshot(); gis != nil {
		return s.getSnapshotContentLayer(ctx, gis)
	}
	if pis := initializer.GetPrebuild(); pis != nil {
		l, manifest, err = s.getPrebuildContentLayer(ctx, pis)
		if err != nil {
			log.WithError(err).WithFields(log.OWI(owner, workspaceID, "")).Warn("cannot initialize from prebuild - falling back to Git")
			span.LogKV("fallback-to-git", err.Error())

			// we failed creating a prebuild initializer, so let's try falling back to the Git part.
			initializer = &csapi.WorkspaceInitializer{Spec: &csapi.WorkspaceInitializer_Git{Git: pis.Git}}
		} else {
			// creating the initializer worked - we're done here
			return
		}
	}
	if gis := initializer.GetGit(); gis != nil {
		span.LogKV("initializer", "Git")

		cdesc, err := executor.Prepare(initializer, nil)
		if err != nil {
			return nil, nil, err
		}

		layer, err = contentDescriptorToLayer(cdesc)
		if err != nil {
			return nil, nil, err
		}
		return []Layer{*layer}, nil, nil
	}

	return nil, nil, xerrors.Errorf("no backup or valid initializer present")
}

func (s *Provider) getSnapshotContentLayer(ctx context.Context, sp *csapi.SnapshotInitializer) (l []Layer, manifest *csapi.WorkspaceContentManifest, err error) {
	span, ctx := tracing.FromContext(ctx, "getSnapshotContentLayer")
	defer tracing.FinishSpan(span, &err)

	segs := strings.Split(sp.Snapshot, "@")
	if len(segs) != 2 {
		return nil, nil, xerrors.Errorf("invalid snapshot FQN: %s", sp.Snapshot)
	}
	obj, bkt := segs[0], segs[1]

	// maybe the snapshot is a full workspace snapshot, i.e. has a content manifest
	manifest, info, err := s.downloadContentManifest(ctx, bkt, obj)
	if err == storage.ErrNotFound {
		return nil, nil, xerrors.Errorf("invalid snapshot: %w", err)
	}
	// If err == errUnsupportedContentType we've found a storage object but with invalid type.
	// Chances are we have a non-fwb snapshot at our hands.
	if err != nil && err != errUnsupportedContentType {
		return nil, nil, err
	}

	if manifest == nil {
		// we've found a legacy snapshot
		cdesc, err := executor.Prepare(&csapi.WorkspaceInitializer{Spec: &csapi.WorkspaceInitializer_Snapshot{Snapshot: sp}}, map[string]string{
			sp.Snapshot: info.URL,
		})
		if err != nil {
			return nil, nil, err
		}

		layer, err := contentDescriptorToLayer(cdesc)
		if err != nil {
			return nil, nil, err
		}
		return []Layer{*layer}, nil, nil
	}

	// we've found a manifest for this fwb snapshot - let's use it
	l, err = s.layerFromContentManifest(ctx, manifest, csapi.WorkspaceInitFromOther, true)
	return l, manifest, nil
}

func (s *Provider) getPrebuildContentLayer(ctx context.Context, pb *csapi.PrebuildInitializer) (l []Layer, manifest *csapi.WorkspaceContentManifest, err error) {
	span, ctx := tracing.FromContext(ctx, "getPrebuildContentLayer")
	defer tracing.FinishSpan(span, &err)

	segs := strings.Split(pb.Prebuild.Snapshot, "@")
	if len(segs) != 2 {
		return nil, nil, xerrors.Errorf("invalid snapshot FQN: %s", pb.Prebuild.Snapshot)
	}
	obj, bkt := segs[0], segs[1]

	// maybe the snapshot is a full workspace snapshot, i.e. has a content manifest
	manifest, info, err := s.downloadContentManifest(ctx, bkt, obj)
	if err == storage.ErrNotFound {
		return nil, nil, xerrors.Errorf("invalid snapshot: %w", err)
	}

	// If err == errUnsupportedContentType we've found a storage object but with invalid type.
	// Chances are we have a non-fwb snapshot at our hands.
	if err != nil && err != errUnsupportedContentType {
		return nil, nil, err
	}

	var cdesc []byte
	if manifest == nil {
		// legacy prebuild - resort to in-workspace content init
		cdesc, err = executor.Prepare(&csapi.WorkspaceInitializer{Spec: &csapi.WorkspaceInitializer_Prebuild{Prebuild: pb}}, map[string]string{
			pb.Prebuild.Snapshot: info.URL,
		})
		if err != nil {
			return nil, nil, err
		}
	} else {
		// fwb prebuild - add snapshot as content layer
		var ls []Layer
		ls, err = s.layerFromContentManifest(ctx, manifest, csapi.WorkspaceInitFromPrebuild, false)
		if err != nil {
			return nil, nil, err
		}
		l = append(l, ls...)

		// and run no-snapshot prebuild init in workspace
		cdesc, err = executor.Prepare(&csapi.WorkspaceInitializer{
			Spec: &csapi.WorkspaceInitializer_Prebuild{
				Prebuild: &csapi.PrebuildInitializer{
					Git: pb.Git,
				},
			},
		}, nil)
		if err != nil {
			return nil, nil, err
		}
	}

	layer, err := contentDescriptorToLayer(cdesc)
	if err != nil {
		return nil, nil, err
	}
	l = append(l, *layer)
	return l, manifest, nil
}

func (s *Provider) layerFromContentManifest(ctx context.Context, mf *csapi.WorkspaceContentManifest, initsrc csapi.WorkspaceInitSource, ready bool) (l []Layer, err error) {
	// we have a valid full workspace backup
	l = make([]Layer, len(mf.Layers))
	for i, mfl := range mf.Layers {
		info, err := s.Storage.SignDownload(ctx, mfl.Bucket, mfl.Object, &storage.SignedURLOptions{})
		if err != nil {
			return nil, err
		}
		if info.Meta.Digest != mfl.Digest.String() {
			return nil, xerrors.Errorf("digest mismatch for %s/%s: expected %s, got %s", mfl.Bucket, mfl.Object, mfl.Digest, info.Meta.Digest)
		}
		l[i] = Layer{
			DiffID:    mfl.DiffID.String(),
			Digest:    mfl.Digest.String(),
			MediaType: mfl.MediaType,
			URL:       info.URL,
			Size:      mfl.Size,
		}
	}

	if ready {
		rl, err := workspaceReadyLayer(initsrc)
		if err != nil {
			return nil, err
		}
		l = append(l, *rl)
	}
	return l, nil
}

func contentDescriptorToLayer(cdesc []byte) (*Layer, error) {
	return layerFromContent(
		fileInLayer{&tar.Header{Typeflag: tar.TypeDir, Name: "/workspace", Uid: initializer.GitpodUID, Gid: initializer.GitpodGID, Mode: 0755}, nil},
		fileInLayer{&tar.Header{Typeflag: tar.TypeDir, Name: "/workspace/.gitpod", Uid: initializer.GitpodUID, Gid: initializer.GitpodGID, Mode: 0755}, nil},
		fileInLayer{&tar.Header{Typeflag: tar.TypeReg, Name: "/workspace/.gitpod/content.json", Uid: initializer.GitpodUID, Gid: initializer.GitpodGID, Mode: 0755, Size: int64(len(cdesc))}, cdesc},
	)
}

func workspaceReadyLayer(src csapi.WorkspaceInitSource) (*Layer, error) {
	msg := csapi.WorkspaceReadyMessage{
		Source: src,
	}
	ctnt, err := json.Marshal(msg)
	if err != nil {
		return nil, err
	}

	return layerFromContent(
		fileInLayer{&tar.Header{Typeflag: tar.TypeDir, Name: "/workspace", Uid: initializer.GitpodUID, Gid: initializer.GitpodGID, Mode: 0755}, nil},
		fileInLayer{&tar.Header{Typeflag: tar.TypeDir, Name: "/workspace/.gitpod", Uid: initializer.GitpodUID, Gid: initializer.GitpodGID, Mode: 0755}, nil},
		fileInLayer{&tar.Header{Typeflag: tar.TypeReg, Name: "/workspace/.gitpod/ready", Uid: initializer.GitpodUID, Gid: initializer.GitpodGID, Mode: 0755, Size: int64(len(ctnt))}, []byte(ctnt)},
	)
}

type fileInLayer struct {
	Header  *tar.Header
	Content []byte
}

func layerFromContent(fs ...fileInLayer) (*Layer, error) {
	buf := bytes.NewBuffer(nil)
	tw := tar.NewWriter(buf)
	for _, h := range fs {
		err := tw.WriteHeader(h.Header)
		if err != nil {
			return nil, xerrors.Errorf("cannot prepare content layer: %w", err)
		}

		if len(h.Content) == 0 {
			continue
		}
		_, err = tw.Write(h.Content)
		if err != nil {
			return nil, xerrors.Errorf("cannot prepare content layer: %w", err)
		}
	}
	tw.Close()

	return &Layer{
		Digest:  digest.FromBytes(buf.Bytes()).String(),
		Content: buf.Bytes(),
	}, nil
}

// Layer is a content layer which is meant to be added to a workspace's image
type Layer struct {
	Content []byte

	URL       string
	Digest    string
	DiffID    string
	MediaType string
	Size      int64
}
