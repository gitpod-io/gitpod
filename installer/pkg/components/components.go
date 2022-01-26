// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/cluster"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	"github.com/gitpod-io/gitpod/installer/pkg/components/gitpod"
	"github.com/gitpod-io/gitpod/installer/pkg/components/ide"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
)

var FullObjects = common.CompositeRenderFunc(
	webapp.Objects,
	ide.Objects,
	workspace.Objects,
)

var FullHelmDependencies = common.CompositeHelmFunc(
	webapp.HelmDependencies,
	ide.HelmDependencies,
	workspace.HelmDependencies,
)

// Anything in the "common" section are included in all installation types

var CommonObjects = common.CompositeRenderFunc(
	dockerregistry.Objects,
	cluster.Objects,
	gitpod.Objects,
)

var CommonHelmDependencies = common.CompositeHelmFunc(
	dockerregistry.Helm,
)
