// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:generate mockgen -package mock github.com/gitpod-io/gitpod/registry-facade/pkg/registry LayerSource > pkg/registry/mock/layersource_mock.go

package registry_test

import (
	"context"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/opencontainers/go-digest"

	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry"
	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry/mock"
)

func TestRevisioingLayerSource(t *testing.T) {
	tests := []struct {
		Name string
		Run  func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource)
	}{
		{
			Name: "hasBlob",
			Run: func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource) {
				s0.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).MinTimes(2)
				rev.HasBlob(context.Background(), nil, digest.FromString(""))

				rev.Update(s1)
				s1.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(true)
				if !rev.HasBlob(context.Background(), nil, digest.FromString("")) {
					t.Error("expected hasBlob == true")
				}

				s1.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(false)
				rev.HasBlob(context.Background(), nil, digest.FromString(""))
			},
		},
		{
			Name: "getBlob active !hasBlob",
			Run: func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource) {
				s0.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(false).MinTimes(1)
				rev.GetBlob(context.Background(), nil, digest.FromString(""))
			},
		},
		{
			Name: "getBlob active hasBlob",
			Run: func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource) {
				s0.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(true).MinTimes(1)
				s0.EXPECT().GetBlob(gomock.Any(), gomock.Any(), gomock.Any()).MinTimes(1)
				rev.GetBlob(context.Background(), nil, digest.FromString(""))
			},
		},
		{
			Name: "getBlob new active hasBlob",
			Run: func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource) {
				s1.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(true).MinTimes(1)
				s1.EXPECT().GetBlob(gomock.Any(), gomock.Any(), gomock.Any()).MinTimes(1)

				rev.Update(s1)
				rev.GetBlob(context.Background(), nil, digest.FromString(""))
			},
		},
		{
			Name: "getBlob new active !hasBlob",
			Run: func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource) {
				s0.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(true).MinTimes(1)
				s0.EXPECT().GetBlob(gomock.Any(), gomock.Any(), gomock.Any()).MinTimes(1)
				s1.EXPECT().HasBlob(gomock.Any(), gomock.Any(), gomock.Any()).Return(false).MinTimes(1)

				rev.Update(s1)
				rev.GetBlob(context.Background(), nil, digest.FromString(""))
			},
		},
		{
			Name: "active only",
			Run: func(rev *registry.RevisioningLayerSource, s0, s1, s2 *mock.MockLayerSource) {
				s1.EXPECT().Envs(gomock.Any(), gomock.Any()).MinTimes(1)
				s1.EXPECT().GetLayer(gomock.Any(), gomock.Any()).MinTimes(1)

				rev.Update(s1)
				rev.GetLayer(context.Background(), nil)
				rev.Envs(context.Background(), nil)
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			s0 := mock.NewMockLayerSource(ctrl)
			s1 := mock.NewMockLayerSource(ctrl)
			s2 := mock.NewMockLayerSource(ctrl)
			rev := registry.NewRevisioningLayerSource(s0)

			test.Run(rev, s0, s1, s2)
		})
	}
}
