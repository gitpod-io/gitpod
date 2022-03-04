// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"os"
	"testing"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"sigs.k8s.io/e2e-framework/pkg/env"
)

var (
	testEnv     env.Environment
	username    string
	namespace   string
	kubeconfig  string
	annotations map[string]string
)

func TestMain(m *testing.M) {
	b, _ := ioutil.ReadFile("context.json")
	json.Unmarshal(b, &annotations)
	username, namespace, testEnv, _, kubeconfig, _ = integration.Setup(context.Background())
	os.Exit(testEnv.Run(m))
}
