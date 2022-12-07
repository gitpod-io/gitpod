// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
			`{"auth":{"owner_token":"abcsecrettokendef","total":{}},"env":[{"name":"SECRET_PASSWORD","value":"i-am-leaked-in-the-logs-yikes"},{"name":"GITHUB_TOKEN","value":"thisismyGitHubTokenDontStealIt"},{"name":"SUPER_SEKRET","value":"you.cant.see.me.or.can.you"},{"name":"GITHUB_SSH_PRIVATE_KEY","value":"super-secret-private-ssh-key-from-github"},{"name":"SHELL","value":"zsh"},{"name":"GITLAB_TOKEN","value":"abcsecrettokendef"}],"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"super-secret-password","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
			`{"auth":{"owner_token":"[redacted]","total":{}},"env":[{"name":"[redacted]","value":"[redacted]"},{"name":"[redacted]","value":"[redacted]"},{"name":"SUPER_SEKRET","value":"you.cant.see.me.or.can.you"},{"name":"[redacted]","value":"[redacted]"},{"name":"SHELL","value":"zsh"},{"name":"[redacted]","value":"[redacted]"}],"source":{"file":{"contextPath":".","dockerfilePath":".gitpod.dockerfile","dockerfileVersion":"82561e7f6455e3c0e6ee98be03c4d9aab4d459f8","source":{"git":{"checkoutLocation":"test.repo","cloneTaget":"good-workspace-image","config":{"authPassword":"[redacted]","authUser":"oauth2","authentication":"BASIC_AUTH"},"remoteUri":"https://github.com/AlexTugarev/test.repo.git","targetMode":"REMOTE_BRANCH"}}}}}`,
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
