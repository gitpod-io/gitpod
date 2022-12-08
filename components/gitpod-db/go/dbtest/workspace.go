// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dbtest

import (
	"database/sql"

	"github.com/gitpod-io/gitpod/common-go/namegen"

	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	WorkspaceContext = `{"title":"[usage] List workspaces for each workspace instance in usage period","repository":{"cloneUrl":"https://github.com/gitpod-io/gitpod.git","host":"github.com","name":"gitpod","owner":"gitpod-io","private":false},"ref":"mp/usage-list-workspaces","refType":"branch","revision":"586f22ecaeeb3b4796fd92f9ae1ca3512ca1e330","nr":10495,"base":{"repository":{"cloneUrl":"https://github.com/gitpod-io/gitpod.git","host":"github.com","name":"gitpod","owner":"gitpod-io","private":false},"ref":"mp/usage-validate-instances","refType":"branch"},"normalizedContextURL":"https://github.com/gitpod-io/gitpod/pull/10495","checkoutLocation":"gitpod"}`
	WorkspaceConfig  = `{"image":"eu.gcr.io/gitpod-core-dev/dev/dev-environment:me-me-image.1","workspaceLocation":"gitpod/gitpod-ws.code-workspace","checkoutLocation":"gitpod","ports":[{"port":1337,"onOpen":"open-preview"},{"port":3000,"onOpen":"ignore"},{"port":3001,"onOpen":"ignore"},{"port":3306,"onOpen":"ignore"},{"port":4000,"onOpen":"ignore"},{"port":5900,"onOpen":"ignore"},{"port":6080,"onOpen":"ignore"},{"port":7777,"onOpen":"ignore"},{"port":9229,"onOpen":"ignore"},{"port":9999,"onOpen":"ignore"},{"port":13001,"onOpen":"ignore"},{"port":13444}],"tasks":[{"name":"Install Preview Environment kube-context","command":"(cd dev/preview/previewctl && go install .)\npreviewctl install-context\nexit\n"},{"name":"Add Harvester kubeconfig","command":"./dev/preview/util/download-and-merge-harvester-kubeconfig.sh\nexit 0\n"},{"name":"Java","command":"if [ -z \"$RUN_GRADLE_TASK\" ]; then\n  read -r -p \"Press enter to continue Java gradle task\"\nfi\nleeway exec --package components/supervisor-api/java:lib --package components/gitpod-protocol/java:lib -- ./gradlew --build-cache build\nleeway exec --package components/ide/jetbrains/backend-plugin:plugin --package components/ide/jetbrains/gateway-plugin:publish --parallel -- ./gradlew --build-cache buildPlugin\n"},{"name":"TypeScript","before":"scripts/branch-namespace.sh","init":"yarn --network-timeout 100000 && yarn build"},{"name":"Go","before":"pre-commit install --install-hooks","init":"leeway exec --filter-type go -v -- go mod verify","openMode":"split-right"}],"vscode":{"extensions":["bradlc.vscode-tailwindcss","EditorConfig.EditorConfig","golang.go","hashicorp.terraform","ms-azuretools.vscode-docker","ms-kubernetes-tools.vscode-kubernetes-tools","stkb.rewrap","zxh404.vscode-proto3","matthewpi.caddyfile-support","heptio.jsonnet","timonwong.shellcheck","vscjava.vscode-java-pack","fwcd.kotlin","dbaeumer.vscode-eslint","esbenp.prettier-vscode"]},"jetbrains":{"goland":{"prebuilds":{"version":"stable"}}},"_origin":"repo","_featureFlags":[]}`
)

// NewWorkspace creates a new stub workspace with default values, unless these are set on the workspace argument
// Records are not stored, use `Create(dbtest.NewWorkspace(t, Workspace{})) to store it.
// Only used for tests. Additional default properties may be added in the future.
func NewWorkspace(t *testing.T, workspace db.Workspace) db.Workspace {
	t.Helper()

	id := GenerateWorkspaceID()
	if workspace.ID != "" {
		id = workspace.ID
	}

	ownerID := uuid.New()
	if workspace.OwnerID.ID() != 0 { // empty value
		ownerID = workspace.OwnerID
	}

	projectID := sql.NullString{
		String: "",
		Valid:  false,
	}
	if workspace.ProjectID.Valid {
		projectID = workspace.ProjectID
	}

	workspaceType := db.WorkspaceType_Regular
	if workspace.Type != "" {
		workspaceType = workspace.Type
	}

	contextURL := "https://github.com/gitpod-io/gitpod"
	if workspace.ContextURL != "" {
		contextURL = workspace.ContextURL
	}

	context := []byte(WorkspaceContext)
	if workspace.Context.String() != "" {
		context = workspace.Context
	}

	config := []byte(WorkspaceConfig)
	if workspace.Config.String() != "" {
		config = workspace.Config
	}

	return db.Workspace{
		ID:         id,
		OwnerID:    ownerID,
		Type:       workspaceType,
		ProjectID:  projectID,
		ContextURL: contextURL,
		Context:    context,
		Config:     config,
	}
}

func GenerateWorkspaceID() string {
	id, _ := namegen.GenerateWorkspaceID()
	return id
}

func CreateWorkspaces(t *testing.T, conn *gorm.DB, workspaces ...db.Workspace) []db.Workspace {
	t.Helper()

	var records []db.Workspace
	var ids []string
	for _, w := range workspaces {
		record := NewWorkspace(t, w)
		records = append(records, record)
		ids = append(ids, record.ID)
	}

	require.NoError(t, conn.CreateInBatches(&records, 1000).Error)

	t.Cleanup(func() {
		require.NoError(t, conn.Where(ids).Delete(&db.Workspace{}).Error)
	})

	return records
}
