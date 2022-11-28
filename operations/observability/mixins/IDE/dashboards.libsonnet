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
    'gitpod-component-openvsx-mirror.json': (import 'dashboards/components/openvsx-mirror.json'),
    'gitpod-component-ssh-gateway.json': (import 'dashboards/components/ssh-gateway.json'),
    'gitpod-component-jb.json': (import 'dashboards/components/jb.json'),
    'gitpod-component-browser-overview.json': (import 'dashboards/components/browser-overview.json'),
    'gitpod-component-code-browser.json': (import 'dashboards/components/code-browser.json'),
    'gitpod-component-ide-startup-time.json': (import 'dashboards/components/ide-startup-time.json'),
  },
}
