// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
)

func NewPrebuildService() *PrebuildService {
	return &PrebuildService{
		UnimplementedPrebuildsServiceServer: &v1.UnimplementedPrebuildsServiceServer{},
	}
}

type PrebuildService struct {
	*v1.UnimplementedPrebuildsServiceServer
}

func (p *PrebuildService) GetPrebuild(ctx context.Context, req *v1.GetPrebuildRequest) (*v1.GetPrebuildResponse, error) {
	return &v1.GetPrebuildResponse{
		ResponseStatus: nil,
		Prebuild: &v1.Prebuild{
			PrebuildId: req.GetPrebuildId(),
			Spec: &v1.PrebuildSpec{
				Context: &v1.WorkspaceContext{
					ContextUrl: "https://github.com/gitpod-io/gitpod",
					Details:    nil,
				},
				Incremental: true,
			},
			Status: nil,
		},
	}, nil
}
