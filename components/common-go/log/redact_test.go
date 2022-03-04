// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"testing"
)

func TestRedactJSON(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation string
	}{
		{
			`{"auth":{"total":{}},"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"super-secret-password","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
			`{"auth":{"total":{}},"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"[redacted]","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
		},
	}

	for i, test := range tests {
		res, err := RedactJSON([]byte(test.Input))
		if err != nil {
			t.Errorf("test %d failed: %v", i, err)
			continue
		}

		if string(res) != test.Expectation {
			exp := []byte(test.Expectation)
			for ic, ec := range exp {
				if ec != res[ic] {
					t.Errorf("test %d did not match expectation. Differs in character %d. Got >> %s <<", i, ic, string(res))
					break
				}
			}
		}
	}
}
