// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package analytics

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type mockHandler struct{}

func (m mockHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) error {
	w.Write([]byte("mock handler response"))
	return nil
}

func TestServeHTTP(t *testing.T) {
	tests := []struct {
		name                       string
		trustedSegmentKey          string
		untrustedSegmentKey        string
		providedSegmentKey         string
		expectedResponseBodyPrefix string
	}{
		{
			name:                       "trusted segment key",
			trustedSegmentKey:          "trusted-key",
			untrustedSegmentKey:        "untrusted-key",
			providedSegmentKey:         "trusted-key",
			expectedResponseBodyPrefix: "trusted",
		},
		{
			name:                       "untrusted dummy segment key",
			trustedSegmentKey:          "trusted-key",
			untrustedSegmentKey:        "untrusted-key",
			providedSegmentKey:         dummyUntrustedSegmentKey,
			expectedResponseBodyPrefix: "untrusted",
		},
		{
			name:                "untrusted segment key",
			trustedSegmentKey:   "trusted-key",
			untrustedSegmentKey: "untrusted-key",
			providedSegmentKey:  "untrusted-key",
			// on purpose to ensure that cliens remove references to untrusted keys
			expectedResponseBodyPrefix: "mock",
		},
		{
			name:                       "empty segment key",
			trustedSegmentKey:          "trusted-key",
			untrustedSegmentKey:        "untrusted-key",
			providedSegmentKey:         "",
			expectedResponseBodyPrefix: "untrusted",
		},
		{
			name:                       "no match",
			trustedSegmentKey:          "trusted-key",
			untrustedSegmentKey:        "untrusted-key",
			providedSegmentKey:         "other-key",
			expectedResponseBodyPrefix: "mock",
		},
		{
			name:                       "both keys empty",
			trustedSegmentKey:          "",
			untrustedSegmentKey:        "",
			providedSegmentKey:         "",
			expectedResponseBodyPrefix: "mock",
		},
		{
			name:                       "only trusted key empty",
			trustedSegmentKey:          "",
			untrustedSegmentKey:        "untrusted-key",
			providedSegmentKey:         dummyUntrustedSegmentKey,
			expectedResponseBodyPrefix: "untrusted",
		},
		{
			name:                       "only untrusted key empty",
			trustedSegmentKey:          "trusted-key",
			untrustedSegmentKey:        "",
			providedSegmentKey:         "",
			expectedResponseBodyPrefix: "mock",
		},
		{
			name:                       "both keys empty, provided key not empty",
			trustedSegmentKey:          "",
			untrustedSegmentKey:        "",
			providedSegmentKey:         "other-key",
			expectedResponseBodyPrefix: "mock",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &Analytics{
				trustedSegmentKey:   tt.trustedSegmentKey,
				untrustedSegmentKey: tt.untrustedSegmentKey,
				// Configure segmentProxy to return different responses for trusted and untrusted.
				segmentProxy: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Header.Get("Authorization") == "Basic "+base64.StdEncoding.EncodeToString([]byte(tt.trustedSegmentKey+":")) {
						w.Write([]byte("trusted proxy response"))
					} else {
						w.Write([]byte("untrusted proxy response"))
					}
				}),
			}

			req := httptest.NewRequest(http.MethodGet, "http://example.com", nil)
			if tt.providedSegmentKey != "" {
				req.SetBasicAuth(tt.providedSegmentKey, "")
			}
			rec := httptest.NewRecorder()

			err := a.ServeHTTP(rec, req, mockHandler{})

			if err != nil {
				t.Errorf("ServeHTTP() failed with error: %v", err)
			}
			if rec.Code != http.StatusOK {
				t.Errorf("ServeHTTP() returned status %d, expected %d", rec.Code, http.StatusOK)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedResponseBodyPrefix) {
				t.Errorf("ServeHTTP() response body doesn't contain expected prefix. Got: %s, expected prefix: %s", rec.Body.String(), tt.expectedResponseBodyPrefix)
			}
		})
	}
}
