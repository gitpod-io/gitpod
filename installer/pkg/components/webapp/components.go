// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package webapp

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/dashboard"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/database"
	jaegeroperator "github.com/gitpod-io/gitpod/installer/pkg/components/webapp/jaeger-operator"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/migrations"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/minio"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/proxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/rabbitmq"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/server"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/webapp/ws-manager-bridge"
)

var Objects = common.CompositeRenderFunc(
	proxy.Objects,
	dashboard.Objects,
	database.Objects,
	migrations.Objects,
	rabbitmq.Objects,
	server.Objects,
	wsmanagerbridge.Objects,
)

var HelmDependencies = common.CompositeHelmFunc(
	database.Helm,
	jaegeroperator.Helm,
	minio.Helm,
	rabbitmq.Helm,
)
