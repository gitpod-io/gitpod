/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

{
  grafanaDashboards+:: {
    // Import raw json files here.
    // Example:
    // 'my-new-dashboard.json': (import 'dashboards/components/new-component.json'),
    'gitpod-component-dashboard.json': (import 'dashboards/components/dashboard.json'),
    'gitpod-component-db.json': (import 'dashboards/components/db.json'),
    'gitpod-component-ws-manager-bridge.json': (import 'dashboards/components/ws-manager-bridge.json'),
    'gitpod-component-proxy.json': (import 'dashboards/components/proxy.json'),
    'gitpod-component-server.json': (import 'dashboards/components/server.json'),
    'gitpod-component-server-garbage-collector.json': (import 'dashboards/components/server-garbage-collector.json'),
    'gitpod-component-usage.json': (import 'dashboards/components/usage.json'),
    'gitpod-slo-login.json': (import 'dashboards/SLOs/login.json'),
    'gitpod-meta-overview.json': (import 'dashboards/components/meta-overview.json'),
    'gitpod-meta-services.json': (import 'dashboards/components/meta-services.json'),
    'gitpod-components-spicedb.json': (import 'dashboards/components/spicedb.json'),
  },
}
