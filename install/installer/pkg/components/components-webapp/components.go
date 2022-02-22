// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package componentswebapp

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/dashboard"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database"
	ide_proxy "github.com/gitpod-io/gitpod/installer/pkg/components/ide-proxy"
	imagebuildermk3 "github.com/gitpod-io/gitpod/installer/pkg/components/image-builder-mk3"
	"github.com/gitpod-io/gitpod/installer/pkg/components/migrations"
	"github.com/gitpod-io/gitpod/installer/pkg/components/minio"
	openvsxproxy "github.com/gitpod-io/gitpod/installer/pkg/components/openvsx-proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/rabbitmq"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"
)

var Objects = common.CompositeRenderFunc(
	contentservice.Objects,
	dashboard.Objects,
	database.Objects,
	ide_proxy.Objects,
	imagebuildermk3.Objects,
	migrations.Objects,
	minio.Objects,
	openvsxproxy.Objects,
	proxy.Objects,
	rabbitmq.Objects,
	server.Objects,
	wsmanagerbridge.Objects,
)

var Helm = common.CompositeHelmFunc(
	database.Helm,
	minio.Helm,
	rabbitmq.Helm,
)
