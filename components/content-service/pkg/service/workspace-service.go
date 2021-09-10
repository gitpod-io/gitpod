// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"errors"
	"strings"

	"github.com/opentracing/opentracing-go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// WorkspaceService implements WorkspaceServiceServer
type WorkspaceService struct {
	cfg config.StorageConfig
	s   storage.PresignedAccess

	api.UnimplementedWorkspaceServiceServer
}

// NewWorkspaceService create a new content service
func NewWorkspaceService(cfg config.StorageConfig) (res *WorkspaceService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	return &WorkspaceService{cfg: cfg, s: s}, nil
}

// WorkspaceDownloadURL provides a URL from where the content of a workspace can be downloaded from
func (cs *WorkspaceService) WorkspaceDownloadURL(ctx context.Context, req *api.WorkspaceDownloadURLRequest) (resp *api.WorkspaceDownloadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "WorkspaceDownloadURL")
	span.SetTag("user", req.OwnerId)
	span.SetTag("workspaceId", req.WorkspaceId)
	defer tracing.FinishSpan(span, &err)

	blobName := cs.s.BackupObject(req.WorkspaceId, storage.DefaultBackup)

	info, err := cs.s.SignDownload(ctx, cs.s.Bucket(req.OwnerId), blobName, &storage.SignedURLOptions{})
	if err != nil {
		log.WithFields(log.OWI(req.OwnerId, req.WorkspaceId, "")).
			WithField("bucket", cs.s.Bucket(req.OwnerId)).
			WithField("blobName", blobName).
			WithError(err).
			Error("error getting SignDownload URL")
		if errors.Is(err, storage.ErrNotFound) {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}

	return &api.WorkspaceDownloadURLResponse{
		Url: info.URL,
	}, nil
}

// DeleteWorkspace deletes the content of a single workspace
func (cs *WorkspaceService) DeleteWorkspace(ctx context.Context, req *api.DeleteWorkspaceRequest) (resp *api.DeleteWorkspaceResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "DeleteWorkspace")
	span.SetTag("user", req.OwnerId)
	span.SetTag("workspaceId", req.WorkspaceId)
	span.SetTag("includeSnapshots", req.IncludeSnapshots)
	defer tracing.FinishSpan(span, &err)

	if req.IncludeSnapshots {
		prefix := cs.s.BackupObject(req.WorkspaceId, "")
		if !strings.HasSuffix(prefix, "/") {
			prefix = prefix + "/"
		}
		err = cs.s.DeleteObject(ctx, cs.s.Bucket(req.OwnerId), &storage.DeleteObjectQuery{Prefix: prefix})
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				log.WithError(err).Debug("deleting workspace backup: NotFound")
				return &api.DeleteWorkspaceResponse{}, nil
			}
			log.WithError(err).Error("error deleting workspace backup")
			return nil, status.Error(codes.Unknown, err.Error())
		}
		return &api.DeleteWorkspaceResponse{}, nil
	}

	blobName := cs.s.BackupObject(req.WorkspaceId, storage.DefaultBackup)
	err = cs.s.DeleteObject(ctx, cs.s.Bucket(req.OwnerId), &storage.DeleteObjectQuery{Name: blobName})
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			log.WithError(err).Debug("deleting workspace backup: NotFound, ", blobName)
			return &api.DeleteWorkspaceResponse{}, nil
		}
		log.WithError(err).Error("error deleting workspace backup: ", blobName)
		return nil, status.Error(codes.Unknown, err.Error())
	}

	trailPrefix := cs.s.BackupObject(req.WorkspaceId, "trail-")
	err = cs.s.DeleteObject(ctx, cs.s.Bucket(req.OwnerId), &storage.DeleteObjectQuery{Prefix: trailPrefix})
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			log.WithError(err).Debug("deleting workspace backup: NotFound, ", trailPrefix)
			return &api.DeleteWorkspaceResponse{}, nil
		}
		log.WithError(err).Error("error deleting workspace backup: ", trailPrefix)
		return nil, status.Error(codes.Unknown, err.Error())
	}

	return &api.DeleteWorkspaceResponse{}, nil
}
