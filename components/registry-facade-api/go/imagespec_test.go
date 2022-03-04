// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api_test

import (
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/gitpod-io/gitpod/registry-facade/api"
)

func TestBase64BackAndForth(t *testing.T) {
	tests := []struct {
		Desc  string
		Input *api.ImageSpec
	}{
		{"nil spec", nil},
		{"base image only", &api.ImageSpec{BaseRef: "alpine:latest"}},
		{"theia version only", &api.ImageSpec{IdeRef: "master.abc"}},
		{"base image and theia", &api.ImageSpec{BaseRef: "alpine:latest", IdeRef: "master.2000"}},
		{"content layer", &api.ImageSpec{
			BaseRef: "something:latest",
			ContentLayer: []*api.ContentLayer{
				{
					Spec: &api.ContentLayer_Remote{
						Remote: &api.RemoteContentLayer{
							DiffId: "sha256:abc",
							Digest: "sha256:def",
							Url:    "https://soomewhere.over/the/rainbow",
						},
					},
				},
			},
		}},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			enc, err := test.Input.ToBase64()
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			spec, err := api.ImageSpecFromBase64(enc)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if !proto.Equal(spec, test.Input) {
				t.Errorf("unexpected spec: expected \"%+q\", got \"%+q\"", test.Input, spec)
			}
		})
	}
}
