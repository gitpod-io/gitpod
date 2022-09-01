/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  grafanaDashboards+:: {
    // Import raw json files here.
    // Example:
    // 'my-new-dashboard.json': (import 'dashboards/components/new-component.json'),
    'gitpod-component-openvsx-proxy.json': (import 'dashboards/components/openvsx-proxy.json'),
    'gitpod-component-ssh-gateway.json': (import 'dashboards/components/ssh-gateway.json'),
    'gitpod-component-jb.json': (import 'dashboards/components/jb.json'),
    'gitpod-component-browser-overview.json': (import 'dashboards/components/browser-overview.json'),

  },
}
