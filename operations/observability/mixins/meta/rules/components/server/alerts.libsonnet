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
              description: 'Server has accumulated {{ printf "%.2f" $value }}s event loop lag.',
            },
          },
          {
            alert: 'InstanceStartFailures',
            // Reasoning: 1 failure every 120s should not trigger an incident: 1/120 = 0.00833.. => 0.01
            expr: 'sum (irate(gitpod_server_instance_starts_failed_total[2m])) by (reason) > 0.01',
            'for': '30s',
            labels: {
              severity: 'critical',
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/InstanceStartFailures.md',
              summary: 'Server tries to start an instance, but cannot for whatever reason. Investigation required.',
              description: 'Server cannot start workspace instances on workspace clusters.',
            },
          },
          // Rollout alerts
          {
            alert: 'JsonRpcApiErrorRates',
            // Reasoning: the values are taken from past data
            expr: 'sum (rate(gitpod_server_api_calls_total{statusCode!~"2..|429"}[5m])) / sum(rate(gitpod_server_api_calls_total[5m])) > 0.04',
            'for': '5m',
            labels: {
              // sent to the team internal channel until we fine tuned it
              severity: 'warning',
              team: 'webapp'
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/GitpodApiErrorRate.md',
              summary: 'The error rate of the JSON RPC API is high. Investigation required.',
              description: 'JSON RPC API error rate high',
            },
          },
          {
            alert: 'WebsocketConnectionRateHigh',
            // Reasoning: the values are taken from past data
            expr: 'sum(rate(server_websocket_connection_count[2m])) > 30',
            'for': '5m',
            labels: {
              // sent to the team internal channel until we fine tuned it
              severity: 'warning',
              team: 'webapp'
            },
            annotations: {
              runbook_url: 'https://github.com/gitpod-io/runbooks/blob/main/runbooks/WebsocketConnectionRateHigh.md',
              summary: 'The websocket connection rate is higher than usual. Investigation required.',
              description: 'Websocket connection rate high',
            },
          },
        ],
      },
    ],
  },
}
