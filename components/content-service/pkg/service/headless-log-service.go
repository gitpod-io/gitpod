// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"
	"strings"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/logs"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// HeadlessLogService implements LogServiceServer
type HeadlessLogService struct {
	cfg       storage.Config
	s         storage.PresignedAccess
	daFactory func(cfg *storage.Config) (storage.DirectAccess, error)

	api.UnimplementedHeadlessLogServiceServer
}

// NewHeadlessLogService create a new content service
func NewHeadlessLogService(cfg storage.Config) (res *HeadlessLogService, err error) {
	s, err := storage.NewPresignedAccess(&cfg)
	if err != nil {
		return nil, err
	}
	daFactory := func(cfg *storage.Config) (storage.DirectAccess, error) {
		return storage.NewDirectAccess(cfg)
	}
	return &HeadlessLogService{
		cfg:       cfg,
		s:         s,
		daFactory: daFactory,
	}, nil
}

// LogDownloadURL provides a URL from where the content of a workspace log stream can be downloaded from
func (ls *HeadlessLogService) LogDownloadURL(ctx context.Context, req *api.LogDownloadURLRequest) (resp *api.LogDownloadURLResponse, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "WorkspaceDownloadURL")
	span.SetTag("user", req.OwnerId)
	span.SetTag("workspaceId", req.WorkspaceId)
	span.SetTag("instanceId", req.InstanceId)
	defer tracing.FinishSpan(span, &err)

	blobName := ls.s.InstanceObject(req.WorkspaceId, req.InstanceId, logs.UploadedHeadlessLogPath(req.TaskId))
	info, err := ls.s.SignDownload(ctx, ls.s.Bucket(req.OwnerId), blobName, &storage.SignedURLOptions{})
	if err != nil {
		log.WithFields(log.OWI(req.OwnerId, req.WorkspaceId, "")).
			WithField("bucket", ls.s.Bucket(req.OwnerId)).
			WithField("blobName", blobName).
			WithError(err).
			Error("error getting SignDownload URL")
		if err == storage.ErrNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Unknown, err.Error())
	}

	return &api.LogDownloadURLResponse{
		Url: info.URL,
	}, nil
}

// ListLogs returns a list of taskIds for the specified workspace instance
func (ls *HeadlessLogService) ListLogs(ctx context.Context, req *api.ListLogsRequest) (resp *api.ListLogsResponse, err error) {
	da, err := ls.daFactory(&ls.cfg)
	if err != nil {
		return nil, xerrors.Errorf("cannot use configured storage: %w", err)
	}

	err = da.Init(ctx, req.OwnerId, req.WorkspaceId, req.InstanceId)
	if err != nil {
		return nil, xerrors.Errorf("cannot use configured storage: %w", err)
	}
	// we do not need to check whether the bucket exists because ListObjects() does that for us

	// all files under this prefix are headless log files, named after their respective taskId
	prefix := ls.s.InstanceObject(req.WorkspaceId, req.InstanceId, logs.UploadedHeadlessLogPathPrefix)
	objects, err := da.ListObjects(ctx, prefix)
	if err != nil {
		return nil, err
	}

	var taskIds []string
	for _, obj := range objects {
		ss := strings.Split(obj, "/")
		taskId := ss[len(ss)-1]
		taskIds = append(taskIds, taskId)
	}

	return &api.ListLogsResponse{
		TaskId: taskIds,
	}, nil
}
