/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  grafanaDashboards+:: {
    // Import raw json files here.
    // Example:
    // 'my-new-dashboard.json': (import 'dashboards/components/new-component.json'),
    'gitpod-component-dashboard.json': (import 'dashboards/components/dashboard.json'),
    'gitpod-component-db.json': (import 'dashboards/components/db.json'),
    'gitpod-component-db-sync.json': (import 'dashboards/components/db-sync.json'),
    'gitpod-component-image-builder.json': (import 'dashboards/components/image-builder.json'),
    'gitpod-component-messagebus.json': (import 'dashboards/components/messagebus.json'),
    'gitpod-component-ws-manager-bridge.json': (import 'dashboards/components/ws-manager-bridge.json'),
    'gitpod-component-proxy.json': (import 'dashboards/components/proxy.json'),
    'gitpod-component-server.json': (import 'dashboards/components/server.json'),
    'gitpod-slo-login.json': (import 'dashboards/SLOs/login.json'),
  },
}
