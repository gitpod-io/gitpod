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
    'gitpod-component-agent-smith.json': (import 'dashboards/components/agent-smith.json'),
    'gitpod-component-content-service.json': (import 'dashboards/components/content-service.json'),
    'gitpod-component-ws-daemon.json': (import 'dashboards/components/ws-daemon.json'),
    'gitpod-component-ws-manager-mk2.json': (import 'dashboards/components/ws-manager-mk2.json'),
    'gitpod-component-ws-proxy.json': (import 'dashboards/components/ws-proxy.json'),
    'gitpod-workspace-success-criteria.json': (import 'dashboards/success-criteria.json'),
    'gitpod-workspace-coredns.json': (import 'dashboards/coredns.json'),
    'gitpod-node-swap.json': (import 'dashboards/node-swap.json'),
    'gitpod-node-ephemeral-storage.json': (import 'dashboards/ephemeral-storage.json'),
    'gitpod-node-problem-detector.json': (import 'dashboards/node-problem-detector.json'),
    'gitpod-network-limiting.json': (import 'dashboards/network-limiting.json'),
    'gitpod-component-image-builder.json': (import 'dashboards/components/image-builder.json'),
    'gitpod-psi.json': (import 'dashboards/node-psi.json'),
    'gitpod-workspace-psi.json': (import 'dashboards/workspace-psi.json'),
  },
}
