// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api_test

import (
	"fmt"
	"testing"

	"github.com/gitpod-io/gitpod/registry-facade/api"
	"github.com/golang/protobuf/proto"
	"github.com/google/go-cmp/cmp"
)

func TestRefBackAndForth(t *testing.T) {
	tests := []string{
		"registry-facade/c/pmrgeyltmvpxezlgei5cezlvfztwg4ronfxs6z3joryg6zbnmrsxml3xn5zgw43qmfrwklljnvqwozlthi3wendcge3demldmuygcntghbsdoyrshe4gczdegq4dmzrrmu3wmmbwg4ztkmjwgjqtkyryge2dgylegyyggmbwgm2dqy3bmzsdkzjuej6q:latest",
		"registry-facade/c/pmrgeyltmvpxezlgei5cezlvfztwg4ronfxs6z3joryg6zbnmrsxml3xn5zgw43qmfrwklljnvqwozlthi3wendcge3demldmuygcntghbsdoyrshe4gczdegq4dmzrrmu3wmmbwg4ztkmjwgjqtkyryge2dgylegyyggmbwgm2dqy3bmzsdkzjueiwce5dimvuwcx3wmvzhg2lpnyrduitgn5xweylsfyytemzcpu:latest",
	}
	for i, test := range tests {
		t.Run(fmt.Sprintf("%003d", i), func(t *testing.T) {
			spec, err := api.ImageSpecFromRef(test)
			if err != nil {
				t.Errorf("unexpected error: %+v", err)
				return
			}

			ref, err := spec.ToRef("registry-facade")
			if err != nil {
				t.Errorf("unexpected error: %+v", err)
				return
			}
			if ref != test {
				t.Errorf("ToRef differs from original input: got \"%s\", expected \"%s\"", ref, test)
				return
			}
		})
	}
}

func TestToRef(t *testing.T) {
	tests := []struct {
		Spec        *api.ImageSpec
		Host        string
		Expectation string
		Error       string
	}{
		{&api.ImageSpec{}, "", "", "host cannot be empty"},
		{nil, "registry-facade", "registry-facade/c/nz2wy3a:latest", ""},
		{&api.ImageSpec{}, "registry-facade", "registry-facade/c/pn6q:latest", ""},
		{
			&api.ImageSpec{BaseRef: "docker.io/library/alpine:latest"},
			"registry-facade",
			"registry-facade/c/pmrgeyltmvpxezlgei5cezdpmnvwk4ronfxs63djmjzgc4tzf5qwy4djnzstu3dborsxg5bcpu:latest",
			"",
		},
		{
			&api.ImageSpec{BaseRef: "eu.gcr.io/gitpod-dev/workspace-images:7b4b1621ce0a6f8d7b298add486f1e7f06735162a5b8143ad60c06348cafd5e4"},
			"registry-facade",
			"registry-facade/c/pmrgeyltmvpxezlgei5cezlvfztwg4ronfxs6z3joryg6zbnmrsxml3xn5zgw43qmfrwklljnvqwozlthi3wendcge3demldmuygcntghbsdoyrshe4gczdegq4dmzrrmu3wmmbwg4ztkmjwgjqtkyryge2dgylegyyggmbwgm2dqy3bmzsdkzjuej6q:latest",
			"",
		},
		{
			&api.ImageSpec{
				BaseRef:      "eu.gcr.io/gitpod-dev/workspace-images:7b4b1621ce0a6f8d7b298add486f1e7f06735162a5b8143ad60c06348cafd5e4",
				TheiaVersion: "foobar.123",
			},
			"registry-facade",
			"registry-facade/c/pmrgeyltmvpxezlgei5cezlvfztwg4ronfxs6z3joryg6zbnmrsxml3xn5zgw43qmfrwklljnvqwozlthi3wendcge3demldmuygcntghbsdoyrshe4gczdegq4dmzrrmu3wmmbwg4ztkmjwgjqtkyryge2dgylegyyggmbwgm2dqy3bmzsdkzjueiwce5dimvuwcx3wmvzhg2lpnyrduitgn5xweylsfyytemzcpu:latest",
			"",
		},
		{
			&api.ImageSpec{
				BaseRef:      "eu.gcr.io/gitpod-dev/workspace-images:7b4b1621ce0a6f8d7b298add486f1e7f06735162a5b8143ad60c06348cafd5e4THISISWAYTOOLONG7b4b1621ce0a6f8d7b298add486f1e7f06735162a5b8143ad60c06348cafd5e4",
				TheiaVersion: "ThisIsAWayTooLongVersionAndWillExceedTheMaxLengthAndOneMoreTimeThisIsAWayTooLongVersionAndWillExceedTheMaxLength",
			},
			"registry-facade",
			"",
			"repository name must not be longer than 255 characters",
		},
		{
			&api.ImageSpec{
				BaseRef:      "eu.gcr.io/gitpod-dev/workspace-images:7b4b1621ce0a6f8d7b298add486f1e7f06735162a5b8143ad60c06348cafd5e4THISISWAYTOOLONG7b4b1621ce0a6f8d7b298add486f1e7f06735162a5b8143ad60c06348cafd5e4",
				TheiaVersion: "ThisIsAWayTooLongVersionAndWillExceedTheMaxLengthAndOneMoreTimeThisIsAWayTooLongVersionAndWillExceedTheMaxLength",
				ContentLayer: []*api.ContentLayer{
					&api.ContentLayer{
						Spec: &api.ContentLayer_Remote{
							Remote: &api.RemoteContentLayer{
								DiffId: "sha256:abc",
								Digest: "sha256:def",
								Url:    "https://somewhere/over/the/rainbow.tar.gz",
							},
						},
					},
				},
			},
			"registry-facade",
			"",
			"ToRef does not support content layer",
		},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("%003d", i), func(t *testing.T) {
			ref, err := test.Spec.ToRef(test.Host)
			var msg string
			if err != nil {
				msg = err.Error()
			}
			if msg != test.Error {
				t.Errorf("unexpected error: \"%s\", expected \"%s\"", msg, test.Error)
			}
			if ref != test.Expectation {
				t.Errorf("unexpected ref: \"%s\", expected \"%s\"", ref, test.Expectation)
			}
		})
	}
}

