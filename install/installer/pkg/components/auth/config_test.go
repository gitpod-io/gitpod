// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"testing"

	server_lib "github.com/gitpod-io/gitpod/server/go/pkg/lib"
)

func TestCookieNameFromDomain(t *testing.T) {
	tests := []struct {
		name            string
		domain          string
		expectedOutcome string
	}{
		{
			name:            "Simple Domain",
			domain:          "example.com",
			expectedOutcome: "_example_com_jwt2_",
		},
		{
			name:            "Domain with Underscore",
			domain:          "example_test.com",
			expectedOutcome: "_example_test_com_jwt2_",
		},
		{
			name:            "Domain with Hyphen",
			domain:          "example-test.com",
			expectedOutcome: "_example_test_com_jwt2_",
		},
		{
			name:            "Domain with Special Characters",
			domain:          "example&test.com",
			expectedOutcome: "_example_test_com_jwt2_",
		},
		{
			name:            "Subdomain",
			domain:          "subdomain.example.com",
			expectedOutcome: "_subdomain_example_com_jwt2_",
		},
		{
			name:            "Subdomain with Hyphen",
			domain:          "sub-domain.example.com",
			expectedOutcome: "_sub_domain_example_com_jwt2_",
		},
		{
			name:            "Subdomain with Underscore",
			domain:          "sub_domain.example.com",
			expectedOutcome: "_sub_domain_example_com_jwt2_",
		},
		{
			name:            "Subdomain with Special Characters",
			domain:          "sub&domain.example.com",
			expectedOutcome: "_sub_domain_example_com_jwt2_",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := server_lib.CookieNameFromDomain(tt.domain)
			if actual != tt.expectedOutcome {
				t.Errorf("expected %q, got %q", tt.expectedOutcome, actual)
			}
		})
	}
}
