// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/gitpod-io/gitpod/public-api/v1/v1connect"
)

func NewPrebuildService() *PrebuildService {
	return &PrebuildService{}
}

type PrebuildService struct {
	v1connect.UnimplementedPrebuildsServiceHandler
}

func (p *PrebuildService) GetPrebuild(ctx context.Context, req *connect.Request[v1.GetPrebuildRequest]) (*connect.Response[v1.GetPrebuildResponse], error) {
	return connect.NewResponse(&v1.GetPrebuildResponse{
		Prebuild: &v1.Prebuild{
			PrebuildId: req.Msg.GetPrebuildId(),
			Spec: &v1.PrebuildSpec{
				Context: &v1.WorkspaceContext{
					ContextUrl: "https://github.com/gitpod-io/gitpod",
					Details:    nil,
				},
				Incremental: true,
			},
			Status: nil,
		},
	}), nil
}
