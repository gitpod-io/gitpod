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
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/WebsocketConnectionsNotClosing.md',
              summary: 'Open websocket connections are not closing for the last 10 minutes and accumulating.',
              description: 'We have accumulated {{ printf "%.2f" $value }} open websocket connections.',
            },
          },
          {
            alert: 'ServerEventLoopLagTooHigh',
            expr: 'avg_over_time(nodejs_eventloop_lag_seconds{job="server"}[20m]) > 0.35',
            'for': '5m',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/ServerEventLoopLagTooHigh.md',
              summary: 'Server accumulated too much "event loop lag". The webapp will become unresponsive if we don\'t act here.',
              description: 'Server has accumulated {{ printf "%.2f" $value }}ms event loop lag.',
            },
          },
        ],
      },
    ],
  },
}
