// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbtest

import (
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"testing"
)

func NewWorkspace(t *testing.T, id string) db.Workspace {
	t.Helper()

	return db.Workspace{
		ID:         id,
		OwnerID:    uuid.New(),
		Type:       "prebuild",
		ContextURL: "https://github.com/gitpod-io/gitpod",
		Context:    []byte(`{"title":"[usage] List workspaces for each workspace instance in usage period","repository":{"cloneUrl":"https://github.com/gitpod-io/gitpod.git","host":"github.com","name":"gitpod","owner":"gitpod-io","private":false},"ref":"mp/usage-list-workspaces","refType":"branch","revision":"586f22ecaeeb3b4796fd92f9ae1ca3512ca1e330","nr":10495,"base":{"repository":{"cloneUrl":"https://github.com/gitpod-io/gitpod.git","host":"github.com","name":"gitpod","owner":"gitpod-io","private":false},"ref":"mp/usage-validate-instances","refType":"branch"},"normalizedContextURL":"https://github.com/gitpod-io/gitpod/pull/10495","checkoutLocation":"gitpod"}`),
		Config:     []byte(`{"image":"eu.gcr.io/gitpod-core-dev/dev/dev-environment:me-me-image.1","workspaceLocation":"gitpod/gitpod-ws.code-workspace","checkoutLocation":"gitpod","ports":[{"port":1337,"onOpen":"open-preview"},{"port":3000,"onOpen":"ignore"},{"port":3001,"onOpen":"ignore"},{"port":3306,"onOpen":"ignore"},{"port":4000,"onOpen":"ignore"},{"port":5900,"onOpen":"ignore"},{"port":6080,"onOpen":"ignore"},{"port":7777,"onOpen":"ignore"},{"port":9229,"onOpen":"ignore"},{"port":9999,"onOpen":"ignore"},{"port":13001,"onOpen":"ignore"},{"port":13444}],"tasks":[{"name":"Install Preview Environment kube-context","command":"(cd dev/preview/previewctl && go install .)\npreviewctl install-context\nexit\n"},{"name":"Add Harvester kubeconfig","command":"./dev/preview/util/download-and-merge-harvester-kubeconfig.sh\nexit 0\n"},{"name":"Java","command":"if [ -z \"$RUN_GRADLE_TASK\" ]; then\n  read -r -p \"Press enter to continue Java gradle task\"\nfi\nleeway exec --package components/supervisor-api/java:lib --package components/gitpod-protocol/java:lib -- ./gradlew --build-cache build\nleeway exec --package components/ide/jetbrains/backend-plugin:plugin --package components/ide/jetbrains/gateway-plugin:publish --parallel -- ./gradlew --build-cache buildPlugin\n"},{"name":"TypeScript","before":"scripts/branch-namespace.sh","init":"yarn --network-timeout 100000 && yarn build"},{"name":"Go","before":"pre-commit install --install-hooks","init":"leeway exec --filter-type go -v -- go mod verify","openMode":"split-right"}],"vscode":{"extensions":["bradlc.vscode-tailwindcss","EditorConfig.EditorConfig","golang.go","hashicorp.terraform","ms-azuretools.vscode-docker","ms-kubernetes-tools.vscode-kubernetes-tools","stkb.rewrap","zxh404.vscode-proto3","matthewpi.caddyfile-support","heptio.jsonnet","timonwong.shellcheck","vscjava.vscode-java-pack","fwcd.kotlin","dbaeumer.vscode-eslint","esbenp.prettier-vscode"]},"jetbrains":{"goland":{"prebuilds":{"version":"stable"}}},"_origin":"repo","_featureFlags":[]}`),
	}
}
