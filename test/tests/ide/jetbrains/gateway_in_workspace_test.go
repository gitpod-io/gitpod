// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"testing"
	"time"
)

type testLogWriter struct {
	t *testing.T
}

var _ io.Writer = &testLogWriter{}

func (t *testLogWriter) Write(p []byte) (n int, err error) {
	t.t.Log(string(p))
	return len(p), nil
}

const localDebug = false

func testWithoutGithubAction(ctx context.Context, t *testing.T, gatewayLink, gitpodAccessToken, secretEndpoint string, useLatest bool) error {
	if localDebug {
		fmt.Printf("========env========\nDon't forget to set workspace timeout after access\nexport GATEWAY_LINK=%s\nexport GITPOD_TEST_ACCESSTOKEN=%s\nexport WS_ENDPOINT=%s\n", gatewayLink, gitpodAccessToken, secretEndpoint)
		time.Sleep(3 * time.Hour)
		return nil
	}
	cmdEnv := os.Environ()
	cmdEnv = append(cmdEnv, "GATEWAY_LINK="+gatewayLink)
	cmdEnv = append(cmdEnv, "GITPOD_TEST_ACCESSTOKEN="+gitpodAccessToken)
	cmdEnv = append(cmdEnv, "WS_ENDPOINT="+secretEndpoint)

	scriptName := "dev/jetbrains-test:test-stable"
	if useLatest {
		scriptName = "dev/jetbrains-test:test-latest"
	}
	cmd := exec.CommandContext(ctx, "leeway", "run", scriptName, "-Dversion=integration-test", "-DpublishToJBMarketplace=false")
	cmd.Env = cmdEnv
	// writer := &testLogWriter{t: t}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stdout
	return cmd.Run()
}
