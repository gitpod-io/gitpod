// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	agentsmith "github.com/gitpod-io/gitpod/installer/pkg/components/agent-smith"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/dashboard"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	"github.com/gitpod-io/gitpod/installer/pkg/components/gitpod"
	imagebuildermk3 "github.com/gitpod-io/gitpod/installer/pkg/components/image-builder-mk3"
	jaegeroperator "github.com/gitpod-io/gitpod/installer/pkg/components/jaeger-operator"
	"github.com/gitpod-io/gitpod/installer/pkg/components/minio"
	"github.com/gitpod-io/gitpod/installer/pkg/components/mysql"
	"github.com/gitpod-io/gitpod/installer/pkg/components/proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/rabbitmq"
	registryfacade "github.com/gitpod-io/gitpod/installer/pkg/components/registry-facade"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/ws-proxy"
	wsscheduler "github.com/gitpod-io/gitpod/installer/pkg/components/ws-scheduler"
)

var MetaObjects = common.CompositeRenderFunc(
	contentservice.Objects,
	proxy.Objects,
	dashboard.Objects,
	imagebuildermk3.Objects,
	mysql.Objects,
	rabbitmq.Objects,
	server.Objects,
	wsmanagerbridge.Objects,
)

var WorkspaceObjects = common.CompositeRenderFunc(
	agentsmith.Objects,
	gitpod.Objects,
	wsdaemon.Objects,
	wsmanager.Objects,
	wsproxy.Objects,
	wsscheduler.Objects,
	registryfacade.Objects,
)

var FullObjects = common.CompositeRenderFunc(
	dockerregistry.Objects,
	MetaObjects,
	WorkspaceObjects,
)

var MetaHelmDependencies = common.CompositeHelmFunc(
	jaegeroperator.Helm,
	mysql.Helm,
	minio.Helm,
	rabbitmq.Helm,
)

var WorkspaceHelmDependencies = common.CompositeHelmFunc()

var FullHelmDependencies = common.CompositeHelmFunc(
	dockerregistry.Helm,
	MetaHelmDependencies,
	WorkspaceHelmDependencies,
)
