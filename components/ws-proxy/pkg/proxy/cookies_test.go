// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
)

// TestReadCookies gives more confidence that our clone&own version of readCookies produces
// at least a subset of what the stdlib version provides.
func TestReadCookies(t *testing.T) {
	var (
		domain         = "test-domain.com"
		sessionCookie  = &http.Cookie{Domain: domain, Name: "_test_domain_com_", Value: "fobar"}
		portAuthCookie = &http.Cookie{Domain: domain, Name: "_test_domain_com_ws_77f6b236_3456_4b88_8284_81ca543a9d65_port_auth_", Value: "some-token"}
		ownerCookie    = &http.Cookie{Domain: domain, Name: "_test_domain_com_ws_77f6b236_3456_4b88_8284_81ca543a9d65_owner_", Value: "some-other-token"}
		miscCookie     = &http.Cookie{Domain: domain, Name: "some-other-cookie", Value: "I like cookies"}
	)
	tests := []struct {
		Name  string
		Input []*http.Cookie
	}{
		{"no cookies", []*http.Cookie{}},
		{"session cookie", []*http.Cookie{sessionCookie, miscCookie}},
		{"portAuth cookie", []*http.Cookie{portAuthCookie, miscCookie}},
		{"owner cookie", []*http.Cookie{ownerCookie, miscCookie}},
		{"misc cookie", []*http.Cookie{miscCookie}},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://"+domain, nil)
			for _, c := range test.Input {
				req.AddCookie(c)
			}

			us := readCookies(req.Header, "")
			them := req.Cookies()

			if diff := cmp.Diff(them, us); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
