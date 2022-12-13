// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config/v2/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v2/ide"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v2/webapp"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v2/workspace"
)

type Config struct {
	common.Config
	IDE       ide.Config
	WebApp    webapp.Config
	Workspace workspace.Config
}
