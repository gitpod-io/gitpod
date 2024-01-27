// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package service

import (
	"context"

	regapi "github.com/gitpod-io/gitpod/registry-facade/api"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/pointer"

	"sigs.k8s.io/controller-runtime/pkg/client"
)

type WorkspaceImageSpecProvider struct {
	Client    client.Client
	Namespace string

	regapi.UnimplementedSpecProviderServer
}

func (is *WorkspaceImageSpecProvider) GetImageSpec(ctx context.Context, req *regapi.GetImageSpecRequest) (*regapi.GetImageSpecResponse, error) {
	var ws workspacev1.Workspace
	err := is.Client.Get(ctx, types.NamespacedName{Namespace: is.Namespace, Name: req.Id}, &ws)
	if errors.IsNotFound(err) {
		return nil, status.Errorf(codes.NotFound, "not found")
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, err.Error())
	}

	return &regapi.GetImageSpecResponse{
		Spec: &regapi.ImageSpec{
			BaseRef:       pointer.StringDeref(ws.Spec.Image.Workspace.Ref, ""),
			IdeRef:        ws.Spec.Image.IDE.Web,
			IdeLayerRef:   ws.Spec.Image.IDE.Refs,
			SupervisorRef: ws.Spec.Image.IDE.Supervisor,
		},
	}, nil
}
