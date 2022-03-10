// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/cluster"
	componentswebapp "github.com/gitpod-io/gitpod/installer/pkg/components/components-webapp"
	componentsworkspace "github.com/gitpod-io/gitpod/installer/pkg/components/components-workspace"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	"github.com/gitpod-io/gitpod/installer/pkg/components/gitpod"
)

var WebAppObjects = common.CompositeRenderFunc(
	componentswebapp.Objects,
)

var WorkspaceObjects = common.CompositeRenderFunc(
	componentsworkspace.Objects,
)

var FullObjects = common.CompositeRenderFunc(
	WebAppObjects,
	WorkspaceObjects,
)

var WebAppHelmDependencies = common.CompositeHelmFunc(
	componentswebapp.Helm,
)

var WorkspaceHelmDependencies = common.CompositeHelmFunc(
	componentsworkspace.Helm,
)

var FullHelmDependencies = common.CompositeHelmFunc(
	WebAppHelmDependencies,
	WorkspaceHelmDependencies,
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
