// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"net/url"
	"testing"
)

func TestRewriteNonDockerAPIURL(t *testing.T) {
	type input struct {
		u          url.URL
		fromPrefix string
		toPrefix   string
		host       string
	}
	tests := []struct {
		Name string
		in   input
		u    url.URL
	}{
		{
			Name: "toPrefix is empty",
			in: input{
				fromPrefix: "base",
				toPrefix:   "",
				host:       "europe-docker.pkg.dev",
				u: url.URL{
					Host: "localhost.com",
					Path: "/base/artifacts-uploads/namespaces/prince-tf-experiments/repositories/dazzle/uploads/somedata",
				},
			},
			u: url.URL{
				Host: "europe-docker.pkg.dev",
				Path: "/artifacts-uploads/namespaces/prince-tf-experiments/repositories/dazzle/uploads/somedata",
			},
		},
		{
			Name: "fromPrefix is empty",
			in: input{
				fromPrefix: "",
				toPrefix:   "base",
				host:       "localhost.com",
				u: url.URL{
					Host: "europe-docker.pkg.dev",
					Path: "/artifacts-uploads/namespaces/prince-tf-experiments/repositories/dazzle/uploads/somedata",
				},
			},
			u: url.URL{
				Host: "localhost.com",
				Path: "/base/artifacts-uploads/namespaces/prince-tf-experiments/repositories/dazzle/uploads/somedata",
			},
		},
		{
			Name: "fromPrefix and toPrefix are not empty",
			in: input{
				fromPrefix: "from",
				toPrefix:   "to",
				host:       "localhost.com",
				u: url.URL{
					Host: "example.com",
					Path: "/from/some/random/path",
				},
			},
			u: url.URL{
				Host: "localhost.com",
				Path: "/to/some/random/path",
			},
		},
		{
			Name: "fromPrefix and toPrefix are not empty and origin url is not start with fromPrefix",
			in: input{
				fromPrefix: "from",
				toPrefix:   "to",
				host:       "localhost.com",
				u: url.URL{
					Host: "example.com",
					Path: "/other-string/some/random/path",
				},
			},
			u: url.URL{
				Host: "localhost.com",
				Path: "/to/other-string/some/random/path",
			},
		},
		{
			Name: "fromPrefix and toPrefix are empty",
			in: input{
				fromPrefix: "",
				toPrefix:   "",
				host:       "localhost.com",
				u: url.URL{
					Host: "example.com",
					Path: "/some/random/path",
				},
			},
			u: url.URL{
				Host: "localhost.com",
				Path: "/some/random/path",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			rewriteNonDockerAPIURL(&test.in.u, test.in.fromPrefix, test.in.toPrefix, test.in.host)
			if test.in.u.Path != test.u.Path {
				t.Errorf("expected path: %s but got %s", test.u.Path, test.in.u.Path)
			}
			if test.in.u.Host != test.u.Host {
				t.Errorf("expected Host: %s but got %s", test.u.Host, test.in.u.Host)
			}
			if test.in.u.RawPath != test.u.RawPath {
				t.Errorf("expected RawPath: %s but got %s", test.u.RawPath, test.in.u.RawPath)
			}
		})
	}

}

func TestRewriteDockerAPIURL(t *testing.T) {
	type input struct {
		u        url.URL
		fromRepo string
		toRepo   string
		host     string
		tag      string
	}
	tests := []struct {
		Name string
		in   input
		u    url.URL
	}{
		{
			Name: "remote to localhost",
			in: input{
				fromRepo: "base-images",
				toRepo:   "base",
				host:     "localhost.com",
				tag:      "",
				u: url.URL{
					Host: "prince.azurecr.io",
					Path: "/v2/base-images/some/random/path",
				},
			},
			u: url.URL{
				Host: "localhost.com",
				Path: "/v2/base/some/random/path",
			},
		},
		{
			Name: "remote to localhost without repo",
			in: input{
				fromRepo: "base-images",
				toRepo:   "base",
				host:     "localhost.com",
				tag:      "",
				u: url.URL{
					Host: "prince.azurecr.io",
					Path: "/v2/other-string/some/random/path",
				},
			},
			u: url.URL{
				Host: "localhost.com",
				Path: "/v2/base/v2/other-string/some/random/path",
			},
		},
		{
			Name: "localhost to remote",
			in: input{
				fromRepo: "base",
				toRepo:   "base-images",
				host:     "prince.azurecr.io",
				tag:      "",
				u: url.URL{
					Host: "localhost.com",
					Path: "/v2/base/some/random/path",
				},
			},
			u: url.URL{
				Host: "prince.azurecr.io",
				Path: "/v2/base-images/some/random/path",
			},
		},
		{
			Name: "manifest reference update with tag",
			in: input{
				fromRepo: "base",
				toRepo:   "base-images",
				host:     "prince.azurecr.io",
				tag:      "tag12345",
				u: url.URL{
					Host: "localhost.com",
					Path: "/v2/base/uploads/manifests/manifest12345",
				},
			},
			u: url.URL{
				Host: "prince.azurecr.io",
				Path: "/v2/base-images/uploads/manifests/tag12345",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			rewriteDockerAPIURL(&test.in.u, test.in.fromRepo, test.in.toRepo, test.in.host, test.in.tag)
			if test.in.u.Path != test.u.Path {
				t.Errorf("expected path: %s but got %s", test.u.Path, test.in.u.Path)
			}
			if test.in.u.Host != test.u.Host {
				t.Errorf("expected Host: %s but got %s", test.u.Host, test.in.u.Host)
			}
			if test.in.u.RawPath != test.u.RawPath {
				t.Errorf("expected RawPath: %s but got %s", test.u.RawPath, test.in.u.RawPath)
			}
		})
	}

}
