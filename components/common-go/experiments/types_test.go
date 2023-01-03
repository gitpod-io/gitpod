// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNewClient_WithoutEnvSet(t *testing.T) {
	client := NewClient()
	require.IsType(t, &alwaysReturningDefaultValueClient{}, client)
}

func TestNewClient_WithConfigcatEnvSet(t *testing.T) {
	t.Setenv("CONFIGCAT_SDK_KEY", "foo-bar")
	client := NewClient()
	require.IsType(t, &configCatClient{}, client)
}
