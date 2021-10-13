/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusAlerts+:: {
    groups+: [
      {
        name: 'gitpod-component-meta-server-alerts',
        rules: [
          {
            alert: 'WebsocketConnectionsNotClosing',
            expr: 'sum(server_websocket_connection_count) == 10000',
            'for': '10m',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/observability/blob/main/runbooks/WebsocketConnectionsNotClosing.md',
              summary: 'Open websocket connections are not closing for the last 10 minutes and accumulating.',
            },
          },
        ],
      },
    ],
  },
}
