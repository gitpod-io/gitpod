// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package refresh_credential

import "testing"

func TestIsAWSECRPrivateRegistry(t *testing.T) {
	tests := []struct {
		URL    string
		Expect bool
	}{
		{
			URL:    "012345678969.dkr.ecr.us-west-1.amazonaws.com",
			Expect: true,
		},
		{
			URL:    "012345678969.dkr.ecr.us-west-1.amazonaws.com/",
			Expect: true,
		},
		{
			URL:    "012345678969.dkr.ecr.us-west-1.amazonaws.com/build",
			Expect: true,
		},
		{
			URL:    "https://012345678969.dkr.ecr.us-west-1.amazonaws.com/build/foo/bar",
			Expect: true,
		},
		{
			URL:    "public.ecr.aws",
			Expect: true,
		},
		{
			URL:    "public.ecr.aws/",
			Expect: true,
		},
		{
			URL:    "public.ecr.aws/build",
			Expect: true,
		},
		{
			URL:    "https://public.ecr.aws/build/foo/bar",
			Expect: true,
		},
		{
			URL:    "gitpod.io",
			Expect: false,
		},
	}

	for _, test := range tests {
		t.Run(test.URL, func(t *testing.T) {
			got := isAWSECRURL(test.URL)
			if got != test.Expect {
				t.Errorf("expect url %t, got %t", test.Expect, got)
			}
		})
	}
}

func TestGetAWSRegion(t *testing.T) {
	tests := []struct {
		URL    string
		Expect string
	}{
		{
			URL:    "012345678969.dkr.ecr.us-west-1.amazonaws.com",
			Expect: "us-west-1",
		},
		{
			URL:    "https://012345678969.dkr.ecr.us-west-1.amazonaws.com",
			Expect: "us-west-1",
		},
		{
			URL:    "012345678969.dkr.ecr.us-west-1.amazonaws.com/build",
			Expect: "us-west-1",
		},
		{
			URL:    "https://012345678969.dkr.ecr.us-west-1.amazonaws.com/build/foo/bar",
			Expect: "us-west-1",
		},
		{
			URL:    "public.ecr.aws",
			Expect: "us-east-1",
		},
		{
			URL:    "public.ecr.aws/",
			Expect: "us-east-1",
		},
		{
			URL:    "public.ecr.aws/build",
			Expect: "us-east-1",
		},
		{
			URL:    "https://public.ecr.aws/build/foo/bar",
			Expect: "us-east-1",
		},
		{
			URL:    "gitpod.io",
			Expect: "",
		},
	}

	for _, test := range tests {
		t.Run(test.URL, func(t *testing.T) {
			got := getAWSRegion(test.URL)
			if got != test.Expect {
				t.Errorf("expect url %s, got %s", test.Expect, got)
			}
		})
	}
}
