// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/stretchr/testify/require"
)

func TestPrebuildService_GetPrebuild(t *testing.T) {
	svc := NewPrebuildService()

	prebuildID := "some-prebuild-id"
	resp, err := svc.GetPrebuild(context.Background(), connect.NewRequest(&v1.GetPrebuildRequest{
		PrebuildId: prebuildID,
	}))
	require.NoError(t, err)
	require.Equal(t, &v1.GetPrebuildResponse{
		Prebuild: &v1.Prebuild{
			PrebuildId: prebuildID,
			Spec: &v1.PrebuildSpec{
				Context: &v1.WorkspaceContext{
					ContextUrl: "https://github.com/gitpod-io/gitpod",
					Details:    nil,
				},
				Incremental: true,
			},
			Status: nil,
		},
	}, resp.Msg)

}
