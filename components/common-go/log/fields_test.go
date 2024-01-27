// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package log

import (
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestCompose(t *testing.T) {
	fields := Compose(
		WorkspaceOwner("owner"),
		WorkspaceID("workspace"),
		WorkspaceInstanceID("instance"),
		ProjectID("project"),
		OrganizationID("org"),
	)
	require.Equal(t, logrus.Fields{
		OwnerIDField:             "owner",
		OrganizationIDField:      "org",
		TeamIDField:              "org",
		ProjectIDField:           "project",
		WorkspaceInstanceIDField: "instance",
		WorkspaceIDField:         "workspace",
	}, fields)
}
