/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  grafanaDashboards+:: {
    // Import raw json files here.
    // Example:
    // 'my-new-dashboard.json': (import 'dashboards/components/new-component.json'),
    'gitpod-component-agent-smith.json': (import 'dashboards/components/agent-smith.json'),
    'gitpod-component-blobserve.json': (import 'dashboards/components/blobserve.json'),
    'gitpod-component-content-service.json': (import 'dashboards/components/content-service.json'),
    'gitpod-component-registry-facade.json': (import 'dashboards/components/registry-facade.json'),
    'gitpod-component-ws-daemon.json': (import 'dashboards/components/ws-daemon.json'),
    'gitpod-component-ws-manager.json': (import 'dashboards/components/ws-manager.json'),
    'gitpod-component-ws-proxy.json': (import 'dashboards/components/ws-proxy.json'),
    'gitpod-component-ws-scheduler.json': (import 'dashboards/components/ws-scheduler.json'),
  },
}
