/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  prometheusRules+:: {
    groups+: [
      {
        name: 'gitpod-workspacefailure-slo-records',
        rules: [
          {
            record: 'gitpod_workspace_failure_total:5m_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[5m]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[5m]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[5m]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[5m]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:30m_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[30m]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[30m]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[30m]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[30m]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:1h_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[1h]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[1h]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[1h]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[1h]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:2h_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[2h]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[2h]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[2h]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[2h]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:6h_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[6h]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[6h]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[6h]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[6h]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:1d_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[1d]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[1d]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[1d]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[1d]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:3d_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[3d]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[3d]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[3d]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[3d]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:30d_failure_ratio',
            expr: |||
              (
                (
                  sum(rate(gitpod_ws_manager_workspace_stops_total{reason="failed",type!~"PREBUILD"}[30d]))
                  /
                  sum(rate(gitpod_ws_manager_workspace_stops_total{type!~"PREBUILD"}[30d]))
                )
              ) + (
                (
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace",grpc_code!~"OK|ResourceExhausted"}[30d]))
                  /
                  sum(rate(grpc_server_handled_total{grpc_method="StartWorkspace"}[30d]))
                )
              )
            |||,
          },
          {
            record: 'gitpod_workspace_failure_total:slo_target',
            expr: '0.99',
          },
          {
            record: 'gitpod_workspace_failure_total:error_budget_remaining',
            expr: 'gitpod_workspace_failure_total:monthly_availability - gitpod_workspace_failure_total:slo_target',
          },
          {
            record: 'gitpod_workspace_failure_total:monthly_availability',
            expr: '1 - gitpod_workspace_failure_total:30d_failure_ratio',
          },
        ],
      },
    ],
  },
}
