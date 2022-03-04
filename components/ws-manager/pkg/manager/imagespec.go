// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/base64"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
)

// GetImageSpec provides the image spec for a particular workspace (instance) ID.
func (m *Manager) GetImageSpec(ctx context.Context, req *regapi.GetImageSpecRequest) (resp *regapi.GetImageSpecResponse, err error) {
	pod, err := m.findWorkspacePod(ctx, req.Id)
	if isKubernetesObjNotFoundError(err) {
		return nil, status.Error(codes.NotFound, "not found")
	}

	var (
		span        opentracing.Span
		traceID, ok = pod.Annotations[wsk8s.TraceIDAnnotation]
	)
	if ok {
		spanCtx := tracing.FromTraceID(traceID)
		span = opentracing.StartSpan("GetImageSpec", opentracing.FollowsFrom(spanCtx))
		ctx = opentracing.ContextWithSpan(ctx, span)
	} else {
		span, ctx = tracing.FromContext(ctx, "GetImageSpec")
	}
	tracing.ApplyOWI(span, wsk8s.GetOWIFromObject(&pod.ObjectMeta))
	defer func() {
		tracing.LogMessageSafe(span, "resp", resp)
		tracing.FinishSpan(span, &err)
	}()

	ispec, ok := pod.Annotations[kubernetes.WorkspaceImageSpecAnnotation]
	if !ok {
		return nil, status.Error(codes.FailedPrecondition, "workspace has no image spec")
	}
	spec, err := regapi.ImageSpecFromBase64(ispec)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	if _, ok := pod.Labels[fullWorkspaceBackupAnnotation]; ok {
		owner := pod.Labels[wsk8s.OwnerLabel]
		workspaceID := pod.Labels[wsk8s.MetaIDLabel]
		initializerRaw, ok := pod.Annotations[workspaceInitializerAnnotation]
		if !ok {
			return nil, xerrors.Errorf("pod %s has no %s annotation", pod.Name, workspaceInitializerAnnotation)
		}
		initializerPB, err := base64.StdEncoding.DecodeString(initializerRaw)
		if err != nil {
			return nil, xerrors.Errorf("cannot decode init config: %w", err)
		}
		var initializer csapi.WorkspaceInitializer
		err = proto.Unmarshal(initializerPB, &initializer)
		if err != nil {
			return nil, xerrors.Errorf("cannot unmarshal init config: %w", err)
		}
		cl, _, err := m.Content.GetContentLayer(ctx, owner, workspaceID, &initializer)
		if err != nil {
			return nil, xerrors.Errorf("cannot get content layer: %w", err)
		}

		contentLayer := make([]*regapi.ContentLayer, len(cl))
		for i, l := range cl {
			if len(l.Content) > 0 {
				contentLayer[i] = &regapi.ContentLayer{
					Spec: &regapi.ContentLayer_Direct{
						Direct: &regapi.DirectContentLayer{
							Content: l.Content,
						},
					},
				}
				continue
			}

			diffID := l.DiffID
			contentLayer[i] = &regapi.ContentLayer{
				Spec: &regapi.ContentLayer_Remote{
					Remote: &regapi.RemoteContentLayer{
						DiffId:    diffID,
						Digest:    l.Digest,
						MediaType: string(l.MediaType),
						Url:       l.URL,
						Size:      l.Size,
					},
				},
			}
		}
		spec.ContentLayer = contentLayer
	}

	return &regapi.GetImageSpecResponse{
		Spec: spec,
	}, nil
}
