/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

(import './dashboards/SLOs/workspace-startup-time.libsonnet') +
{
  grafanaDashboards+:: {
    // Import raw json files here.
    // Example:
    // 'my-new-dashboard.json': (import 'dashboards/components/new-component.json'),
    'gitpod-cluster-autoscaler-k3s.json': (import 'dashboards/gitpod-cluster-autoscaler-k3s.json'),
    'gitpod-node-resource-metrics.json': (import 'dashboards/gitpod-node-resource-metrics.json'),
    'gitpod-grpc-server.json': (import 'dashboards/gitpod-grpc-server.json'),
    'gitpod-grpc-client.json': (import 'dashboards/gitpod-grpc-client.json'),
    'gitpod-connect-server.json': (import 'dashboards/gitpod-connect-server.json'),
    'gitpod-overview.json': (import 'dashboards/gitpod-overview.json'),
    'gitpod-nodes-overview.json': (import 'dashboards/gitpod-nodes-overview.json'),
    'gitpod-admin-node.json': (import 'dashboards/gitpod-admin-node.json'),
    'gitpod-admin-workspace.json': (import 'dashboards/gitpod-admin-workspace.json'),
    'gitpod-applications.json': (import 'dashboards/gitpod-applications.json'),
    'redis.json': (import 'dashboards/redis.json')
  },
}