func TestImageSpecFromRef(t *testing.T) {
	tests := []struct {
		Ref         string
		Expectation *api.ImageSpec
		Error       string
	}{
		{"", nil, "cannot use empty ref"},
		{"registry-facade/c/notvalidbase32", nil, "cannot decode ref \"NOTVALIDBASE32==\": illegal base32 data at input byte 14"},
		{"registry-facade/c/pmrgs3twmfwgszckonxw4ir2bi", nil, "cannot unmarshal ref: unexpected end of JSON input"},
		{"registry-facade/c/pmrgeyltmvpxezlgei5ceztpn5rgc4rcpu:latest", &api.ImageSpec{BaseRef: "foobar"}, ""},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("%003d", i), func(t *testing.T) {
			spec, err := api.ImageSpecFromRef(test.Ref)

			var msg string
			if err != nil {
				msg = err.Error()
			}
			if msg != test.Error {
				t.Errorf("unexpected error: \"%s\", expected \"%s\"", msg, test.Error)
			}

			if diff := cmp.Diff(test.Expectation, spec); diff != "" {
				t.Errorf("unexpected spec (-want +got):\n%s", diff)
			}
		})
	}
}

func TestBase64BackAndForth(t *testing.T) {
	tests := []struct {
		Desc  string
		Input *api.ImageSpec
	}{
		{"nil spec", nil},
		{"base image only", &api.ImageSpec{BaseRef: "alpine:latest"}},
		{"theia version only", &api.ImageSpec{TheiaVersion: "master.abc"}},
		{"base image and theia", &api.ImageSpec{BaseRef: "alpine:latest", TheiaVersion: "master.2000"}},
		{"content layer", &api.ImageSpec{
			BaseRef: "something:latest",
			ContentLayer: []*api.ContentLayer{
				&api.ContentLayer{
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
