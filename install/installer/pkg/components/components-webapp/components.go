// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package componentswebapp

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/blobserve"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/dashboard"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database"
	ide_metrics "github.com/gitpod-io/gitpod/installer/pkg/components/ide-metrics"
	ide_proxy "github.com/gitpod-io/gitpod/installer/pkg/components/ide-proxy"
	ide_service "github.com/gitpod-io/gitpod/installer/pkg/components/ide-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/migrations"
	"github.com/gitpod-io/gitpod/installer/pkg/components/minio"
	openvsxproxy "github.com/gitpod-io/gitpod/installer/pkg/components/openvsx-proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/proxy"
	public_api_server "github.com/gitpod-io/gitpod/installer/pkg/components/public-api-server"
	"github.com/gitpod-io/gitpod/installer/pkg/components/rabbitmq"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	"github.com/gitpod-io/gitpod/installer/pkg/components/toxiproxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/usage"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"
)

var Objects = common.CompositeRenderFunc(
	blobserve.Objects,
	contentservice.Objects,
	dashboard.Objects,
	database.Objects,
	ide_metrics.Objects,
	ide_service.Objects,
	ide_proxy.Objects,
	migrations.Objects,
	minio.Objects,
	openvsxproxy.Objects,
	proxy.Objects,
	rabbitmq.Objects,
	server.Objects,
	wsmanagerbridge.Objects,
	public_api_server.Objects,
	usage.Objects,
	toxiproxy.Objects,
)

var Helm = common.CompositeHelmFunc(
	database.Helm,
	minio.Helm,
	rabbitmq.Helm,
)
